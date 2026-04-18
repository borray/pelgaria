import { getAllDepartments, getAllSections, createSection } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function NewSectionPage() {
  const departments = getAllDepartments();
  const allSections = getAllSections();

  async function handleCreate(formData: FormData) {
    "use server";
    const title = (formData.get("title") as string).trim();
    const departmentId = Number(formData.get("departmentId"));
    const parentIdRaw = formData.get("parentId") as string;
    const parentId = parentIdRaw ? Number(parentIdRaw) : null;
    const sortOrder = Number(formData.get("sortOrder") ?? 0);
    createSection({ title, department_id: departmentId, parent_id: parentId, sort_order: sortOrder });
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

  return (
    <div className="page-enter" style={{ maxWidth: "560px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Разделы
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Новый раздел
        </h1>
      </div>

      <form action={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>Название *</label>
          <input name="title" required placeholder="Название раздела" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Ведомство *</label>
          <select name="departmentId" required style={inputStyle}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Родительский раздел</label>
          <select name="parentId" style={inputStyle} defaultValue="">
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
          <input name="sortOrder" type="number" defaultValue="0" style={{ ...inputStyle, width: "120px" }} />
        </div>

        <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
          <button type="submit" className="btn-primary">Создать</button>
          <a href="/admin/sections" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}
