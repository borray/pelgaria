import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllDepartments, getPassportById, getPassportByUserId, createAppeal } from "@/lib/db";
import { revalidatePath } from "next/cache";

export default async function NewAppealPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const { dept } = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;

  // Find citizen's passport
  let passport = user?.passportId ? getPassportById(Number(user.passportId)) : undefined;
  if (!passport && user?.id && !String(user.id).startsWith("passport:")) {
    passport = getPassportByUserId(Number(user.id));
  }
  if (!passport) redirect("/profile");

  const departments = getAllDepartments().filter((d) => d.slug !== "security" || user.role === "admin");

  async function handleCreate(formData: FormData) {
    "use server";
    const s = await auth();
    const u = s?.user as any;
    let p = u?.passportId ? getPassportById(Number(u.passportId)) : undefined;
    if (!p && u?.id && !String(u.id).startsWith("passport:")) p = getPassportByUserId(Number(u.id));
    if (!p) return;

    createAppeal({
      passport_id: p.id,
      department_id: Number(formData.get("department_id")),
      subject: formData.get("subject") as string,
      content: formData.get("content") as string,
    });
    revalidatePath("/portal/appeals");
    redirect("/portal/appeals");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };

  return (
    <div className="page-enter" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Обращения граждан
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Новое обращение
        </h1>
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "6px" }}>
          Обращение будет направлено от имени паспорта {passport.passport_number} ({passport.minecraft_nick})
        </p>
      </div>

      <form action={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ведомство *
          </label>
          <select name="department_id" required defaultValue={departments.find((d) => d.slug === dept)?.id ?? ""} style={inputStyle}>
            <option value="" disabled>Выберите ведомство</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Тема обращения *
          </label>
          <input name="subject" required placeholder="Кратко опишите суть обращения" style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Содержание *
          </label>
          <textarea name="content" required rows={6}
            placeholder="Подробно опишите вашу ситуацию или запрос..."
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        <div style={{
          padding: "12px 14px", borderRadius: "8px",
          border: "1px solid var(--border)", background: "var(--bg-surface)",
          fontSize: "12px", color: "var(--text-muted)",
        }}>
          Обращение рассматривается в течение разумного срока. При получении ответа вы получите уведомление в личном кабинете.
        </div>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Отправить обращение</button>
          <a href="/portal/appeals" className="btn-secondary">Мои обращения</a>
        </div>
      </form>
    </div>
  );
}
