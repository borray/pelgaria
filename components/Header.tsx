"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/documents", label: "Документы" },
  { href: "/documents?cat=laws", label: "Законы" },
  { href: "/documents?cat=decrees", label: "Указы" },
  { href: "/documents?cat=history", label: "История" },
];

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as { role?: string })?.role;

  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
      <div className="w-full max-w-5xl mx-auto px-4">
        {/* Top row */}
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="font-display font-bold text-xl tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            //:МОСТ
          </Link>

          <div className="flex items-center gap-2 text-sm">
            {session ? (
              <>
                {role === "admin" && (
                  <Link
                    href="/admin"
                    className="px-3 py-1.5 rounded-md text-sm font-medium"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    Панель
                  </Link>
                )}
                <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-1.5 rounded-md text-sm cursor-pointer"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "transparent" }}
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md text-sm font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Войти
              </Link>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex gap-0.5">
          {NAV.map((link) => {
            const isActive = link.href === "/documents"
              ? pathname === "/documents"
              : pathname.startsWith(link.href.split("?")[0]) || pathname.includes(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2.5 text-sm"
                style={{
                  color: isActive ? "var(--text)" : "var(--text-muted)",
                  fontWeight: isActive ? 500 : 400,
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  fontFamily: "var(--font-body)",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
