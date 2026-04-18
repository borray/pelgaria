"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_GROUPS = [
  {
    label: "Документы",
    links: [
      { href: "/admin/docs-editor", label: "Редактор архива" },
      { href: "/admin/documents",   label: "Список документов" },
    ],
  },
  {
    label: "Граждане",
    links: [
      { href: "/admin/passports",     label: "Паспорта" },
      { href: "/admin/notifications", label: "Уведомления" },
      { href: "/admin/appeals",       label: "Обращения" },
    ],
  },
  {
    label: "Система",
    links: [
      { href: "/admin/system-notifications", label: "Объявления" },
      { href: "/admin/users",                label: "Пользователи" },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as { name?: string } | undefined;

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const linkStyle = (href: string): React.CSSProperties => ({
    display: "block", padding: "7px 12px", borderRadius: "6px",
    fontSize: "13px", fontWeight: active(href) ? 600 : 400,
    color: active(href) ? "#e4e4e7" : "rgba(255,255,255,0.4)",
    background: active(href) ? "rgba(255,255,255,0.07)" : "transparent",
    textDecoration: "none",
    borderLeft: active(href) ? "2px solid rgba(255,255,255,0.25)" : "2px solid transparent",
    transition: "background 0.12s, color 0.12s",
  });

  return (
    <aside style={{
      position: "fixed", top: 0, left: 0,
      width: "240px", height: "100vh",
      background: "#0a0a0d",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column",
      zIndex: 50,
    }}>

      {/* ── Logo ───────────────────────────── */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{
          fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.14em", color: "rgba(255,255,255,0.25)",
          marginBottom: "10px",
        }}>
          Панель управления
        </div>
        <Link href="/admin" style={{ textDecoration: "none", display: "block" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0", marginBottom: "3px" }}>
            <span style={{ fontFamily: '"Courier New", monospace', fontWeight: 400, fontSize: "14px", color: "rgba(255,255,255,0.3)", letterSpacing: "-0.02em" }}>//</span>
            <span style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>:</span>
            <span style={{ fontWeight: 800, fontSize: "15px", color: "#e4e4e7", letterSpacing: "-0.05em" }}>МОСТ</span>
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>Администрирование</div>
        </Link>
      </div>

      {/* ── Nav ────────────────────────────── */}
      <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
        <Link href="/admin" style={linkStyle("/admin")}>Обзор</Link>

        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)",
                padding: "0 0 7px 12px",
              }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {group.links.map(link => (
                  <Link key={link.href} href={link.href} style={linkStyle(link.href)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Bottom ─────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {/* User */}
        {user && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: 800, color: "#e4e4e7",
              }}>
                {user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#e4e4e7" }}>{user.name}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Администратор</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "10px 12px", display: "flex", gap: "4px" }}>
          <Link href="/portal" style={{
            flex: 1, display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 12px", borderRadius: "7px",
            color: "rgba(255,255,255,0.35)", fontSize: "12.5px",
            textDecoration: "none", transition: "background 0.12s, color 0.12s",
          }}>
            ← На портал
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "8px 12px", borderRadius: "7px",
            border: "none", background: "transparent",
            color: "rgba(255,255,255,0.3)", fontSize: "12px",
            cursor: "pointer", fontFamily: "inherit",
            transition: "background 0.12s, color 0.12s",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "transparent"; }}
          >
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
