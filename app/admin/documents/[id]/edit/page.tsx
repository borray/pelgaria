export const dynamic = 'force-dynamic';
import { getAllDepartments, getAllSections, getDocumentById, updateDocument } from "@/lib/db";
import { saveUploadedFile, extractTextFromFile, validateFile } from "@/lib/files";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = getDocumentById(Number(id));
  if (!doc) notFound();
  const departments = getAllDepartments();
  const allSections = getAllSections();

  async function handleUpdate(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    let content = (formData.get("content") as string) ?? "";
    const departmentId = Number(formData.get("departmentId"));
    const published = formData.get("published") === "on";
    const accessLevel = (formData.get("accessLevel") as string) || "public";
    const docNumber = (formData.get("docNumber") as string)?.trim() || undefined;
    const docDate = (formData.get("docDate") as string)?.trim() || null;
    const sectionIdRaw = formData.get("sectionId") as string;
    const sectionId = sectionIdRaw ? Number(sectionIdRaw) : null;

    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const fileError = validateFile(file);
      if (fileError) throw new Error(fileError);
      const saved = await saveUploadedFile(file);
      if (!content.trim()) content = await extractTextFromFile(file, saved.filePath);
      updateDocument(Number(id), title, content, departmentId, published, accessLevel, docNumber, saved.fileName, saved.filePath, sectionId, docDate);
    } else {
      updateDocument(Number(id), title, content, departmentId, published, accessLevel, docNumber, undefined, undefined, sectionId, docDate);
    }
    revalidatePath("/portal");
    revalidatePath("/admin/documents");
    revalidatePath(`/portal/documents/${id}`);
    redirect("/admin/documents");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };

  return (
    <div className="page-enter" style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Документооборот
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Редактировать документ
        </h1>
      </div>

      <form action={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Title + Number */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Заголовок *
            </label>
            <input name="title" defaultValue={doc.title} required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Номер
            </label>
            <input name="docNumber" defaultValue={doc.doc_number ?? ""} placeholder="ПЗ-001" style={{ ...inputStyle, width: "120px" }} />
          </div>
        </div>

        {/* Doc date */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Дата документа
          </label>
          <input name="docDate" type="date" defaultValue={doc.doc_date ?? ""} style={{ ...inputStyle, width: "200px" }} />
        </div>

        {/* Department + Access */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ведомство *
            </label>
            <select name="departmentId" defaultValue={doc.department_id ?? ""} required style={inputStyle}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Уровень доступа
            </label>
            <select name="accessLevel" defaultValue={doc.access_level} style={inputStyle}>
              <option value="public">Публичный</option>
              <option value="restricted">Для граждан</option>
              <option value="secret">Секретный</option>
            </select>
          </div>
        </div>

        {/* Section */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Раздел
          </label>
          <select name="sectionId" defaultValue={doc.section_id ?? ""} style={inputStyle}>
            <option value="">Без раздела</option>
            {allSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.department_name ?? ""}
                {s.parent_title ? ` / ${s.parent_title}` : ""}
                {` / ${s.title}`}
              </option>
            ))}
          </select>
        </div>

        {/* Current file */}
        {doc.file_name && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Текущий файл:</span>
            <a href={`/api/files/${doc.file_name}`} style={{ fontWeight: 500, color: "var(--accent)", fontSize: "13px" }}>
              {doc.file_name.replace(/^\d+-/, "")}
            </a>
          </div>
        )}

        {/* File upload */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {doc.file_name ? "Заменить файл" : "Прикрепить файл"}
            <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "6px", textTransform: "none", letterSpacing: 0 }}>
              .docx · .pdf · .txt · .xlsx · .png · .jpg
            </span>
          </label>
          <input type="file" name="file" accept=".docx,.doc,.pdf,.txt,.xlsx,.xls,.png,.jpg,.jpeg"
            style={{ color: "var(--text-muted)", fontSize: "13px" }} />
        </div>

        {/* Content */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Содержимое
          </label>
          <textarea
            name="content" defaultValue={doc.content} rows={10}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6 }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" name="published" defaultChecked={doc.published === 1} />
          <span style={{ fontSize: "13.5px", color: "var(--text-muted)" }}>Опубликован</span>
        </label>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Сохранить изменения</button>
          <a href="/admin/documents" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
