import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px", textAlign: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        fontFamily: "monospace", fontSize: "clamp(5rem, 16vw, 9rem)",
        fontWeight: 900, color: "var(--border-strong)",
        lineHeight: 1, marginBottom: "16px", letterSpacing: "-0.06em",
        userSelect: "none",
      }}>
        404
      </div>
      <div style={{
        fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.2em", color: "var(--text-muted)", marginBottom: "12px",
      }}>
        Архив Пельгарии
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: "1.5rem", color: "var(--text)",
        letterSpacing: "-0.03em", marginBottom: "10px",
      }}>
        Документ не найден
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.65, maxWidth: "340px", marginBottom: "32px" }}>
        Запрашиваемый раздел отсутствует в реестре или был удалён.
        Проверьте адрес или вернитесь в начало.
      </p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/portal" className="btn-primary" style={{ fontSize: "13px" }}>
          На портал
        </Link>
        <Link href="/verify" className="btn-secondary" style={{ fontSize: "13px" }}>
          Проверить документ
        </Link>
      </div>
      <div style={{ marginTop: "40px", fontSize: "10px", color: "var(--border-strong)", fontFamily: "monospace", letterSpacing: "0.1em" }}>
        PELGARIA · //:МОСТ
      </div>
    </div>
  );
}
