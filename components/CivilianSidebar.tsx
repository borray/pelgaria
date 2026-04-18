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

function cycleTheme() {
  const root = document.documentElement;
  const cur = root.getAttribute("data-theme") || "dark";
  const order = ["dark", "light", "paper", "crt"];
  const next = order[(order.indexOf(cur) + 1) % order.length];
  if (next === "dark") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
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

  const initials = user?.name?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <aside className="sidebar">
      {/* ── Logo ──────────────────────────── */}
      <div className="sb-logo">
        <Link href="/portal" style={{ textDecoration: "none", display: "block", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
            <span className="logo-slash">//</span>
            <span className="logo-colon">:</span>
            <span className="logo-most">МОСТ</span>
          </div>
        </Link>
        <div className="sb-sub">Портал Республики · 2026</div>
        <div style={{ marginTop: "10px" }}><AlphaBadge /></div>
      </div>

      {/* ── Main nav ──────────────────────── */}
      <div className="sb-group stagger">
        <div className="t-label">Разделы</div>
        {NAV.map(link => (
          <Link key={link.href} href={link.href} className={`sb-link${active(link.href) ? " active" : ""}`}>
            {link.label}
          </Link>
        ))}
      </div>

      <div className="sb-group">
        <div className="t-label">Аккаунт</div>
        {ACCOUNT.map(link => (
          <Link key={link.href} href={link.href} className={`sb-link${active(link.href) ? " active" : ""}`}>
            {link.label}
          </Link>
        ))}
        {user?.role === "admin" && (
          <Link href="/admin" className="sb-link" style={{ color: "var(--c-archive)" }}>
            Управление →
          </Link>
        )}
      </div>

      {/* ── Footer ────────────────────────── */}
      <div className="sb-foot">
        {user && (
          <div className="sb-user" onClick={() => {}}>
            <div className="sb-avatar">{initials}</div>
            <div className="sb-user-txt">
              <div className="sb-user-nm">{user.name}</div>
              {user.passportNumber && (
                <div className="sb-user-nk t-mono">{user.passportNumber}</div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "4px" }}>
          <NotificationBell />
          <button onClick={cycleTheme} style={{
            flex: 1, display: "flex", alignItems: "center", gap: "7px",
            padding: "8px 12px", borderRadius: "10px",
            border: "none", background: "transparent",
            color: "var(--fg-3)", fontSize: "13px",
            cursor: "pointer", fontFamily: "var(--ff-body)",
            transition: "background 150ms, color 150ms",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-2)"; e.currentTarget.style.color = "var(--fg)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}
          >
            <span style={{ fontSize: "14px" }}>◐</span> Тема
          </button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "8px 12px", borderRadius: "10px",
            border: "none", background: "transparent",
            color: "var(--fg-3)", fontSize: "12px",
            cursor: "pointer", fontFamily: "var(--ff-body)",
            transition: "background 150ms, color 150ms",
            whiteSpace: "nowrap",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--c-security) 10%, transparent)"; e.currentTarget.style.color = "var(--c-security)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}
          >
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
