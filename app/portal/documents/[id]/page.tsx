import { auth } from "@/auth";
import { getDocumentById } from "@/lib/db";
import { getFileIcon } from "@/lib/files";
import { notFound } from "next/navigation";
import Link from "next/link";
import path from "path";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function fileLabel(name: string) {
  const ext = path.extname(name).toLowerCase();
  return ({ ".docx":"Word",".doc":"Word",".pdf":"PDF",".txt":"Текст",
    ".xlsx":"Excel",".xls":"Excel",".png":"Изображение",".jpg":"Изображение",".jpeg":"Изображение" })[ext] ?? "Файл";
}

const ACCESS: Record<string, { label: string; color: string; bg: string }> = {
  public:     { label: "Публичный",    color: "var(--green-soft)", bg: "var(--green-bg)" },
  restricted: { label: "Для граждан", color: "var(--amber)",      bg: "var(--amber-bg)" },
  secret:     { label: "Секретный",   color: "var(--red)",        bg: "var(--red-bg)"   },
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  const doc = getDocumentById(Number(id));

  if (!doc || !doc.published) notFound();
  if (doc.access_level === "secret" && role !== "admin") notFound();

  const a = ACCESS[doc.access_level] ?? ACCESS.public;
  const displayName = doc.file_name?.replace(/^\d+-/, "") ?? null;

  return (
    <div className="page-enter" style={{ maxWidth: "700px", margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px", fontSize: "12px", color: "var(--text-muted)" }}>
        <Link href="/portal" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Портал</Link>
        {doc.department_slug && (
          <>
            <span>·</span>
            <Link href={`/portal?dept=${doc.department_slug}`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              {doc.department_icon} {doc.department_name}
            </Link>
          </>
        )}
        <span>·</span>
        <span style={{ color: "var(--text-secondary)" }}>{doc.doc_number ?? `#${doc.id}`}</span>
      </div>

      {/* Header card */}
      <div className="card" style={{ marginBottom: "20px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {doc.department_name && (
                <div style={{ fontSize: "10.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "6px" }}>
                  {doc.department_icon} {doc.department_name}
                </div>
              )}
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", letterSpacing: "-0.03em", color: "var(--text)", lineHeight: 1.2 }}>
                {doc.title}
              </h1>
            </div>
            <span className="badge" style={{ background: a.bg, color: a.color, flexShrink: 0, marginTop: "2px" }}>
              {a.label}
            </span>
          </div>
        </div>
        <div style={{ padding: "10px 24px", display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "12px", color: "var(--text-secondary)" }}>
          {doc.doc_number && (
            <span>
              <span style={{ color: "var(--text-muted)" }}>№ </span>
              <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{doc.doc_number}</span>
            </span>
          )}
          <span>
            <span style={{ color: "var(--text-muted)" }}>Дата </span>
            <span style={{ fontWeight: 500 }}>{fmt(doc.created_at)}</span>
          </span>
          <span>
            <span style={{ color: "var(--text-muted)" }}>Автор </span>
            <span style={{ fontWeight: 500 }}>{doc.author}</span>
          </span>
        </div>
      </div>

      {/* File download */}
      {doc.file_name && displayName && (
        <a
          href={`/api/files/${doc.file_name}`}
          download
          style={{
            display: "flex", alignItems: "center", gap: "14px",
            padding: "14px 18px", marginBottom: "20px",
            borderRadius: "10px", textDecoration: "none",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          className="card-glow"
        >
          <div style={{
            width: "40px", height: "40px", borderRadius: "8px",
            background: "var(--bg-hover)", border: "1px solid var(--border-strong)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px", flexShrink: 0,
          }}>
            {getFileIcon(doc.file_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {fileLabel(doc.file_name)} · Скачать
            </div>
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: "18px" }}>↓</span>
        </a>
      )}

      {/* Content */}
      {doc.content ? (
        <div className="doc-content" style={{ whiteSpace: "pre-wrap" }}>{doc.content}</div>
      ) : !doc.file_name ? (
        <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Содержимое отсутствует.</p>
      ) : null}
    </div>
  );
}
