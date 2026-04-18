import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPassportById, getPassportByUserId, getNotificationsByPassport } from "@/lib/db";
import { generateIdentifier } from "@/lib/passport-identifier";
import Link from "next/link";
import NotificationsList from "@/components/NotificationsList";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

const CITIZENSHIP_LABELS: Record<string, string> = {
  resident: "Житель", citizen: "Гражданин", honorary: "Почётный гражданин",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Активен", blocked: "Заблокирован", wanted: "В розыске",
  deactivating: "Деактивируется", frozen: "Заморожен",
  temp_frozen: "Вр. заморожен", suspended: "Отстранён", deceased: "Выбыл",
};
const LEVEL_GRADIENT: Record<string, string> = {
  citizen:  "linear-gradient(135deg, rgba(37,99,235,0.14) 0%, rgba(37,99,235,0.03) 100%)",
  honorary: "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.04) 100%)",
  resident: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)",
};
const LEVEL_BORDER: Record<string, string> = {
  citizen:  "rgba(37,99,235,0.25)",
  honorary: "rgba(124,58,237,0.3)",
  resident: "var(--border-strong)",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;
  const isAdmin = user?.role === "admin";

  let passport: ReturnType<typeof getPassportById> = undefined;
  if (user?.passportId) passport = getPassportById(Number(user.passportId));
  if (!passport && user?.id && !String(user.id).startsWith("passport:")) {
    passport = getPassportByUserId(Number(user.id));
  }

  const notifications = passport ? getNotificationsByPassport(passport.id) : [];
  const ident = passport ? generateIdentifier(passport.id, passport.passport_number) : null;
  const isPassportLogin = String(user.id ?? "").startsWith("passport:");

  const headerGradient = passport ? (LEVEL_GRADIENT[passport.citizenship_level] ?? LEVEL_GRADIENT.resident) : LEVEL_GRADIENT.resident;
  const headerBorder = passport ? (LEVEL_BORDER[passport.citizenship_level] ?? LEVEL_BORDER.resident) : LEVEL_BORDER.resident;

  return (
    <div className="page-enter" style={{ maxWidth: "680px", margin: "0 auto" }}>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "6px" }}>
            Личный кабинет
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.9rem", color: "var(--text)", letterSpacing: "-0.05em", lineHeight: 1.1 }}>
            {user?.name}
          </h1>
          {isAdmin && !passport && (
            <span className="badge" style={{ marginTop: "8px", background: "var(--amber-bg)", color: "var(--amber)", display: "inline-block" }}>
              Администратор
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <Link href="/settings" className="btn-secondary" style={{ fontSize: "12px" }}>
            {isPassportLogin ? "Сменить PIN" : "Настройки"}
          </Link>
        </div>
      </div>

      {passport ? (
        <>
          {/* ── Passport card ─────────────────────────────────────── */}
          <div style={{
            marginBottom: "20px", borderRadius: "14px", overflow: "hidden",
            border: `1px solid ${headerBorder}`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.2)`,
          }}>

            {/* Card header */}
            <div style={{
              padding: "22px 24px",
              background: headerGradient,
              borderBottom: `1px solid ${headerBorder}`,
              display: "flex", alignItems: "center", gap: "18px",
            }}>
              {/* Avatar */}
              <div style={{
                flexShrink: 0, borderRadius: "10px", overflow: "hidden",
                border: `2px solid ${headerBorder}`,
                width: "64px", height: "64px", background: "var(--bg-elevated)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(passport.minecraft_nick)}/64`}
                  alt={passport.minecraft_nick}
                  width={64} height={64}
                  style={{ display: "block", imageRendering: "pixelated" }}
                />
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: "6px" }}>
                  Паспорт гражданина Пельгарии
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 700, color: "var(--text)", letterSpacing: "0.06em", lineHeight: 1 }}>
                  {passport.passport_number}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "5px" }}>
                  {passport.full_name ?? passport.minecraft_nick}
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end", flexShrink: 0 }}>
                <span
                  className={`badge status-${passport.status}`}
                  style={passport.status === "wanted" ? { animation: "pulse-wanted 1.5s ease-in-out infinite" } : undefined}
                >
                  {STATUS_LABELS[passport.status] ?? passport.status}
                </span>
                <span className={`badge status-${passport.citizenship_level}`}>
                  {CITIZENSHIP_LABELS[passport.citizenship_level] ?? passport.citizenship_level}
                </span>
              </div>
            </div>

            {/* Card fields */}
            <div style={{ padding: "20px 24px", background: "var(--bg-surface)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              {[
                { label: "Никнейм в Minecraft", value: passport.minecraft_nick },
                { label: "Полное имя", value: passport.full_name ?? "—" },
                { label: "Дата выдачи", value: fmt(passport.issue_date ?? passport.created_at) },
                { label: "Выдан", value: passport.issued_by_custom ?? passport.issued_by_name ?? "Администрация Пельгарии" },
              ].map((f) => (
                <div key={f.label}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "4px" }}>
                    {f.label}
                  </div>
                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: "13.5px" }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Identifier strip */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
            }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "5px" }}>
                  Идентификатор верификации
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: 700, color: "var(--text)", letterSpacing: "0.2em" }}>
                  {ident}
                </div>
              </div>
              <Link href={`/verify?q=${ident}`} className="btn-secondary" style={{ fontSize: "12px", flexShrink: 0 }}>
                Проверить →
              </Link>
            </div>

            {/* Notes */}
            {passport.notes && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", background: "var(--amber-bg)", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--amber)", fontWeight: 700, flexShrink: 0 }}>Заметка:</span>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{passport.notes}</span>
              </div>
            )}
          </div>

          {/* ── Notifications ─────────────────────────────────────── */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "12px" }}>
              Уведомления
            </div>
            <NotificationsList initialNotifs={notifications as any} />
          </div>
        </>
      ) : (
        <div style={{
          padding: "40px", textAlign: "center", borderRadius: "14px",
          border: "1px dashed var(--border-strong)", marginBottom: "20px",
          background: "var(--bg-surface)",
        }}>
          <div style={{ fontFamily: "monospace", fontSize: "28px", color: "var(--border-strong)", marginBottom: "12px" }}>—</div>
          <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)", marginBottom: "6px" }}>Паспорт не привязан</div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
            К аккаунту не привязан паспорт гражданина
          </p>
          {isAdmin && (
            <Link href="/admin/passports/new" className="btn-primary" style={{ display: "inline-flex" }}>
              Создать паспорт
            </Link>
          )}
        </div>
      )}

      {/* ── Portal link ───────────────────────────────────────────── */}
      <Link href="/portal" className="card" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px", borderRadius: "12px", textDecoration: "none",
        background: "var(--bg-elevated)",
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>Перейти на портал</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Законы, указы и документы Пельгарии</div>
        </div>
        <span style={{ fontSize: "18px", color: "var(--text-muted)" }}>→</span>
      </Link>
    </div>
  );
}
