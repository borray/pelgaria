import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function RootPage() {
  const session = await auth();
  if (session) redirect("/profile");

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Subtle grid background ────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 30%, black 30%, transparent 100%)",
      }} />

      {/* ── Top bar ──────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        borderBottom: "1px solid var(--border)",
        padding: "0 60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "56px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
          <span className="logo-slash">//</span>
          <span className="logo-colon">:</span>
          <span className="logo-most">МОСТ</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/verify" style={{
            padding: "6px 14px", borderRadius: "7px",
            border: "1px solid var(--border-strong)",
            color: "var(--text-muted)", fontSize: "12.5px",
            textDecoration: "none", transition: "color 0.15s, border-color 0.15s",
          }}>
            Проверить документ
          </Link>
          <Link href="/login" className="btn-primary" style={{ fontSize: "12.5px", padding: "6px 16px" }}>
            Войти
          </Link>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
        padding: "0 60px", position: "relative", zIndex: 1,
      }}>
        <div style={{ maxWidth: "680px" }}>

          {/* Label */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "5px 12px", borderRadius: "20px",
            border: "1px solid var(--border-strong)",
            marginBottom: "28px",
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--green-soft)" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Официальный портал · 2026
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: "clamp(3rem, 7vw, 5.5rem)",
            color: "var(--text)", letterSpacing: "-0.06em",
            lineHeight: 0.95, marginBottom: "32px",
          }}>
            Республика<br />
            <span style={{ color: "var(--text-muted)" }}>Пельгария</span>
          </h1>

          {/* Divider */}
          <div style={{ width: "48px", height: "2px", background: "var(--border-strong)", marginBottom: "28px" }} />

          {/* Description */}
          <p style={{
            fontSize: "16px", color: "var(--text-muted)",
            lineHeight: 1.7, maxWidth: "480px", marginBottom: "44px",
          }}>
            Государственная информационная система —
            реестр граждан, нормативные документы
            и сервисы верификации.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link href="/login" className="btn-primary" style={{ fontSize: "15px", padding: "12px 32px" }}>
              Войти в систему
            </Link>
            <Link href="/verify" style={{
              fontSize: "14px", color: "var(--text-muted)",
              textDecoration: "none", display: "flex", alignItems: "center", gap: "6px",
              padding: "12px 20px", borderRadius: "8px",
              border: "1px solid var(--border-strong)",
              transition: "color 0.15s, border-color 0.15s",
            }}>
              Проверить документ
            </Link>
          </div>
        </div>

        {/* ── Right side decoration ─────────── */}
        <div style={{
          position: "absolute", right: "60px", top: "50%",
          transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", gap: "8px",
          opacity: 0.7,
        }}>
          {[
            { label: "Документов", value: "—" },
            { label: "Граждан",    value: "—" },
            { label: "Ведомств",   value: "4" },
          ].map(item => (
            <div key={item.label} style={{
              padding: "20px 24px", borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              minWidth: "160px",
            }}>
              <div style={{ fontFamily: "monospace", fontSize: "2rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>
                {item.value}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        borderTop: "1px solid var(--border)",
        padding: "0 60px",
        height: "52px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: "32px" }}>
          {["Законы и указы", "Реестр граждан", "Верификация", "Обращения"].map(item => (
            <span key={item} style={{ fontSize: "11.5px", color: "var(--text-muted)", letterSpacing: "0.02em" }}>
              {item}
            </span>
          ))}
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.06em" }}>
          PELGARIA · //:МОСТ
        </span>
      </div>
    </div>
  );
}
