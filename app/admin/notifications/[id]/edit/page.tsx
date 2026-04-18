"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  { value: "info",    label: "Информация",      icon: "📢", color: "var(--blue)",   bg: "var(--blue-bg)" },
  { value: "warning", label: "Предупреждение",  icon: "⚠️", color: "var(--amber)",  bg: "var(--amber-bg)" },
  { value: "ban",     label: "Блокировка",      icon: "🚫", color: "var(--red)",    bg: "var(--red-bg)" },
  { value: "fine",    label: "Штраф",           icon: "💰", color: "var(--purple)", bg: "var(--purple-bg)" },
] as const;

export default function EditNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [notif, setNotif] = useState<any>(null);
  const [type, setType] = useState("info");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState("");

  useEffect(() => {
    params.then(({ id: pid }) => {
      setId(pid);
      fetch(`/api/notifications/${pid}`).then((r) => r.json()).then((data) => {
        setNotif(data);
        setType(data.type);
        setTitle(data.title);
        setContent(data.content ?? "");
      });
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, content }),
    });
    setSaving(false);
    router.push("/admin/notifications");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };

  if (!notif) return (
    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Загрузка...</div>
  );

  return (
    <div className="page-enter" style={{ maxWidth: "560px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Уведомления
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Редактировать уведомление
        </h1>
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "4px" }}>
          Получатель: {notif.passport_number} — {notif.minecraft_nick}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Type */}
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Тип уведомления
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
            {TYPES.map((t) => (
              <div
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
                  border: `2px solid ${type === t.value ? t.color : "var(--border)"}`,
                  background: type === t.value ? t.bg : "var(--bg-elevated)",
                  transition: "all 0.15s", userSelect: "none",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px", color: t.color, marginBottom: "2px" }}>
                  {t.icon} {t.label}
                </div>
                {type === t.value && (
                  <div style={{ fontSize: "10px", color: t.color, opacity: 0.7 }}>✓ Выбрано</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Заголовок *
          </label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
        </div>

        {/* Content */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Содержание
          </label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
            {saving ? "Сохранение..." : "Сохранить изменения"}
          </button>
          <a href="/admin/notifications" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
