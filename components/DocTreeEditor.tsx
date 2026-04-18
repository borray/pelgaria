"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type Section = {
  id: number; title: string; parent_id: number | null;
  department_id: number | null; sort_order: number;
  department_name?: string; parent_title?: string;
};

type Doc = {
  id: number; title: string; doc_number: string | null;
  section_id: number | null; department_id: number | null;
  department_name?: string; section_title?: string | null;
  published: number; access_level: string;
};

type Dept = { id: number; name: string; slug: string };

type Props = {
  sections: Section[];
  documents: Doc[];
  departments: Dept[];
};

const ACCESS_COLOR: Record<string, string> = {
  public: "var(--green)", restricted: "var(--amber)", secret: "var(--red)",
};

const ACCESS_LABELS: Record<string, string> = {
  public: "Публичный", restricted: "Для граждан", secret: "Секретный",
};

type QuickDocForm = {
  title: string;
  doc_number: string;
  access_level: string;
  published: boolean;
};

const EMPTY_FORM: QuickDocForm = { title: "", doc_number: "", access_level: "public", published: false };

export default function DocTreeEditor({ sections: initSections, documents: initDocs, departments }: Props) {
  const [sections, setSections] = useState<Section[]>(initSections);
  const [docs, setDocs] = useState<Doc[]>(initDocs);
  const [dragDocId, setDragDocId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<number | "none" | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [newSectionDeptId, setNewSectionDeptId] = useState<number | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionParent, setNewSectionParent] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<number | null | "none">(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  // null = no filter; "none" = no section; number = section id
  const [quickDocTarget, setQuickDocTarget] = useState<{ sectionId: number | null; deptId: number } | null>(null);
  const [quickDocForm, setQuickDocForm] = useState<QuickDocForm>(EMPTY_FORM);
  const [savingDoc, setSavingDoc] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const quickTitleRef = useRef<HTMLInputElement>(null);

  function toggleCollapse(id: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectSection(sectionId: number | null, deptId: number) {
    setSelectedSectionId(sectionId === null ? "none" : sectionId);
    setSelectedDeptId(deptId);
    setQuickDocTarget(null);
  }

  function clearSelection() {
    setSelectedSectionId(null);
    setSelectedDeptId(null);
    setQuickDocTarget(null);
  }

  // ── Drag & Drop ─────────────────────────────────────────────

  function onDragStart(docId: number) { setDragDocId(docId); }
  function onDragOver(e: React.DragEvent, target: number | "none") { e.preventDefault(); setDragOverTarget(target); }
  function onDragLeave() { setDragOverTarget(null); }

  async function onDrop(e: React.DragEvent, sectionId: number | null) {
    e.preventDefault();
    if (dragDocId === null) return;
    setDragOverTarget(null);
    setDocs(prev => prev.map(d => d.id === dragDocId ? { ...d, section_id: sectionId } : d));
    await fetch(`/api/docs/${dragDocId}/section`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId }),
    });
    setDragDocId(null);
  }

  // ── Section creation ─────────────────────────────────────────

  async function handleCreateSection(deptId: number | null) {
    if (deptId === null) return;
    if (!newSectionTitle.trim()) return;
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newSectionTitle.trim(),
        department_id: deptId,
        parent_id: newSectionParent,
        sort_order: sections.filter(s => s.department_id === deptId && s.parent_id === newSectionParent).length,
      }),
    });
    const { id } = await res.json();
    const dept = departments.find(d => d.id === deptId);
    const parent = newSectionParent ? sections.find(s => s.id === newSectionParent) : null;
    setSections(prev => [...prev, {
      id, title: newSectionTitle.trim(), parent_id: newSectionParent,
      department_id: deptId, sort_order: 0,
      department_name: dept?.name, parent_title: parent?.title,
    }]);
    setNewSectionTitle("");
    setNewSectionDeptId(null);
    setNewSectionParent(null);
  }

  // ── Section rename ───────────────────────────────────────────

  function startEdit(sec: Section) {
    setEditingSection(sec.id);
    setEditTitle(sec.title);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  async function commitEdit(sec: Section) {
    if (!editTitle.trim() || editTitle === sec.title) { setEditingSection(null); return; }
    setSections(prev => prev.map(s => s.id === sec.id ? { ...s, title: editTitle.trim() } : s));
    await fetch(`/api/sections/${sec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), parent_id: sec.parent_id, sort_order: sec.sort_order }),
    });
    setEditingSection(null);
  }

  // ── Section delete ───────────────────────────────────────────

  async function handleDeleteSection(id: number) {
    if (!confirm("Удалить раздел? Документы останутся, но потеряют привязку к разделу.")) return;
    setDocs(prev => prev.map(d => d.section_id === id ? { ...d, section_id: null } : d));
    setSections(prev => prev.filter(s => s.id !== id && s.parent_id !== id));
    if (selectedSectionId === id) clearSelection();
    await fetch(`/api/sections/${id}`, { method: "DELETE" });
  }

  // ── Quick doc creation ────────────────────────────────────────

  function openQuickDoc(sectionId: number | null, deptId: number) {
    setQuickDocTarget({ sectionId, deptId });
    setQuickDocForm(EMPTY_FORM);
    setTimeout(() => quickTitleRef.current?.focus(), 0);
  }

  async function handleQuickDocCreate() {
    if (!quickDocTarget || !quickDocForm.title.trim()) return;
    setSavingDoc(true);
    const res = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: quickDocForm.title.trim(),
        doc_number: quickDocForm.doc_number.trim() || undefined,
        access_level: quickDocForm.access_level,
        published: quickDocForm.published,
        departmentId: quickDocTarget.deptId,
        sectionId: quickDocTarget.sectionId,
      }),
    });
    const { id } = await res.json();
    const dept = departments.find(d => d.id === quickDocTarget.deptId);
    const sec = quickDocTarget.sectionId ? sections.find(s => s.id === quickDocTarget.sectionId) : null;
    setDocs(prev => [...prev, {
      id,
      title: quickDocForm.title.trim(),
      doc_number: quickDocForm.doc_number.trim() || null,
      section_id: quickDocTarget.sectionId,
      department_id: quickDocTarget.deptId,
      department_name: dept?.name,
      section_title: sec?.title ?? null,
      published: quickDocForm.published ? 1 : 0,
      access_level: quickDocForm.access_level,
    }]);
    setSavingDoc(false);
    setQuickDocTarget(null);
    setQuickDocForm(EMPTY_FORM);
  }

  // ── Filtered docs ─────────────────────────────────────────────

  const filteredDocs = (() => {
    if (selectedSectionId === null) return docs;
    if (selectedSectionId === "none") return docs.filter(d => d.section_id === null && d.department_id === selectedDeptId);
    return docs.filter(d => d.section_id === selectedSectionId);
  })();

  const dropTargetStyle = (target: number | "none"): React.CSSProperties => ({
    outline: dragOverTarget === target ? "2px dashed var(--accent)" : "none",
    background: dragOverTarget === target ? "rgba(228,228,231,0.04)" : undefined,
    transition: "all 0.1s",
  });

  // ── Section tree node ─────────────────────────────────────────

  function renderSection(sec: Section, depth = 0) {
    const children = sections.filter(s => s.parent_id === sec.id);
    const secDocs = docs.filter(d => d.section_id === sec.id);
    const isCollapsed = collapsed.has(sec.id);
    const isSelected = selectedSectionId === sec.id;

    return (
      <div key={sec.id}>
        <div
          onDragOver={(e) => onDragOver(e, sec.id)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, sec.id)}
          onClick={() => isSelected ? clearSelection() : selectSection(sec.id, sec.department_id!)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: `5px 8px 5px ${12 + depth * 16}px`,
            borderRadius: "6px", cursor: "pointer",
            background: isSelected ? "var(--accent-dim, rgba(59,130,246,0.12))" : undefined,
            borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
            marginLeft: "-2px",
            ...dropTargetStyle(sec.id),
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(sec.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "9px", padding: "0 2px", flexShrink: 0 }}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>

          {editingSection === sec.id ? (
            <input
              ref={editRef}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => commitEdit(sec)}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(sec); if (e.key === "Escape") setEditingSection(null); }}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                color: "var(--text)", borderRadius: "4px", padding: "2px 6px", fontSize: "12.5px",
                fontFamily: "var(--font-body)", outline: "none",
              }}
            />
          ) : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); startEdit(sec); }}
              style={{ flex: 1, fontSize: "12.5px", color: isSelected ? "var(--text)" : "var(--text-secondary, var(--text))", fontWeight: isSelected ? 600 : 500, cursor: "pointer", userSelect: "none" }}
              title="Кликните для фильтра · двойной клик — переименовать"
            >
              {sec.title}
            </span>
          )}

          <span style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>{secDocs.length}</span>

          <button
            onClick={(e) => { e.stopPropagation(); openQuickDoc(sec.id, sec.department_id!); }}
            title="Добавить документ в раздел"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent, #3b82f6)", fontSize: "13px", padding: "0 2px", lineHeight: 1, fontWeight: 700 }}
          >+</button>

          <button
            onClick={(e) => { e.stopPropagation(); setNewSectionDeptId(sec.department_id); setNewSectionParent(sec.id); }}
            title="Добавить подраздел"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "13px", padding: "0 2px", lineHeight: 1 }}
          >⊕</button>

          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteSection(sec.id); }}
            title="Удалить раздел"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "11px", padding: "0 2px", lineHeight: 1 }}
          >×</button>
        </div>

        {/* Inline new subsection form */}
        {newSectionDeptId === sec.department_id && newSectionParent === sec.id && (
          <div style={{ paddingLeft: `${28 + depth * 16}px`, paddingBottom: "4px", display: "flex", gap: "6px" }}>
            <input
              autoFocus
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateSection(sec.department_id); if (e.key === "Escape") { setNewSectionDeptId(null); setNewSectionTitle(""); } }}
              placeholder="Название подраздела"
              style={{
                flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                color: "var(--text)", borderRadius: "6px", padding: "4px 8px", fontSize: "12px",
                fontFamily: "var(--font-body)", outline: "none",
              }}
            />
            <button onClick={() => handleCreateSection(sec.department_id)} className="btn-primary" style={{ fontSize: "11px", padding: "4px 10px" }}>+</button>
          </div>
        )}

        {/* Quick doc form for this section */}
        {quickDocTarget?.sectionId === sec.id && renderQuickDocForm()}

        {/* Children */}
        {!isCollapsed && children.map(child => renderSection(child, depth + 1))}
      </div>
    );
  }

  // ── Quick doc form ────────────────────────────────────────────

  function renderQuickDocForm() {
    return (
      <div style={{
        margin: "4px 8px 4px 20px", padding: "10px 12px", borderRadius: "8px",
        background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
        display: "flex", flexDirection: "column", gap: "8px",
      }}>
        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
          Новый документ
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            ref={quickTitleRef}
            value={quickDocForm.title}
            onChange={e => setQuickDocForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") handleQuickDocCreate(); if (e.key === "Escape") setQuickDocTarget(null); }}
            placeholder="Название документа *"
            style={{
              flex: 1, background: "var(--bg)", border: "1px solid var(--border-strong)",
              color: "var(--text)", borderRadius: "6px", padding: "5px 8px", fontSize: "12.5px",
              fontFamily: "var(--font-body)", outline: "none",
            }}
          />
          <input
            value={quickDocForm.doc_number}
            onChange={e => setQuickDocForm(f => ({ ...f, doc_number: e.target.value }))}
            placeholder="№ (ПЗ-001)"
            style={{
              width: "90px", background: "var(--bg)", border: "1px solid var(--border-strong)",
              color: "var(--text)", borderRadius: "6px", padding: "5px 8px", fontSize: "12px",
              fontFamily: "monospace", outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={quickDocForm.access_level}
            onChange={e => setQuickDocForm(f => ({ ...f, access_level: e.target.value }))}
            style={{
              background: "var(--bg)", border: "1px solid var(--border-strong)",
              color: "var(--text)", borderRadius: "6px", padding: "4px 8px", fontSize: "12px",
              fontFamily: "var(--font-body)", outline: "none",
            }}
          >
            <option value="public">Публичный</option>
            <option value="restricted">Для граждан</option>
            <option value="secret">Секретный</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={quickDocForm.published} onChange={e => setQuickDocForm(f => ({ ...f, published: e.target.checked }))} />
            Опубликовать
          </label>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleQuickDocCreate}
            disabled={savingDoc || !quickDocForm.title.trim()}
            className="btn-primary"
            style={{ fontSize: "11.5px", padding: "4px 14px" }}
          >
            {savingDoc ? "…" : "Создать"}
          </button>
          <button
            onClick={() => setQuickDocTarget(null)}
            className="btn-secondary"
            style={{ fontSize: "11.5px", padding: "4px 10px" }}
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────

  return (
    <div style={{ display: "flex", gap: "0", height: "calc(100vh - 120px)", overflow: "hidden" }}>

      {/* ── Left: Section tree ──────────────────────────────── */}
      <div style={{
        width: "280px", flexShrink: 0, overflowY: "auto",
        borderRight: "1px solid var(--border)", paddingRight: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", paddingLeft: "8px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
            Структура разделов
          </div>
          {selectedSectionId !== null && (
            <button
              onClick={clearSelection}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "10px", padding: "0 4px" }}
              title="Снять выбор"
            >
              × все
            </button>
          )}
        </div>

        {departments.map(dept => {
          const deptSections = sections.filter(s => s.department_id === dept.id && s.parent_id === null);
          const isNoneSelected = selectedSectionId === "none" && selectedDeptId === dept.id;

          return (
            <div key={dept.id} style={{ marginBottom: "16px" }}>
              {/* Department header */}
              <div style={{
                fontSize: "11px", fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "4px 8px", marginBottom: "2px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>{dept.name}</span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    onClick={() => openQuickDoc(null, dept.id)}
                    title="Добавить документ без раздела"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent, #3b82f6)", fontSize: "13px", lineHeight: 1, fontWeight: 700 }}
                  >+</button>
                  <button
                    onClick={() => { setNewSectionDeptId(dept.id); setNewSectionParent(null); }}
                    title="Новый раздел"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px", lineHeight: 1 }}
                  >⊕</button>
                </div>
              </div>

              {/* Quick doc form for dept (no section) */}
              {quickDocTarget?.sectionId === null && quickDocTarget?.deptId === dept.id && renderQuickDocForm()}

              {/* "Без раздела" row */}
              <div
                onDragOver={(e) => onDragOver(e, "none")}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, null)}
                onClick={() => isNoneSelected ? clearSelection() : selectSection(null, dept.id)}
                style={{
                  padding: "4px 8px 4px 12px", borderRadius: "6px", fontSize: "12px",
                  color: "var(--text-muted)", fontStyle: "italic", cursor: "pointer",
                  background: isNoneSelected ? "var(--accent-dim, rgba(59,130,246,0.12))" : undefined,
                  borderLeft: isNoneSelected ? "2px solid var(--accent)" : "2px solid transparent",
                  marginLeft: "-2px",
                  ...dropTargetStyle("none"),
                }}
              >
                Без раздела
              </div>

              {deptSections.map(sec => renderSection(sec))}

              {/* New top-level section form */}
              {newSectionDeptId === dept.id && newSectionParent === null && (
                <div style={{ paddingLeft: "12px", paddingTop: "4px", display: "flex", gap: "6px" }}>
                  <input
                    autoFocus
                    value={newSectionTitle}
                    onChange={e => setNewSectionTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleCreateSection(dept.id); if (e.key === "Escape") { setNewSectionDeptId(null); setNewSectionTitle(""); } }}
                    placeholder="Название раздела"
                    style={{
                      flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                      color: "var(--text)", borderRadius: "6px", padding: "4px 8px", fontSize: "12px",
                      fontFamily: "var(--font-body)", outline: "none",
                    }}
                  />
                  <button onClick={() => handleCreateSection(dept.id)} className="btn-primary" style={{ fontSize: "11px", padding: "4px 10px" }}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Right: Document list ─────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", paddingLeft: "20px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
            {selectedSectionId === null
              ? `Все документы · ${docs.length}`
              : selectedSectionId === "none"
                ? `Без раздела · ${filteredDocs.length}`
                : `${sections.find(s => s.id === selectedSectionId)?.title ?? "Раздел"} · ${filteredDocs.length}`
            }
          </div>
          {selectedSectionId !== null && selectedSectionId !== "none" && (
            <button
              onClick={() => openQuickDoc(selectedSectionId as number, selectedDeptId!)}
              className="btn-primary"
              style={{ fontSize: "11.5px", padding: "4px 12px" }}
            >
              + Документ
            </button>
          )}
        </div>

        {/* Hint when no selection */}
        {selectedSectionId === null && (
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "12px", fontStyle: "italic" }}>
            Кликните на раздел слева для фильтра · перетащите документ на раздел
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {filteredDocs.map(doc => (
            <div
              key={doc.id}
              draggable
              onDragStart={() => onDragStart(doc.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "10px", padding: "9px 12px", borderRadius: "8px",
                background: dragDocId === doc.id ? "var(--bg-hover)" : "var(--bg-surface)",
                border: "1px solid var(--border)",
                cursor: "grab", transition: "all 0.1s",
                opacity: dragDocId === doc.id ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <span style={{ color: "var(--text-muted)", fontSize: "12px", flexShrink: 0 }}>⠿</span>
                {doc.doc_number && (
                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{doc.doc_number}</span>
                )}
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {doc.title}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                {doc.published === 0 && (
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" }}>черновик</span>
                )}
                <span title={ACCESS_LABELS[doc.access_level]} style={{ fontSize: "10px", color: ACCESS_COLOR[doc.access_level] ?? "var(--text-muted)" }}>●</span>
                <Link
                  href={`/admin/documents/${doc.id}/edit`}
                  style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}
                  onClick={e => e.stopPropagation()}
                >
                  Изменить
                </Link>
              </div>
            </div>
          ))}
          {filteredDocs.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              {selectedSectionId !== null ? "В этом разделе нет документов" : "Нет документов"}
              {selectedSectionId !== null && selectedSectionId !== "none" && (
                <div style={{ marginTop: "8px" }}>
                  <button
                    onClick={() => openQuickDoc(selectedSectionId as number, selectedDeptId!)}
                    className="btn-secondary"
                    style={{ fontSize: "12px" }}
                  >
                    + Добавить первый документ
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
