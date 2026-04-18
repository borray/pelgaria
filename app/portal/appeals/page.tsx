import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPassportById, getPassportByUserId, getAppealsByPassport } from "@/lib/db";
import Link from "next/link";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_INFO: Record<string, { label: string; css: string }> = {
  pending:   { label: "На рассмотрении", css: "appeal-pending" },
  in_review: { label: "В работе",        css: "appeal-in_review" },
  resolved:  { label: "Рассмотрено",     css: "appeal-resolved" },
  rejected:  { label: "Отклонено",       css: "appeal-rejected" },
};

export default async function MyAppealsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;
  let passport = user?.passportId ? getPassportById(Number(user.passportId)) : undefined;
  if (!passport && user?.id && !String(user.id).startsWith("passport:")) {
    passport = getPassportByUserId(Number(user.id));
  }
  if (!passport) redirect("/profile");

  const appeals = getAppealsByPassport(passport.id);

  return (
    <div className="page-enter" style={{ maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
            Мои обращения
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", color: "var(--text)", letterSpacing: "-0.04em" }}>
            Обращения в ведомства
          </h1>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "4px" }}>
            Паспорт: {passport.passport_number} — {passport.minecraft_nick}
          </p>
        </div>
        <Link href="/portal/appeals/new" className="btn-primary">Новое обращение</Link>
      </div>

      {appeals.length === 0 ? (
        <div style={{ padding: "56px 24px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "12px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Обращений ещё нет</p>
          <Link href="/portal/appeals/new" className="btn-primary">Подать первое обращение</Link>
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {appeals.map((a) => {
            const s = STATUS_INFO[a.status] ?? STATUS_INFO.pending;
            return (
              <div key={a.id} className="card-glow" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text)" }}>{a.subject}</span>
                      <span className={`badge ${s.css}`}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {a.dept_name} · {fmt(a.created_at)}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: a.response ? "12px" : 0 }}>
                  {a.content.length > 200 ? a.content.slice(0, 200) + "…" : a.content}
                </div>

                {a.response && (
                  <div style={{
                    marginTop: "12px", padding: "12px 14px", borderRadius: "8px",
                    background: a.status === "resolved" ? "var(--green-bg)" : "var(--amber-bg)",
                    borderLeft: `3px solid ${a.status === "resolved" ? "var(--green)" : "var(--amber)"}`,
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Ответ ведомства
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text)" }}>{a.response}</div>
                    {a.responded_by_name && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>— {a.responded_by_name}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
