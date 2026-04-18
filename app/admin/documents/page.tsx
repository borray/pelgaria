import { getAllDocuments, getAllDepartments, deleteDocument } from "@/lib/db";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import ConfirmButton from "@/components/ConfirmButton";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; status?: string; access?: string }>;
}) {
  const { dept, status, access } = await searchParams;
  const allDocs = getAllDocuments();
  const departments = getAllDepartments();

  async function handleDelete(formData: FormData) {
    "use server";
    deleteDocument(Number(formData.get("id")));
    revalidatePath("/admin/documents");
    revalidatePath("/portal");
  }

  const ACCESS: Record<string, { label: string; color: string; bg: string }> = {
    public:     { label: "Публичный",    color: "var(--green-soft)", bg: "var(--green-bg)" },
    restricted: { label: "Для граждан", color: "var(--amber)",      bg: "var(--amber-bg)" },
    secret:     { label: "Секретный",   color: "var(--red)",        bg: "var(--red-bg)"   },
  };

  // Apply filters
  const docs = allDocs.filter(doc => {
    if (dept   && String(doc.department_id) !== dept)  return false;
    if (status === "published" && !doc.published)       return false;
    if (status === "draft"     && doc.published)        return false;
    if (access && doc.access_level !== access)          return false;
    return true;
  });

  const hasFilters = dept || status || access;

  const selectStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: "7px", fontSize: "12px",
    border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
    color: "var(--text)", fontFamily: "inherit", outline: "none", cursor: "pointer",
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Реестр
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Документы ({docs.length}{hasFilters ? ` из ${allDocs.length}` : ""})
          </h1>
        </div>
        <Link href="/admin/documents/new" className="btn-primary">📝 Новый документ</Link>
      </div>

      {/* Filters */}
      <form method="get" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <select name="dept" defaultValue={dept ?? ""} style={selectStyle}>
          <option value="">Все отделы</option>
          {departments.map(d => (
            <option key={d.id} value={String(d.id)}>{d.icon} {d.name}</option>
          ))}
        </select>

        <select name="status" defaultValue={status ?? ""} style={selectStyle}>
          <option value="">Все статусы</option>
          <option value="published">Опубликованные</option>
          <option value="draft">Черновики</option>
        </select>

        <select name="access" defaultValue={access ?? ""} style={selectStyle}>
          <option value="">Любой доступ</option>
          <option value="public">Публичный</option>
          <option value="restricted">Для граждан</option>
          <option value="secret">Секретный</option>
        </select>

        <button type="submit" className="btn-secondary" style={{ fontSize: "12px" }}>Применить</button>
        {hasFilters && (
          <Link href="/admin/documents" className="btn-secondary" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Сбросить
          </Link>
        )}
      </form>

      {docs.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>📄</div>
          <p style={{ color: "var(--text-muted)" }}>
            {hasFilters ? "Ничего не найдено по выбранным фильтрам" : "Документов ещё нет"}
          </p>
          {!hasFilters && (
            <Link href="/admin/documents/new" className="btn-primary" style={{ marginTop: "14px", display: "inline-flex" }}>Создать первый</Link>
          )}
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {docs.map((doc) => {
            const a = ACCESS[doc.access_level] ?? ACCESS.public;
            return (
              <div key={doc.id} className="row-item" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                    {doc.doc_number ?? `#${String(doc.id).padStart(3, "0")}`}
                  </span>
                  {doc.department_icon && <span style={{ fontSize: "13px", flexShrink: 0 }}>{doc.department_icon}</span>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title}
                    </div>
                    {doc.department_name && (
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{doc.department_name} · {fmt(doc.created_at)}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span className="badge" style={{ background: a.bg, color: a.color }}>{a.label}</span>
                  <span className="badge" style={{
                    background: doc.published ? "var(--green-bg)" : "var(--bg-elevated)",
                    color: doc.published ? "var(--green-soft)" : "var(--text-muted)",
                  }}>
                    {doc.published ? "Опубликован" : "Черновик"}
                  </span>
                  <Link href={`/admin/documents/${doc.id}/edit`} className="btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }}>
                    Изменить
                  </Link>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={doc.id} />
                    <ConfirmButton type="submit" message={`Удалить "${doc.title}"?`} className="btn-danger">Удалить</ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
