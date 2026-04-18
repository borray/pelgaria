"use client";

import { useState } from "react";

type Passport = {
  id: number;
  passport_number: string;
  minecraft_nick: string;
  full_name: string | null;
};

type NotificationType = "info" | "warning" | "ban" | "fine";

const TYPE_INFO: Record<NotificationType, { label: string; desc: string; icon: string; color: string; bg: string; border: string }> = {
  info: {
    label: "Информация",
    desc: "Общее уведомление",
    icon: "i",
    color: "var(--blue)",
    bg: "var(--blue-bg)",
    border: "rgba(96,165,250,0.35)",
  },
  warning: {
    label: "Предупреждение",
    desc: "Официальное предупреждение",
    icon: "!",
    color: "var(--amber)",
    bg: "var(--amber-bg)",
    border: "rgba(251,191,36,0.35)",
  },
  ban: {
    label: "Блокировка",
    desc: "Бан на сервере",
    icon: "x",
    color: "var(--red)",
    bg: "var(--red-bg)",
    border: "rgba(248,113,113,0.35)",
  },
  fine: {
    label: "Штраф",
    desc: "Денежный штраф",
    icon: "R",
    color: "var(--text-secondary)",
    bg: "var(--bg-hover)",
    border: "rgba(161,161,170,0.35)",
  },
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
  color: "var(--text)", fontSize: "13.5px", outline: "none",
  fontFamily: "var(--font-body)",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600,
  color: "var(--text-muted)", marginBottom: "6px",
  textTransform: "uppercase", letterSpacing: "0.07em",
};

interface Props {
  passports: Passport[];
  action: (fd: FormData) => Promise<void>;
}

export default function NotificationForm({ passports, action }: Props) {
  const [selectedType, setSelectedType] = useState<NotificationType>("info");

  if (passports.length === 0) {
    return (
      <div className="page-enter" style={{ maxWidth: "560px" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Уведомления
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Отправить уведомление
          </h1>
        </div>
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)" }}>Нет граждан с паспортами</p>
          <a href="/admin/passports/new" className="btn-primary" style={{ marginTop: "14px", display: "inline-flex" }}>
            Выдать первый паспорт
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ maxWidth: "560px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Уведомления
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Отправить уведомление
        </h1>
      </div>

      <form action={action} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Hidden input carries selected type to server action */}
        <input type="hidden" name="type" value={selectedType} />

        {/* Recipient */}
        <div>
          <label style={labelStyle}>Получатель *</label>
          <select name="passport_id" required style={inputStyle}>
            {passports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.passport_number} — {p.minecraft_nick}{p.full_name ? ` (${p.full_name})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Type selector */}
        <div>
          <label style={labelStyle}>Тип уведомления *</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {(Object.entries(TYPE_INFO) as [NotificationType, typeof TYPE_INFO[NotificationType]][]).map(([value, info]) => {
              const isSelected = selectedType === value;
              return (
                <div
                  key={value}
                  onClick={() => setSelectedType(value)}
                  style={{
                    padding: "12px 14px", borderRadius: "10px", cursor: "pointer",
                    border: isSelected ? `1.5px solid ${info.border}` : "1px solid var(--border)",
                    background: isSelected ? info.bg : "var(--bg-surface)",
                    boxShadow: isSelected ? `0 0 16px ${info.border}` : "none",
                    transition: "all 0.15s",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "14px", lineHeight: 1, color: isSelected ? info.color : "var(--text-muted)" }}>{info.icon}</span>
                    <span style={{
                      fontWeight: 700, fontSize: "13px",
                      color: isSelected ? info.color : "var(--text)",
                    }}>
                      {info.label}
                    </span>
                    {isSelected && (
                      <span style={{
                        marginLeft: "auto", fontSize: "10px", fontWeight: 700,
                        color: info.color, letterSpacing: "0.06em",
                      }}>
                        ✓
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "11.5px", color: isSelected ? info.color : "var(--text-muted)", opacity: isSelected ? 0.8 : 1 }}>
                    {info.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>Заголовок *</label>
          <input
            name="title"
            required
            placeholder="Например: Предупреждение за нарушение правил"
            style={inputStyle}
          />
        </div>

        {/* Content */}
        <div>
          <label style={labelStyle}>Содержание</label>
          <textarea
            name="content"
            rows={4}
            placeholder="Подробное описание уведомления..."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {/* TTL */}
        <div>
          <label style={labelStyle}>Срок действия</label>
          <select name="ttl" style={inputStyle}>
            <option value="">Без срока (постоянное)</option>
            <option value="1">24 часа</option>
            <option value="3">3 дня</option>
            <option value="7">7 дней</option>
            <option value="30">30 дней</option>
          </select>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            После истечения уведомление автоматически скроется у получателя
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Отправить</button>
          <a href="/admin" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
