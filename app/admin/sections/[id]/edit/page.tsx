import { getAllDepartments, getAllSections, getSectionById, updateSection, deleteSection } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import ConfirmButton from "@/components/ConfirmButton";

export default async function EditSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const section = getSectionById(Number(id));
  if (!section) notFound();
  const departments = getAllDepartments();
  const allSections = getAllSections().filter((s) => s.id !== Number(id));

  async function handleUpdate(formData: FormData) {
    "use server";
    const title = (formData.get("title") as string).trim();
    const parentIdRaw = formData.get("parentId") as string;
    const parentId = parentIdRaw ? Number(parentIdRaw) : null;
    const sortOrder = Number(formData.get("sortOrder") ?? 0);
    updateSection(Number(id), { title, parent_id: parentId, sort_order: sortOrder });
    revalidatePath("/admin/sections");
    redirect("/admin/sections");
  }

  async function handleDelete(formData: FormData) {
    "use server";
    deleteSection(Number(formData.get("id")));
    revalidatePath("/admin/sections");
    redirect("/admin/sections");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid var(--border-strong)", background: "var(--bg-elevated)",
    color: "var(--text)", fontSize: "13.5px", outline: "none",
    fontFamily: "var(--font-body)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "12px", fontWeight: 600,
    color: "var(--text-muted)", marginBottom: "6px",
    textTransform: "uppercase", letterSpacing: "0.06em",
  };

  const dept = departments.find((d) => d.id === section.department_id);

  return (
    <div className="page-enter" style={{ maxWidth: "560px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Разделы
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Редактировать раздел
        </h1>
        {dept && (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Ведомство: {dept.name}
          </p>
        )}
      </div>

      <form action={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Название *</label>
          <input name="title" required defaultValue={section.title} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Родительский раздел</label>
          <select name="parentId" style={inputStyle} defaultValue={section.parent_id ?? ""}>
            <option value="">— Без родителя (верхний уровень)</option>
            {allSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.department_name ? `${s.department_name} / ` : ""}{s.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Порядок сортировки</label>
          <input name="sortOrder" type="number" defaultValue={section.sort_order} style={{ ...inputStyle, width: "120px" }} />
        </div>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Сохранить</button>
          <a href="/admin/sections" className="btn-secondary">Отмена</a>
        </div>
      </form>

      <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
        <form action={handleDelete}>
          <input type="hidden" name="id" value={section.id} />
          <ConfirmButton type="submit" message={`Удалить раздел «${section.title}»? Все вложенные разделы тоже будут удалены.`} className="btn-danger">
            Удалить раздел
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}
