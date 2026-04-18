import { createSystemNotification } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function NewSystemNotificationPage() {
  async function handleCreate(formData: FormData) {
    "use server";
    const s = await auth();
    const adminId = Number((s?.user as any)?.id ?? 1);
    createSystemNotification({
      type: formData.get("type") as string,
      title: formData.get("title") as string,
      content: (formData.get("content") as string) || undefined,
      is_active: true,
      show_before_login: formData.get("show_before_login") === "on",
      created_by: adminId,
    });
    revalidatePath("/admin/system-notifications");
    redirect("/admin/system-notifications");
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
          Системные объявления
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Новое объявление
        </h1>
      </div>

      <form action={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Тип
          </label>
          <select name="type" style={inputStyle}>
            <option value="info">Информация</option>
            <option value="warning">Важное предупреждение</option>
            <option value="alert">Тревога</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Заголовок *
          </label>
          <input name="title" required placeholder="Краткое объявление для граждан" style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Описание
          </label>
          <textarea name="content" rows={3} placeholder="Подробности..." style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <input type="checkbox" name="show_before_login" style={{ marginTop: "2px", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)" }}>Показывать до авторизации</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Объявление будет видно прямо на странице входа, даже без аккаунта
            </div>
          </div>
        </label>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Опубликовать</button>
          <a href="/admin/system-notifications" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
