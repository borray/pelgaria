"use client";
import { usePathname } from "next/navigation";
import CivilianSidebar from "./CivilianSidebar";
import AdminSidebar from "./AdminSidebar";
import { useEffect } from "react";

function MobileBlocker() {
  return (
    <div className="mobile-blocker">
      {/* Emblem */}
      <div style={{
        width: "60px", height: "60px", borderRadius: "50%",
        border: "1.5px solid var(--border-strong)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "4px", marginBottom: "28px",
        background: "var(--bg-surface)",
      }}>
        <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.04em" }}>РП</div>
        <div style={{ width: "28px", height: "1px", background: "var(--border-strong)" }} />
        <div style={{ fontSize: "6px", letterSpacing: "0.18em", color: "var(--text-muted)", textTransform: "uppercase" }}>PELGARIA</div>
      </div>

      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--text-muted)", marginBottom: "12px" }}>
        Портал //:МОСТ
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem",
        color: "var(--text)", letterSpacing: "-0.04em", marginBottom: "14px",
      }}>
        Мобильная версия<br />в разработке
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.65, maxWidth: "300px" }}>
        Портал Пельгарии оптимизирован для работы на компьютере.
        Мобильная версия появится в ближайшее время.
      </p>
      <div style={{
        marginTop: "36px", padding: "10px 20px", borderRadius: "8px",
        border: "1px solid var(--border-strong)",
        fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.08em",
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
    if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
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
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {isAdmin ? <AdminSidebar /> : <CivilianSidebar />}
        <main style={{
          flex: 1,
          marginLeft: "240px",
          minHeight: "100vh",
          padding: "40px 52px 64px",
          background: "var(--bg)",
          maxWidth: "calc(100vw - 240px)",
        }}>
          {children}
        </main>
      </div>
    </>
  );
}
