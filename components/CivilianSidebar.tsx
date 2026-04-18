"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import AlphaBadge from "./AlphaBadge";
import NotificationBell from "./NotificationBell";

const NAV = [
  { href: "/portal",         label: "Портал" },
  { href: "/portal/appeals", label: "Обращения" },
  { href: "/notifications",  label: "Уведомления" },
  { href: "/world",          label: "Доступ в мир" },
];

const ACCOUNT = [
  { href: "/profile",  label: "Мой профиль" },
  { href: "/settings", label: "Настройки" },
];

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.getAttribute("data-theme") === "light";
  if (isLight) {
    root.removeAttribute("data-theme");
    localStorage.setItem("theme", "dark");
  } else {
    root.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");
  }
}

export default function CivilianSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; role?: string; passportNumber?: string } | undefined;

  function active(href: string) {
    if (href === "/portal") return pathname === "/portal" || (pathname.startsWith("/portal") && !pathname.startsWith("/portal/appeals"));
    if (href === "/portal/appeals") return pathname.startsWith("/portal/appeals");
    return pathname.startsWith(href);
  }

  return (
    <aside style={{
      position: "fixed", top: 0, left: 0,
      width: "240px", height: "100vh",
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 50,
    }}>

      {/* ── Logo block ─────────────────────── */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border)" }}>
        <Link href="/portal" style={{ textDecoration: "none", display: "block", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0", marginBottom: "4px" }}>
            <span className="logo-slash">//</span>
            <span className="logo-colon">:</span>
            <span className="logo-most">МОСТ</span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.06em" }}>
            Портал Пельгарии
          </div>
        </Link>
        <AlphaBadge />
      </div>

      {/* ── Navigation ────────────────────── */}
      <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>

        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", padding: "0 8px", marginBottom: "6px" }}>
          Навигация
        </div>

        {NAV.map(link => (
          <Link key={link.href} href={link.href}
            style={{
              display: "block", padding: "8px 12px", borderRadius: "7px",
              fontSize: "13.5px", fontWeight: active(link.href) ? 600 : 400,
              color: active(link.href) ? "var(--text)" : "var(--text-muted)",
              background: active(link.href) ? "var(--bg-elevated)" : "transparent",
              textDecoration: "none",
              transition: "background 0.12s, color 0.12s",
              borderLeft: active(link.href) ? "2px solid var(--border-strong)" : "2px solid transparent",
            }}
          >
            {link.label}
          </Link>
        ))}

        <div style={{ height: "1px", background: "var(--border)", margin: "10px 4px" }} />

        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", padding: "0 8px", marginBottom: "6px" }}>
          Аккаунт
        </div>

        {ACCOUNT.map(link => (
          <Link key={link.href} href={link.href}
            style={{
              display: "block", padding: "8px 12px", borderRadius: "7px",
              fontSize: "13.5px", fontWeight: active(link.href) ? 600 : 400,
              color: active(link.href) ? "var(--text)" : "var(--text-muted)",
              background: active(link.href) ? "var(--bg-elevated)" : "transparent",
              textDecoration: "none",
              transition: "background 0.12s, color 0.12s",
              borderLeft: active(link.href) ? "2px solid var(--border-strong)" : "2px solid transparent",
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* ── Bottom ────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border)" }}>

        {/* User card */}
        {user && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 800, color: "var(--text)",
              }}>
                {user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </div>
                {user.passportNumber && (
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                    {user.passportNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls row */}
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>

          {user?.role === "admin" && (
            <Link href="/admin" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: "7px",
              border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)", fontSize: "12.5px", fontWeight: 500,
              textDecoration: "none", transition: "background 0.12s, color 0.12s",
              marginBottom: "4px",
            }}>
              Панель управления
              <span style={{ opacity: 0.4, fontSize: "14px" }}>→</span>
            </Link>
          )}

          <div style={{ display: "flex", gap: "4px" }}>
            <NotificationBell />
            <button onClick={toggleTheme} style={{
              flex: 1, display: "flex", alignItems: "center", gap: "7px",
              padding: "8px 12px", borderRadius: "7px",
              border: "none", background: "transparent",
              color: "var(--text-muted)", fontSize: "13px", fontWeight: 400,
              cursor: "pointer", fontFamily: "var(--font-body)",
              transition: "background 0.12s, color 0.12s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <span style={{ fontSize: "14px" }}>◐</span> Тема
            </button>
            <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "8px 12px", borderRadius: "7px",
              border: "none", background: "transparent",
              color: "var(--text-muted)", fontSize: "12px",
              cursor: "pointer", fontFamily: "var(--font-body)",
              transition: "background 0.12s, color 0.12s",
              whiteSpace: "nowrap",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--red-bg)"; e.currentTarget.style.color = "var(--red)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
