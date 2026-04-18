"use client";

import { useState, useEffect, useCallback } from "react";

type Notif = {
  id: number; type: string; title: string; content: string;
  is_read: number; is_hidden: number; created_at: string;
  expires_at: string | null; created_by_name?: string;
};

const TYPE_COLOR: Record<string, string> = {
  info: "var(--blue)", warning: "var(--amber)", ban: "var(--red)", fine: "var(--purple)",
};
const TYPE_BG: Record<string, string> = {
  info: "var(--blue-bg)", warning: "var(--amber-bg)", ban: "var(--red-bg)", fine: "var(--purple-bg)",
};
const TYPE_LABEL: Record<string, string> = {
  info: "Информация", warning: "Предупреждение", ban: "Блокировка", fine: "Штраф",
};

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} дн. назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtExpiry(expires_at: string) {
  const diff = new Date(expires_at).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "истекает < 1 ч.";
  if (hours < 24) return `истекает через ${hours} ч.`;
  const days = Math.floor(hours / 24);
  return `истекает через ${days} дн.`;
}

type Tab = "all" | "unread" | "read";

export default function NotificationCenter({ initialNotifs }: { initialNotifs: Notif[] }) {
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);

  // Poll for new notifications every 20s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/notifications");
        if (r.ok) setNotifs(await r.json());
      } catch {}
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const unreadCount = notifs.filter(n => n.is_read === 0).length;
  const readCount   = notifs.filter(n => n.is_read === 1).length;

  const visible = notifs.filter(n => {
    if (tab === "unread") return n.is_read === 0;
    if (tab === "read")   return n.is_read === 1;
    return true;
  });

  async function markRead(id: number) {
    setBusy(p => new Set(p).add(id));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: 1 }),
    });
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setBusy(p => { const s = new Set(p); s.delete(id); return s; });
  }

  async function remove(id: number) {
    setBusy(p => new Set(p).add(id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifs(p => p.filter(n => n.id !== id));
    setBusy(p => { const s = new Set(p); s.delete(id); return s; });
  }

  async function markAllRead() {
    setMarking(true);
    await fetch("/api/notifications/mark-read", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setNotifs(p => p.map(n => ({ ...n, is_read: 1 })));
    setMarking(false);
  }

  async function clearRead() {
    setMarking(true);
    await fetch("/api/notifications/mark-read", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideRead: true }),
    });
    setNotifs(p => p.filter(n => n.is_read === 0));
    setMarking(false);
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: "6px", border: "none",
    background: tab === t ? "var(--bg-elevated)" : "transparent",
    color: tab === t ? "var(--text)" : "var(--text-muted)",
    fontSize: "13px", fontWeight: tab === t ? 600 : 400,
    cursor: "pointer", fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s",
  });

  return (
    <div>
      {/* Tabs + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", gap: "12px" }}>
        <div style={{ display: "flex", gap: "2px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "3px" }}>
          <button style={tabStyle("all")} onClick={() => setTab("all")}>
            Все {notifs.length > 0 && <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>{notifs.length}</span>}
          </button>
          <button style={tabStyle("unread")} onClick={() => setTab("unread")}>
            Непрочитанные
            {unreadCount > 0 && (
              <span style={{ marginLeft: "6px", background: "var(--red)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "99px" }}>
                {unreadCount}
              </span>
            )}
          </button>
          <button style={tabStyle("read")} onClick={() => setTab("read")}>
            Прочитанные {readCount > 0 && <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>{readCount}</span>}
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="btn-secondary"
              style={{ fontSize: "11.5px", padding: "5px 12px" }}
            >
              Прочитать все
            </button>
          )}
          {readCount > 0 && (
            <button
              onClick={clearRead}
              disabled={marking}
              className="btn-secondary"
              style={{ fontSize: "11.5px", padding: "5px 12px", color: "var(--text-muted)" }}
            >
              Очистить прочитанные
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div style={{ padding: "56px 24px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "24px", color: "var(--border-strong)", fontFamily: "monospace", marginBottom: "10px" }}>—</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {tab === "unread" ? "Нет непрочитанных уведомлений" :
             tab === "read"   ? "Нет прочитанных уведомлений" :
             "Уведомлений нет"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {visible.map(n => {
            const color = TYPE_COLOR[n.type] ?? "var(--text-muted)";
            const bg    = TYPE_BG[n.type]    ?? "var(--bg-elevated)";
            const isNew = n.is_read === 0;
            const expiry = n.expires_at ? fmtExpiry(n.expires_at) : null;
            const isBusy = busy.has(n.id);

            return (
              <div key={n.id} style={{
                padding: "14px 16px", borderRadius: "10px",
                background: isNew ? bg : "var(--bg-surface)",
                border: `1px solid ${isNew ? color + "44" : "var(--border)"}`,
                borderLeft: `3px solid ${isNew ? color : "var(--border)"}`,
                opacity: isBusy ? 0.5 : 1,
                transition: "opacity 0.15s",
                display: "flex", gap: "12px",
              }}>
                {/* Left: type dot */}
                <div style={{ paddingTop: "2px", flexShrink: 0 }}>
                  <span style={{
                    display: "inline-block", width: "8px", height: "8px",
                    borderRadius: "50%", background: isNew ? color : "var(--border-strong)",
                  }} />
                </div>

                {/* Middle: content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.08em", color: isNew ? color : "var(--text-muted)",
                    }}>
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    {expiry && (
                      <span style={{ fontSize: "10px", color: "var(--amber)", fontWeight: 500 }}>
                        · {expiry}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text)", marginBottom: n.content ? "4px" : 0 }}>
                    {n.title}
                  </div>
                  {n.content && (
                    <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>
                      {n.content}
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span>{fmtDate(n.created_at)}</span>
                    {n.created_by_name && <span>· от {n.created_by_name}</span>}
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0, alignItems: "flex-end" }}>
                  {isNew && (
                    <button
                      onClick={() => markRead(n.id)}
                      disabled={isBusy}
                      title="Отметить прочитанным"
                      style={{
                        background: "none", border: "1px solid var(--border-strong)",
                        borderRadius: "5px", cursor: "pointer",
                        color: "var(--text-muted)", fontSize: "10px",
                        padding: "3px 7px", fontFamily: "inherit",
                        transition: "background 0.1s",
                      }}
                    >
                      Прочитано
                    </button>
                  )}
                  <button
                    onClick={() => remove(n.id)}
                    disabled={isBusy}
                    title="Скрыть уведомление"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-muted)", fontSize: "16px",
                      lineHeight: 1, padding: "2px 4px",
                      opacity: 0.6, transition: "opacity 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
