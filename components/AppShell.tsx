"use client";
import { usePathname } from "next/navigation";
import CivilianSidebar from "./CivilianSidebar";
import AdminSidebar from "./AdminSidebar";
import { useEffect } from "react";

function MobileBlocker() {
  return (
    <div className="mobile-blocker">
      <div style={{
        width: "60px", height: "60px", borderRadius: "50%",
        border: "1.5px solid var(--glass-border-hi)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "4px", marginBottom: "28px",
        background: "var(--glass-1)",
        backdropFilter: "blur(16px)",
      }}>
        <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--fg)", letterSpacing: "-0.04em" }}>РП</div>
        <div style={{ width: "28px", height: "1px", background: "var(--glass-border-hi)" }} />
        <div style={{ fontSize: "6px", letterSpacing: "0.18em", color: "var(--fg-3)", textTransform: "uppercase" }}>PELGARIA</div>
      </div>
      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--fg-3)", marginBottom: "12px" }}>
        Портал //:МОСТ
      </div>
      <h1 style={{ fontFamily: "var(--ff-display)", fontWeight: 800, fontSize: "1.4rem", color: "var(--fg)", letterSpacing: "-0.04em", marginBottom: "14px" }}>
        Мобильная версия<br />в разработке
      </h1>
      <p style={{ fontSize: "13px", color: "var(--fg-3)", lineHeight: 1.65, maxWidth: "300px" }}>
        Портал Пельгарии оптимизирован для работы на компьютере.
        Мобильная версия появится в ближайшее время.
      </p>
      <div style={{
        marginTop: "36px", padding: "10px 20px", borderRadius: "8px",
        border: "1px solid var(--glass-border-hi)",
        fontSize: "11px", color: "var(--fg-3)", fontFamily: "var(--ff-mono)", letterSpacing: "0.08em",
      }}>
        MOBILE · COMING SOON
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved && saved !== "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  if (pathname === "/login") return (
    <>
      <MobileBlocker />
      {children}
    </>
  );

  if (pathname.endsWith("/print")) return <>{children}</>;

  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      <MobileBlocker />
      <div className="app-shell" style={{ position: "relative", zIndex: 3 }}>
        {isAdmin ? <AdminSidebar /> : <CivilianSidebar />}
        <main style={{
          minHeight: "100vh",
          padding: "40px 48px 64px",
          minWidth: 0,
          overflow: "hidden",
        }}>
          {children}
        </main>
      </div>
    </>
  );
}
