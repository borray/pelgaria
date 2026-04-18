export const dynamic = 'force-dynamic';
import { getAllDepartments, getAllSections, createDocument } from "@/lib/db";
import { saveUploadedFile, extractTextFromFile, validateFile } from "@/lib/files";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const departments = getAllDepartments();
  const allSections = getAllSections();
  const { error } = await searchParams;

  async function handleCreate(formData: FormData) {
    "use server";
    try {
      const session = await auth();
      const title = formData.get("title") as string;
      console.log("[upload] start, title=", title, "user=", (session?.user as any)?.id);
      let content = (formData.get("content") as string) ?? "";
      const departmentId = Number(formData.get("departmentId"));
      const published = formData.get("published") === "on";
      const accessLevel = (formData.get("accessLevel") as string) || "public";
      const docNumber = (formData.get("docNumber") as string)?.trim() || undefined;
      const docDate = (formData.get("docDate") as string)?.trim() || undefined;
      const sectionIdRaw = formData.get("sectionId") as string;
      const sectionId = sectionIdRaw ? Number(sectionIdRaw) : undefined;
      const authorId = Number((session?.user as any)?.id ?? 1);

      let fileName: string | undefined;
      let filePath: string | undefined;
      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        const fileError = validateFile(file);
        if (fileError) throw new Error(fileError);
        const saved = await saveUploadedFile(file);
        fileName = saved.fileName;
        filePath = saved.filePath;
        if (!content.trim()) content = await extractTextFromFile(file, filePath);
      }

      createDocument(title, content, departmentId, authorId, published, accessLevel, docNumber, fileName, filePath, sectionId, docDate);
      revalidatePath("/portal");
      revalidatePath("/admin/documents");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      redirect(`/admin/documents/new?error=${encodeURIComponent(msg)}`);
    }
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
          Новый документ
        </h1>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: "8px", marginBottom: "20px",
          background: "var(--red-bg)", border: "1px solid var(--red)",
          fontSize: "13px", color: "var(--red)", fontFamily: "monospace",
          wordBreak: "break-all",
        }}>
          <strong>Ошибка:</strong> {decodeURIComponent(error)}
        </div>
      )}

      <form action={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Title + Number */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Заголовок *
            </label>
            <input name="title" required placeholder="Название документа" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Номер
            </label>
            <input name="docNumber" placeholder="ПЗ-001" style={{ ...inputStyle, width: "120px" }} />
          </div>
        </div>

        {/* Doc date */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Дата документа
          </label>
          <input name="docDate" type="date" style={{ ...inputStyle, width: "200px" }} />
        </div>

        {/* Department + Access */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ведомство *
            </label>
            <select name="departmentId" required style={inputStyle}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Уровень доступа
            </label>
            <select name="accessLevel" style={inputStyle}>
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
          <select name="sectionId" style={inputStyle} defaultValue="">
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

        {/* File upload */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Прикрепить файл
            <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "6px", textTransform: "none", letterSpacing: 0 }}>
              .docx · .pdf · .txt · .xlsx · .png · .jpg
            </span>
          </label>
          <input type="file" name="file" accept=".docx,.doc,.pdf,.txt,.xlsx,.xls,.png,.jpg,.jpeg"
            style={{ color: "var(--text-muted)", fontSize: "13px" }} />
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Для .docx и .txt текст автоматически извлечётся в содержимое
          </p>
        </div>

        {/* Content */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Содержимое
            <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "6px", textTransform: "none", letterSpacing: 0 }}>
              необязательно при загрузке файла
            </span>
          </label>
          <textarea
            name="content" rows={10}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6 }}
          />
        </div>

        {/* Publish toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" name="published" />
          <span style={{ fontSize: "13.5px", color: "var(--text-muted)" }}>Опубликовать сразу</span>
        </label>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Сохранить</button>
          <a href="/admin/documents" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
