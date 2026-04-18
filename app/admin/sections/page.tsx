export const dynamic = 'force-dynamic';

import { getAllSections } from "@/lib/db";
import Link from "next/link";

export default function AdminSectionsPage() {
  const sections = getAllSections();

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
            Управление
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Разделы ({sections.length})
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Иерархические разделы для организации документов по ведомствам
          </p>
        </div>
        <Link href="/admin/sections/new" className="btn-primary">Новый раздел</Link>
      </div>

      {sections.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "28px", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>—</div>
          <p style={{ color: "var(--text-muted)" }}>Разделов ещё нет</p>
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {sections.map((s) => (
            <div key={s.id} className="row-item">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                {s.parent_id !== null && (
                  <span style={{ color: "var(--border-strong)", fontSize: "11px", flexShrink: 0 }}>└</span>
                )}
                <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "13px" }}>{s.title}</span>
                {s.parent_title && (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>в «{s.parent_title}»</span>
                )}
                {s.department_name && (
                  <span className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                    {s.department_name}
                  </span>
                )}
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>порядок: {s.sort_order}</span>
              </div>
              <Link href={`/admin/sections/${s.id}/edit`} className="btn-secondary" style={{ fontSize: "12px", padding: "4px 10px", flexShrink: 0 }}>
                Изменить
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
