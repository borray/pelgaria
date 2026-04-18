export const dynamic = 'force-dynamic';

import { getAllNotifications, deleteNotification } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

const TYPE_INFO: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  info:    { label: "Инфо",           color: "var(--blue)",       bg: "var(--blue-bg)",   icon: "📢" },
  warning: { label: "Предупреждение", color: "var(--amber)",      bg: "var(--amber-bg)",  icon: "⚠️" },
  ban:     { label: "Блокировка",     color: "var(--red)",        bg: "var(--red-bg)",    icon: "🚫" },
  fine:    { label: "Штраф",          color: "var(--purple)",     bg: "var(--purple-bg)", icon: "💰" },
};

export default function AdminNotificationsPage() {
  const notifs = getAllNotifications();

  async function handleDelete(formData: FormData) {
    "use server";
    deleteNotification(Number(formData.get("id")));
    revalidatePath("/admin/notifications");
  }

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Управление
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Уведомления граждан ({notifs.length})
          </h1>
        </div>
        <Link href="/admin/notifications/new" className="btn-primary">Отправить</Link>
      </div>

      {notifs.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)" }}>Уведомлений ещё нет</p>
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {notifs.map((n) => {
            const t = TYPE_INFO[n.type] ?? TYPE_INFO.info;
            return (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                padding: "10px 14px", borderRadius: "8px",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderLeft: `3px solid ${t.color}`,
              }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)" }}>{n.title}</span>
                      <span className="badge" style={{ background: t.bg, color: t.color, flexShrink: 0 }}>{t.label}</span>
                      {n.is_read === 0 && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)", flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                      → {n.passport_number} ({n.minecraft_nick}) · {fmt(n.created_at)}
                      {n.content && <span style={{ marginLeft: "8px", color: "var(--text-muted)" }}>— {n.content.slice(0, 60)}{n.content.length > 60 ? "…" : ""}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <Link href={`/admin/notifications/${n.id}/edit`} className="btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }}>
                    Изменить
                  </Link>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={n.id} />
                    <ConfirmButton type="submit" message={`Отозвать уведомление "${n.title}"?`} className="btn-danger">
                      Отозвать
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
