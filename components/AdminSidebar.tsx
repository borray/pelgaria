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

  const initials = user?.name?.slice(0, 2).toUpperCase() ?? "АД";

  return (
    <aside className="sidebar" style={{
      background: "linear-gradient(180deg, rgba(255,107,122,0.06) 0%, rgba(255,255,255,0.04) 40%)",
    }}>

      {/* ── Logo ──────────────────────────── */}
      <div className="sb-logo">
        <div style={{ fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--c-security)", marginBottom: "8px", opacity: 0.7 }}>
          Панель управления
        </div>
        <Link href="/admin" style={{ textDecoration: "none", display: "block" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
            <span className="logo-slash">//</span>
            <span className="logo-colon">:</span>
            <span className="logo-most">МОСТ</span>
          </div>
        </Link>
        <div className="sb-sub">Администрирование · 2026</div>
      </div>

      {/* ── Main nav ──────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", position: "relative", zIndex: 1 }}>
        <Link href="/admin" className={`sb-link${active("/admin") ? " active" : ""}`}>
          Обзор
        </Link>

        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginTop: "6px" }}>
            <div className="t-label" style={{ padding: "0 12px", marginBottom: "4px", opacity: 0.6 }}>
              {group.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {group.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sb-link${active(link.href) ? " active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ────────────────────────── */}
      <div className="sb-foot">
        {user && (
          <div className="sb-user">
            <div className="sb-avatar" style={{ background: "linear-gradient(135deg, #ff6b7a 0%, #ff9a8b 100%)" }}>
              {initials}
            </div>
            <div className="sb-user-txt">
              <div className="sb-user-nm">{user.name}</div>
              <div className="sb-user-nk">Администратор</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "4px" }}>
          <Link href="/portal" style={{
            flex: 1, display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 12px", borderRadius: "10px",
            color: "var(--fg-3)", fontSize: "12.5px",
            textDecoration: "none", transition: "background 150ms, color 150ms",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-2)"; e.currentTarget.style.color = "var(--fg)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}
          >
            ← На портал
          </Link>
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
