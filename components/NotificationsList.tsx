"use client";

import { useState } from "react";

type Notif = {
  id: number; type: string; title: string;
  content: string; is_read: number; created_at: string;
  created_by_name?: string;
};

const ICONS: Record<string, string> = { info: "ℹ", warning: "⚠", ban: "✕", fine: "₽" };
const LABELS: Record<string, string> = { info: "Уведомление", warning: "Предупреждение", ban: "Блокировка", fine: "Штраф" };
const COLORS: Record<string, string> = { info: "var(--blue)", warning: "var(--amber)", ban: "var(--red)", fine: "var(--purple)" };
const BG: Record<string, string> = { info: "var(--blue-bg)", warning: "var(--amber-bg)", ban: "var(--red-bg)", fine: "var(--purple-bg)" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function NotificationsList({ initialNotifs }: { initialNotifs: Notif[] }) {
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());

  const unread = notifs.filter(n => n.is_read === 0).length;

  async function dismiss(id: number) {
    setDismissing(prev => new Set(prev).add(id));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: 1 }),
    });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setDismissing(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  async function dismissAll() {
    const unreadIds = notifs.filter(n => n.is_read === 0).map(n => n.id);
    await Promise.all(unreadIds.map(id => dismiss(id)));
  }

  if (notifs.length === 0) {
    return (
      <div style={{ padding: "32px 24px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Уведомлений нет</div>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Непрочитанных: <strong style={{ color: "var(--red)" }}>{unread}</strong>
          </span>
          <button
            onClick={dismissAll}
            style={{ fontSize: "11.5px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}
          >
            Прочитать все
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {notifs.map(n => (
          <div key={n.id} style={{
            padding: "12px 14px", borderRadius: "8px",
            background: n.is_read ? "var(--bg-surface)" : BG[n.type] ?? "var(--bg-elevated)",
            borderLeft: `3px solid ${n.is_read ? "var(--border)" : (COLORS[n.type] ?? "var(--text-muted)")}`,
            opacity: n.is_read ? 0.6 : 1,
            transition: "opacity 0.2s",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: n.is_read ? "var(--text-muted)" : (COLORS[n.type] ?? "var(--text-muted)"), textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {LABELS[n.type] ?? n.type}
                </span>
                {!n.is_read && (
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS[n.type] ?? "var(--text-muted)", display: "inline-block", flexShrink: 0 }} />
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)", marginBottom: "3px" }}>{n.title}</div>
              {n.content && <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>{n.content}</div>}
              <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                {fmt(n.created_at)}{n.created_by_name ? ` · ${n.created_by_name}` : ""}
              </div>
            </div>
            {!n.is_read && (
              <button
                onClick={() => dismiss(n.id)}
                disabled={dismissing.has(n.id)}
                title="Отметить как прочитанное"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
