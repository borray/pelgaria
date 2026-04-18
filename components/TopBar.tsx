"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import AlphaBadge from "./AlphaBadge";

const ADMIN_LINKS = [
  { href: "/admin",                       label: "Обзор" },
  { href: "/admin/passports",             label: "Паспорта" },
  { href: "/admin/notifications",         label: "Уведомления граждан" },
  { href: "/admin/appeals",               label: "Обращения" },
  { href: "/admin/docs-editor",           label: "Редактор документов" },
  { href: "/admin/documents",             label: "Список документов" },
  { href: "/admin/system-notifications",  label: "Объявления" },
  { href: "/admin/users",                 label: "Пользователи" },
];

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

function AdminDropdown({ closeMenu }: { closeMenu?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useOutsideClick(ref, () => setOpen(false));

  const isAdminSection = pathname.startsWith("/admin");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className={`topnav-btn${isAdminSection ? " topnav-active" : ""}`}
      >
        Управление
        <span style={{ fontSize: "7px", opacity: 0.4, marginLeft: "2px" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="dropdown-panel">
          {ADMIN_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="dropdown-item"
              onClick={() => { setOpen(false); closeMenu?.(); }}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ closeMenu }: { closeMenu?: () => void }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  const user = session?.user as any;

  if (!session) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} className="user-btn">
        <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user?.name}
        </span>
        <span style={{ fontSize: "7px", opacity: 0.4 }}>▼</span>
      </button>
      {open && (
        <div className="dropdown-panel" style={{ right: 0, left: "auto", minWidth: "200px" }}>
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", marginBottom: "4px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{user?.name}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              {user?.role === "admin" ? "Администратор" : user?.passportNumber ? `${user.passportNumber}` : "Гражданин"}
            </div>
          </div>
          <Link href="/profile" className="dropdown-item" onClick={() => { setOpen(false); closeMenu?.(); }}>
            Мой профиль
          </Link>
          <Link href="/settings" className="dropdown-item" onClick={() => { setOpen(false); closeMenu?.(); }}>
            Настройки аккаунта
          </Link>
          <button onClick={() => { signOut({ callbackUrl: "/login" }); setOpen(false); closeMenu?.(); }}
            className="dropdown-item" style={{ color: "var(--red)" }}>
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

function NavLinks({ closeMenu }: { closeMenu?: () => void }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role;

  if (status === "loading" || !session) return null;

  const isPortal = pathname.startsWith("/portal") && !pathname.startsWith("/portal/appeals");
  const isAppeals = pathname.startsWith("/portal/appeals");

  return (
    <>
      <Link href="/portal" onClick={closeMenu}
        className={`topnav-btn${isPortal ? " topnav-active" : ""}`}>
        Портал
      </Link>
      <Link href="/portal/appeals" onClick={closeMenu}
        className={`topnav-btn${isAppeals ? " topnav-active" : ""}`}>
        Обращения
      </Link>
      {role === "admin" && <AdminDropdown closeMenu={closeMenu} />}
    </>
  );
}

export default function TopBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      <header className="topbar">
        {/* Logo → portal */}
        <Link href="/portal" onClick={close} style={{ textDecoration: "none", display: "flex", alignItems: "baseline", gap: "0", flexShrink: 0, marginRight: "16px" }}>
          <span className="logo-slash">//</span>
          <span className="logo-colon">:</span>
          <span className="logo-most">МОСТ</span>
          <span style={{ marginLeft: "8px", alignSelf: "center" }}>
            <AlphaBadge />
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1 }}>
          <Suspense fallback={null}>
            <span className="topbar-nav-desktop">
              <NavLinks />
            </span>
          </Suspense>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Suspense fallback={null}>
            <span className="topbar-nav-desktop">
              <UserMenu closeMenu={close} />
            </span>
          </Suspense>
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="hamburger-btn topbar-nav-mobile" aria-label="Меню">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <>
          <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 88, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
          <div className="mobile-nav-panel">
            <Suspense fallback={null}>
              <NavLinks closeMenu={close} />
              <div className="divider" />
              <UserMenu closeMenu={close} />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}
