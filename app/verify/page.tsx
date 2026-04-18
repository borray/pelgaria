export const dynamic = 'force-dynamic';

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPassportByIdentifier } from "@/lib/db";
import { generateIdentifier } from "@/lib/passport-identifier";
import Link from "next/link";

const CITIZENSHIP_LABELS: Record<string, string> = {
  resident: "Житель", citizen: "Гражданин", honorary: "Почётный гражданин",
};
const STATUS_INFO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:       { label: "Действителен",        color: "var(--green)",  bg: "var(--green-bg)",  border: "rgba(74,222,128,0.2)" },
  blocked:      { label: "Заблокирован",         color: "var(--red)",    bg: "var(--red-bg)",    border: "rgba(248,113,113,0.2)" },
  wanted:       { label: "В розыске",            color: "var(--red)",    bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
  deactivating: { label: "Проходит деактивацию", color: "var(--amber)",  bg: "var(--amber-bg)",  border: "rgba(251,191,36,0.2)" },
  frozen:       { label: "Заморожен",            color: "var(--blue)",   bg: "var(--blue-bg)",   border: "rgba(96,165,250,0.2)" },
  suspended:    { label: "Отстранён",            color: "var(--purple)", bg: "var(--purple-bg)", border: "rgba(167,139,250,0.2)" },
  deceased:     { label: "Выбыл",                color: "var(--text-muted)", bg: "var(--bg-elevated)", border: "var(--border-strong)" },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "admin") redirect("/portal");

  const { q } = await searchParams;
  const query = q?.trim().toUpperCase() ?? "";

  let passport: ReturnType<typeof getPassportByIdentifier> = undefined;

  if (query) {
    passport = getPassportByIdentifier(query);
  }

  const ident = passport ? generateIdentifier(passport.id, passport.passport_number) : null;
  const statusInfo = passport ? (STATUS_INFO[passport.status] ?? STATUS_INFO.active) : null;

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", padding: "48px 24px" }} className="page-enter">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: "36px", textAlign: "center" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          border: "1.5px solid var(--border-strong)", margin: "0 auto 18px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
          background: "var(--bg-surface)",
        }}>
          <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.04em" }}>РП</span>
          <div style={{ width: "24px", height: "1px", background: "var(--border-strong)" }} />
          <span style={{ fontSize: "6.5px", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>Pelgaria</span>
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "1.5rem", color: "var(--text)",
          letterSpacing: "-0.04em", marginBottom: "8px",
        }}>
          Верификация документа
        </h1>
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" }}>
          Введите идентификатор верификации в формате{" "}
          <span style={{ fontFamily: "monospace" }}>PLGR-XXXX-XXXX</span>
        </p>
        <div style={{
          marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "3px 10px", borderRadius: "20px",
          background: "var(--amber-bg)", border: "1px solid rgba(251,191,36,0.2)",
        }}>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--amber)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Только для администраторов
          </span>
        </div>
      </div>

      {/* ── Search form ──────────────────────────────────────────── */}
      <form method="GET" style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="PLGR-ABCD-1234"
          autoFocus
          className="hero-search"
          style={{ fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}
        />
        <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>Найти</button>
      </form>

      {/* ── Not found ────────────────────────────────────────────── */}
      {query && !passport && (
        <div style={{
          padding: "32px 24px", borderRadius: "12px", textAlign: "center",
          border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
        }}>
          <div style={{ fontFamily: "monospace", fontSize: "24px", color: "var(--border-strong)", marginBottom: "10px" }}>—</div>
          <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)", marginBottom: "6px" }}>Документ не найден</div>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
            Идентификатор <span style={{ fontFamily: "monospace" }}>{query}</span> не зарегистрирован
          </p>
        </div>
      )}

      {/* ── Result card ──────────────────────────────────────────── */}
      {passport && statusInfo && (
        <div style={{
          borderRadius: "14px", overflow: "hidden",
          border: `1px solid ${statusInfo.border}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}>
          {/* Status header */}
          <div style={{
            padding: "16px 20px",
            background: statusInfo.bg,
            borderBottom: `1px solid ${statusInfo.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: statusInfo.color, flexShrink: 0 }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: statusInfo.color, letterSpacing: "-0.01em" }}>
                {statusInfo.label}
              </span>
            </div>
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              {passport.passport_number}
            </span>
          </div>

          {/* Main content */}
          <div style={{ padding: "20px 24px", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ flexShrink: 0, borderRadius: "8px", overflow: "hidden", border: "2px solid var(--border-strong)", width: "48px", height: "48px", background: "var(--bg-elevated)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(passport.minecraft_nick)}/48`}
                  alt={passport.minecraft_nick}
                  width={48} height={48}
                  style={{ display: "block", imageRendering: "pixelated" }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>{passport.minecraft_nick}</div>
                {passport.full_name && <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>{passport.full_name}</div>}
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {CITIZENSHIP_LABELS[passport.citizenship_level] ?? passport.citizenship_level}
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--border)" }} />

            {/* Identifier */}
            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "5px" }}>
                Идентификатор верификации
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: "var(--text)", letterSpacing: "0.2em" }}>
                {ident}
              </div>
            </div>

            {/* Admin actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <Link href={`/admin/passports/${passport.id}/edit`} className="btn-secondary" style={{ fontSize: "12px", flex: 1, justifyContent: "center" }}>
                Редактировать
              </Link>
              <Link href={`/admin/passports/${passport.id}/print`} className="btn-secondary" style={{ fontSize: "12px", flex: 1, justifyContent: "center" }}>
                Распечатать
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "10px 20px",
            background: "var(--bg-elevated)",
            borderTop: "1px solid var(--border)",
            fontSize: "10.5px", color: "var(--text-muted)", textAlign: "center",
            letterSpacing: "0.04em",
          }}>
            Республика Пельгария · Административная система верификации
          </div>
        </div>
      )}

      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Link href="/admin" style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}>
          ← Панель управления
        </Link>
      </div>
    </div>
  );
}
