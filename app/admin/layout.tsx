import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import SignOutBtn from "./SignOutBtn";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div style={{ minHeight: "100svh", background: "var(--bg)" }}>
      <nav className="admin-topbar">
        <Link href="/admin" className="admin-logo">
          <span className="sl">//</span>
          <span className="co">:</span>
          <span className="nm">МОСТ</span>
        </Link>

        <div className="admin-nav">
          <Link href="/admin" className="admin-nav-link">Панель</Link>
          <Link href="/admin/universes" className="admin-nav-link">Вселенные</Link>
        </div>

        <div className="admin-topbar-right">
          <span className="admin-user">{session.user.name}</span>
          <ThemeToggle />
          <SignOutBtn />
        </div>
      </nav>

      {children}
    </div>
  );
}
