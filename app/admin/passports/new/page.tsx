import { createPassport, getRandomPassportNumber, getAllUsers } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function NewPassportPage() {
  const session = await auth();
  const suggestedNumber = getRandomPassportNumber();
  const users = getAllUsers();
  const currentUserId = Number((session?.user as any)?.id ?? 1);

  async function handleCreate(formData: FormData) {
    "use server";
    const s = await auth();
    const adminId = Number((s?.user as any)?.id ?? 1);
    const linkedUserId = formData.get("user_id") ? Number(formData.get("user_id")) : undefined;
    createPassport({
      passport_number: (formData.get("passport_number") as string).toUpperCase().trim(),
      minecraft_nick: formData.get("minecraft_nick") as string,
      full_name: (formData.get("full_name") as string) || undefined,
      citizenship_level: formData.get("citizenship_level") as string,
      status: formData.get("status") as string,
      notes: (formData.get("notes") as string) || undefined,
      pin: (formData.get("pin") as string) || undefined,
      issued_by: adminId,
      issued_by_custom: (formData.get("issued_by_custom") as string) || undefined,
      issue_date: (formData.get("issue_date") as string) || undefined,
      user_id: linkedUserId,
    });
    revalidatePath("/admin/passports");
    redirect("/admin/passports");
  }

  const today = new Date().toISOString().split("T")[0];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };
  const label = (text: string, hint?: string) => (
    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {text}{hint && <span style={{ textTransform: "none", fontWeight: 400, marginLeft: "6px", letterSpacing: 0 }}>{hint}</span>}
    </label>
  );

  return (
    <div className="page-enter" style={{ maxWidth: "600px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>Паспортный стол</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>Выдать паспорт</h1>
      </div>

      <form action={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Passport number with random suggestion */}
        <div>
          {label("Номер паспорта")}
          <div style={{ display: "flex", gap: "8px" }}>
            <input name="passport_number" defaultValue={suggestedNumber} required
              style={{ ...inputStyle, fontFamily: "monospace", fontSize: "16px", letterSpacing: "0.05em", flex: 1 }} />
            <a href="/admin/passports/new" className="btn-secondary" title="Случайный свободный номер"
              style={{ fontSize: "13px", padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0 }}>
              🎲 Другой
            </a>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Случайный свободный номер: {suggestedNumber} · нажмите 🎲 чтобы сгенерировать другой
          </p>
        </div>

        {/* Nick + Full name */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>{label("Никнейм в Minecraft", "*")}<input name="minecraft_nick" required placeholder="Steve" style={inputStyle} /></div>
          <div>{label("Полное имя", "необязательно")}<input name="full_name" placeholder="Иван Иванов" style={inputStyle} /></div>
        </div>

        {/* Level + Status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            {label("Уровень гражданства")}
            <select name="citizenship_level" style={inputStyle}>
              <option value="resident">Житель</option>
              <option value="citizen">Гражданин</option>
              <option value="honorary">Почётный гражданин</option>
            </select>
          </div>
          <div>
            {label("Статус")}
            <select name="status" style={inputStyle}>
              <option value="active">Активен</option>
              <option value="deactivating">Проходит деактивацию</option>
              <option value="frozen">Заморожен</option>
              <option value="temp_frozen">Временно заморожен</option>
              <option value="suspended">Отстранён</option>
              <option value="blocked">Заблокирован</option>
              <option value="wanted">В розыске</option>
              <option value="deceased">Выбыл</option>
            </select>
          </div>
        </div>

        {/* Issue date + Issuer — advanced */}
        <details style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
          <summary style={{
            padding: "10px 14px", cursor: "pointer", fontSize: "12.5px",
            color: "var(--text-secondary)", background: "var(--bg-elevated)",
            userSelect: "none", listStyle: "none",
          }}>
            ⚙️ Расширенные параметры — дата и подписант
          </summary>
          <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              {label("Дата выдачи", "по умолчанию сегодня")}
              <input type="date" name="issue_date" defaultValue={today} style={inputStyle} />
            </div>
            <div>
              {label("Кем выдан", "переопределить")}
              <input name="issued_by_custom" placeholder="Министерство внутренних дел" style={inputStyle} />
            </div>
          </div>
        </details>

        {/* PIN */}
        <div>
          {label("PIN-код", "необязательно")}
          <input name="pin" type="password" inputMode="numeric" maxLength={16}
            placeholder="Оставьте пустым если не нужен"
            style={{ ...inputStyle, letterSpacing: "0.1em" }} />
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Если задать — гражданин обязан вводить PIN при входе по паспорту. PIN сохраняется в печатной форме.
          </p>
        </div>

        {/* Link to user */}
        <div>
          {label("Привязать к аккаунту", "необязательно")}
          <select name="user_id" style={inputStyle}>
            <option value="">— не привязывать —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}{u.id === currentUserId ? " (это я)" : ""} · {u.role}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Аккаунт при входе по логину увидит этот паспорт. Нужно перевойти после привязки.
          </p>
        </div>

        {/* Notes */}
        <div>
          {label("Заметки администратора")}
          <textarea name="notes" rows={3} placeholder="Видно только гражданину в профиле" style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Выдать паспорт</button>
          <a href="/admin/passports" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
