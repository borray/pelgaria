export const dynamic = 'force-dynamic';

import { getAllDocuments, getAllSections, getAllDepartments } from "@/lib/db";
import DocTreeEditor from "@/components/DocTreeEditor";
import Link from "next/link";

export default function DocsEditorPage() {
  const documents = getAllDocuments();
  const sections = getAllSections();
  const departments = getAllDepartments();

  // Flatten to the shape DocTreeEditor expects
  const docs = documents.map(d => ({
    id: d.id,
    title: d.title,
    doc_number: d.doc_number,
    section_id: d.section_id,
    department_id: d.department_id,
    department_name: d.department_name,
    section_title: d.section_title,
    published: d.published,
    access_level: d.access_level,
  }));

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px", height: "calc(100vh - 80px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Управление
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Редактор документов
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
            Перетащите документ на раздел слева. Двойной клик на разделе — переименовать. «+» — создать раздел.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/admin/documents/new" className="btn-primary">Новый документ</Link>
          <Link href="/admin/documents" className="btn-secondary">Список документов</Link>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <DocTreeEditor
          sections={sections}
          documents={docs}
          departments={departments}
        />
      </div>
    </div>
  );
}
