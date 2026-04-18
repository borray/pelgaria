"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MAIN_NAV = [
  { href: "/",          label: "Главная",        exact: true },
  { href: "/documents", label: "Все документы",  exact: true },
];

const CAT_NAV = [
  { href: "/documents?cat=laws",     label: "Законы" },
  { href: "/documents?cat=decrees",  label: "Указы" },
  { href: "/documents?cat=history",  label: "История" },
  { href: "/documents?cat=news",     label: "Новости" },
  { href: "/documents?cat=citizens", label: "Граждане" },
];

const CAT_NAV_AUTH = [
  ...CAT_NAV,
  { href: "/documents?cat=internal", label: "Внутренние" },
];

const ADMIN_NAV = [
  { href: "/admin",                label: "Обзор",          exact: true },
  { href: "/admin/documents",      label: "Документы",      exact: true },
  { href: "/admin/documents/new",  label: "Новый документ", exact: true },
  { href: "/admin/users",          label: "Пользователи",   exact: true },
];

function Label({ children }: { children: string }) {
  return (
    <div style={{
      padding: "14px 10px 5px", fontSize: "10px", fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.1em",
      color: "var(--text-muted)", userSelect: "none",
    }}>
      {children}
    </div>
  );
}

function NavLinks({ items, onClose }: { items: { href: string; label: string; exact?: boolean }[]; onClose?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat");

  return (
    <>
      {items.map((item) => {
        const [p, q] = item.href.split("?");
        const itemCat = q ? new URLSearchParams(q).get("cat") : null;
        const active = item.exact
          ? (itemCat ? pathname === p && cat === itemCat : pathname === p && !cat)
          : pathname.startsWith(p);

        return (
          <Link key={item.href} href={item.href} onClick={onClose} className={`nav-item${active ? " active" : ""}`}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-subtle)", borderRight: "1px solid var(--border)" }}>
      {/* Logo */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
        <Link href="/" onClick={onClose} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "7px",
            background: "var(--accent)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "11px",
            letterSpacing: "-0.04em", flexShrink: 0,
          }}>
            М
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px", color: "var(--text)", letterSpacing: "-0.03em" }}>
                МОСТ
              </span>
              <span className="alpha-label">alpha</span>
            </div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "-1px" }}>
              Портал Пельгарии
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 6px" }}>
        <Suspense fallback={<div style={{ padding: "10px", color: "var(--text-muted)", fontSize: "12px" }}>Загрузка...</div>}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <NavLinks items={MAIN_NAV} onClose={onClose} />
          </div>

          <Label>Разделы</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <NavLinks items={session ? CAT_NAV_AUTH : CAT_NAV} onClose={onClose} />
          </div>

          {role === "admin" && (
            <>
              <Label>Управление</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <NavLinks items={ADMIN_NAV} onClose={onClose} />
              </div>
            </>
          )}
        </Suspense>
      </nav>

      {/* User */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "10px 8px" }}>
        {session ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 10px" }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: "var(--accent)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: 700, flexShrink: 0,
              }}>
                {session.user?.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.user?.name}
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                  {role === "admin" ? "Администратор" : "Гражданин"}
                </div>
              </div>
            </div>
            <button onClick={() => { signOut({ callbackUrl: "/" }); onClose?.(); }} className="nav-item" style={{ fontSize: "12px" }}>
              Выйти
            </button>
          </div>
        ) : (
          <Link href="/login" onClick={onClose} className="btn-primary" style={{ width: "100%" }}>
            Войти
          </Link>
        )}

        <div style={{ padding: "8px 10px 2px", fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Все события и организации являются вымыслом. Проект Minecraft.
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  return <SidebarInner onClose={onClose} />;
}
