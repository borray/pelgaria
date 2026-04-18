"use client";

import { useState } from "react";

export default function AlphaBadge() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className="alpha-label" onClick={() => setOpen(true)}>
        alpha
      </span>

      {open && (
        <div className="alpha-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="alpha-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "8px",
                background: "var(--blue-bg)", border: "1px solid rgba(96,165,250,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px",
              }}>
                🧪
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)", fontFamily: "var(--font-display)" }}>
                  Ранняя версия
                </div>
                <div style={{ fontSize: "11px", color: "var(--blue)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Alpha build
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {[
                { icon: "⚠️", text: "Портал находится в активной разработке. Возможны ошибки и нестабильная работа." },
                { icon: "🔄", text: "Данные, интерфейс и функции могут кардинально измениться без предупреждения." },
                { icon: "🎮", text: "Это внутренний портал проекта Minecraft «Пельгария». Все события — вымысел." },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: "10px", alignItems: "flex-start",
                  padding: "10px 12px", borderRadius: "8px",
                  background: "var(--bg-hover)", border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{item.icon}</span>
                  <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
