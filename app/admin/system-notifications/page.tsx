export const dynamic = 'force-dynamic';

import { getSystemNotifications, deleteSystemNotification, updateSystemNotification } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  info:    { label: "Инфо",    color: "var(--blue)",  bg: "var(--blue-bg)" },
  warning: { label: "Важно",   color: "var(--amber)", bg: "var(--amber-bg)" },
  alert:   { label: "Тревога", color: "var(--red)",   bg: "var(--red-bg)" },
};

export default function SystemNotificationsPage() {
  const notifs = getSystemNotifications(false);

  async function handleToggle(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const notifs2 = getSystemNotifications(false);
    const n = notifs2.find((x) => x.id === id);
    if (!n) return;
    updateSystemNotification(id, {
      type: n.type, title: n.title, content: n.content ?? undefined,
      is_active: n.is_active === 0,
      show_before_login: n.show_before_login === 1,
    });
    revalidatePath("/admin/system-notifications");
  }

  async function handleDelete(formData: FormData) {
    "use server";
    deleteSystemNotification(Number(formData.get("id")));
    revalidatePath("/admin/system-notifications");
  }

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Управление
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Системные объявления ({notifs.length})
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Объявления видны всем авторизованным пользователям. Если включён флаг «до входа» — видны на странице логина тоже.
          </p>
        </div>
        <Link href="/admin/system-notifications/new" className="btn-primary">Новое объявление</Link>
      </div>

      {notifs.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)" }}>Системных объявлений нет</p>
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {notifs.map((n) => {
            const t = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
            return (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                padding: "12px 14px", borderRadius: "8px",
                background: n.is_active ? "var(--bg-surface)" : "var(--bg-elevated)",
                border: `1px solid ${n.is_active ? "var(--border)" : "transparent"}`,
                borderLeft: `3px solid ${n.is_active ? t.color : "var(--border-strong)"}`,
                opacity: n.is_active ? 1 : 0.5,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <span className="badge" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)" }}>{n.title}</span>
                    {n.show_before_login === 1 && (
                      <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>До входа</span>
                    )}
                    {n.is_active === 0 && (
                      <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>Отключено</span>
                    )}
                  </div>
                  {n.content && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{n.content.slice(0, 80)}{n.content.length > 80 ? "…" : ""}</div>
                  )}
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{fmt(n.created_at)}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <form action={handleToggle}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }}>
                      {n.is_active ? "Выключить" : "Включить"}
                    </button>
                  </form>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={n.id} />
                    <ConfirmButton type="submit" message={`Удалить объявление "${n.title}"?`} className="btn-danger">
                      Удалить
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
