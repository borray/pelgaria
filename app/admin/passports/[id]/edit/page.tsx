import { getPassportById, updatePassport, getAllUsers } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export default async function EditPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = getPassportById(Number(id));
  if (!passport) notFound();
  const users = getAllUsers();
  const session = await auth();
  const currentUserId = Number((session?.user as any)?.id ?? 1);

  async function handleUpdate(formData: FormData) {
    "use server";
    const s = await auth();
    const adminId = Number((s?.user as any)?.id ?? 1);
    const linkedUserId = formData.get("user_id") ? Number(formData.get("user_id")) : null;
    const newPin = (formData.get("pin") as string)?.trim() || undefined;
    const clearPin = formData.get("clear_pin") === "on";
    const notifyStatus = formData.get("notify_status") === "on";
    updatePassport(Number(id), {
      minecraft_nick: formData.get("minecraft_nick") as string,
      full_name: (formData.get("full_name") as string) || undefined,
      citizenship_level: formData.get("citizenship_level") as string,
      status: formData.get("status") as string,
      notes: (formData.get("notes") as string) || undefined,
      pin: newPin,
      clearPin,
      user_id: linkedUserId,
      issued_by_custom: (formData.get("issued_by_custom") as string) || undefined,
      issue_date: (formData.get("issue_date") as string) || undefined,
      notify: notifyStatus,
      notifyAdminId: notifyStatus ? adminId : undefined,
    });
    revalidatePath("/admin/passports");
    redirect("/admin/passports");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };

  return (
    <div className="page-enter" style={{ maxWidth: "560px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Паспортный стол
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Редактировать паспорт
        </h1>
      </div>

      <form action={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Passport number (read-only) */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Номер паспорта
          </label>
          <div style={{ ...inputStyle, background: "var(--bg-surface)", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "16px", letterSpacing: "0.05em", cursor: "not-allowed" }}>
            {passport.passport_number}
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Номер паспорта нельзя изменить</p>
        </div>

        {/* Minecraft nick + full name */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Никнейм в Minecraft *
            </label>
            <input name="minecraft_nick" defaultValue={passport.minecraft_nick} required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Полное имя
            </label>
            <input name="full_name" defaultValue={passport.full_name ?? ""} placeholder="Необязательно" style={inputStyle} />
          </div>
        </div>

        {/* Level + Status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Уровень гражданства
            </label>
            <select name="citizenship_level" defaultValue={passport.citizenship_level} style={inputStyle}>
              <option value="resident">Житель</option>
              <option value="citizen">Гражданин</option>
              <option value="honorary">Почётный гражданин</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Статус
            </label>
            <select name="status" defaultValue={passport.status} style={inputStyle}>
              <option value="active">✅ Активен</option>
              <option value="deactivating">🔄 Проходит деактивацию</option>
              <option value="frozen">🧊 Заморожен</option>
              <option value="temp_frozen">❄️ Временно заморожен</option>
              <option value="suspended">⚠️ Отстранён</option>
              <option value="blocked">🚫 Заблокирован</option>
              <option value="wanted">🔴 В розыске</option>
              <option value="deceased">💀 Выбыл</option>
            </select>
          </div>
        </div>

        {/* Issue date + Issuer (advanced) */}
        <details style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
          <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: "12.5px", color: "var(--text-secondary)", background: "var(--bg-elevated)", userSelect: "none", listStyle: "none" }}>
            ⚙️ Расширенные параметры — дата и подписант
          </summary>
          <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Дата выдачи</label>
              <input type="date" name="issue_date"
                defaultValue={passport.issue_date ?? passport.created_at?.split("T")[0] ?? ""}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Кем выдан</label>
              <input name="issued_by_custom" defaultValue={passport.issued_by_custom ?? ""}
                placeholder={passport.issued_by_name ?? "Администрация"} style={inputStyle} />
            </div>
          </div>
        </details>

        {/* Auto-notify on status change */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" name="notify_status" defaultChecked />
          <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Уведомить гражданина при смене статуса</span>
        </label>

        {/* PIN */}
        <div style={{ padding: "14px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "8px" }}>
            PIN-код
            {passport.pin_hash ? (
              <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green-soft)" }}>Установлен</span>
            ) : (
              <span className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>Не задан</span>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "5px" }}>
              {passport.pin_hash ? "Новый PIN (оставьте пустым чтобы не менять)" : "Задать PIN"}
            </label>
            <input name="pin" type="password" inputMode="numeric" maxLength={16}
              placeholder={passport.pin_hash ? "••••" : "Введите PIN или оставьте пустым"}
              style={{ ...inputStyle, letterSpacing: "0.1em" }} />
          </div>
          {passport.pin_hash && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" name="clear_pin" />
              <span style={{ fontSize: "12.5px", color: "var(--red)" }}>Удалить PIN (вход без PIN)</span>
            </label>
          )}
        </div>

        {/* Link to user account */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Привязан к аккаунту
          </label>
          <select name="user_id" defaultValue={passport.user_id ?? ""} style={inputStyle}>
            <option value="">— не привязывать —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} {u.id === currentUserId ? "(это я)" : ""} · {u.role}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            После изменения нужно перевойти для обновления сессии
          </p>
        </div>

        {/* Notes */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Заметки администратора
          </label>
          <textarea name="notes" rows={3} defaultValue={passport.notes ?? ""} placeholder="Необязательно — видно только гражданину" style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Сохранить изменения</button>
          <a href="/admin/passports" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
