export default function WorldPage() {
  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{
          fontSize: "22px",
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.03em",
          marginBottom: "6px",
        }}>
          Доступ в мир
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Подключение к серверу Пельгарии
        </p>
      </div>

      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "40px 36px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}>
          Пельгария · Minecraft Server
        </div>

        <div style={{
          fontSize: "32px",
          fontWeight: 800,
          color: "var(--text)",
          letterSpacing: "-0.04em",
          fontFamily: "var(--font-display)",
          marginBottom: "12px",
        }}>
          Скоро
        </div>

        <p style={{
          fontSize: "13.5px",
          color: "var(--text-secondary)",
          lineHeight: 1.7,
          maxWidth: "420px",
          margin: "0 auto 32px",
        }}>
          Сервер находится в разработке. Здесь появятся IP-адрес, версия игры,
          список модов и инструкция по подключению.
        </p>

        {/* Placeholder server info block */}
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "8px",
          padding: "16px 20px",
          fontFamily: '"Courier New", monospace',
          fontSize: "12px",
          textAlign: "left",
          color: "var(--text-muted)",
          maxWidth: "360px",
          margin: "0 auto",
        }}>
          <div style={{ marginBottom: "8px", color: "var(--text-secondary)", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-body)" }}>
            Информация о сервере
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--text-muted)" }}>IP-адрес</span>
            <span style={{ color: "var(--border-strong)" }}>— — —</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--text-muted)" }}>Версия</span>
            <span style={{ color: "var(--border-strong)" }}>— — —</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Порт</span>
            <span style={{ color: "var(--border-strong)" }}>— — —</span>
          </div>
        </div>
      </div>
    </div>
  );
}
