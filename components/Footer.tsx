export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)" }}>
      <div className="w-full max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="font-display font-bold text-sm" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
          //:МОСТ
        </span>
        <div className="text-center sm:text-right space-y-0.5">
          <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Портал города-государства Пельгария
          </p>
          <p
            className="text-xs font-medium px-2 py-0.5 rounded inline-block"
            style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            ⚠ Все события, организации и лица являются вымыслом. Проект создан в рамках игры Minecraft.
          </p>
        </div>
      </div>
    </footer>
  );
}
