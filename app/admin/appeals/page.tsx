export const dynamic = 'force-dynamic';

import { getAllAppeals, respondToAppeal, getAllDepartments } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_INFO: Record<string, { label: string; css: string }> = {
  pending:   { label: "На рассмотрении", css: "appeal-pending" },
  in_review: { label: "В работе",        css: "appeal-in_review" },
  resolved:  { label: "Рассмотрено",     css: "appeal-resolved" },
  rejected:  { label: "Отклонено",       css: "appeal-rejected" },
};

export default async function AdminAppealsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  let appeals = getAllAppeals();
  if (status) appeals = appeals.filter((a) => a.status === status);

  async function handleRespond(formData: FormData) {
    "use server";
    const s = await auth();
    const adminId = Number((s?.user as any)?.id ?? 1);
    respondToAppeal(Number(formData.get("id")), {
      status: formData.get("status") as string,
      response: formData.get("response") as string,
      responded_by: adminId,
    });
    revalidatePath("/admin/appeals");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: "7px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13px", outline: "none",
    fontFamily: "var(--font-body)",
  };

  const filters = ["", "pending", "in_review", "resolved", "rejected"];

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Управление
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Обращения граждан ({getAllAppeals().length})
        </h1>
      </div>

      {/* Status filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {filters.map((f) => {
          const s = f ? STATUS_INFO[f] : null;
          const active = f === (status ?? "");
          return (
            <a key={f} href={f ? `/admin/appeals?status=${f}` : "/admin/appeals"}
              className={active ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: "12px", padding: "5px 12px", textDecoration: "none" }}>
              {s ? s.label : "Все"}
            </a>
          );
        })}
      </div>

      {appeals.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)" }}>Нет обращений</p>
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {appeals.map((a) => {
            const s = STATUS_INFO[a.status] ?? STATUS_INFO.pending;
            return (
              <div key={a.id} style={{
                borderRadius: "10px", border: "1px solid var(--border)",
                background: "var(--bg-surface)", overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--text)" }}>{a.subject}</span>
                      <span className={`badge ${s.css}`}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {a.dept_name} · {a.passport_number} ({a.minecraft_nick}) · {fmt(a.created_at)}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {a.content}
                </div>

                {/* Existing response */}
                {a.response && (
                  <div style={{ padding: "10px 18px", background: "var(--green-bg)", borderBottom: "1px solid var(--border)", fontSize: "12.5px" }}>
                    <span style={{ fontWeight: 600, color: "var(--green-soft)" }}>Ответ: </span>
                    <span style={{ color: "var(--text-secondary)" }}>{a.response}</span>
                  </div>
                )}

                {/* Respond form */}
                {a.status !== "resolved" && a.status !== "rejected" && (
                  <form action={handleRespond} style={{ padding: "14px 18px", display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={a.id} />
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <textarea name="response" rows={2} required placeholder="Ответ гражданину..."
                        style={{ ...inputStyle, resize: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <select name="status" style={{ ...inputStyle, width: "auto" }} defaultValue="resolved">
                        <option value="in_review">В работу</option>
                        <option value="resolved">Рассмотрено</option>
                        <option value="rejected">Отклонить</option>
                      </select>
                      <button type="submit" className="btn-primary" style={{ fontSize: "12px", padding: "7px 14px" }}>
                        Ответить
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
