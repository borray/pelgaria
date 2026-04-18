export const dynamic = 'force-dynamic';

import { auth } from "@/auth";
import {
  getPublishedDocuments, getAllDepartments, getSystemNotifications,
  getSectionsByDepartment, getPublishedDocumentsBySection, searchDocuments,
  getAppealsByPassport,
} from "@/lib/db";
import Link from "next/link";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function pluralDocs(n: number) {
  if (n === 1) return "документ";
  if (n >= 2 && n <= 4) return "документа";
  return "документов";
}

const ACCESS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  public:     { label: "Публичный",   color: "var(--green)",  bg: "var(--green-bg)" },
  restricted: { label: "Для граждан", color: "var(--amber)",  bg: "var(--amber-bg)" },
  secret:     { label: "Секретный",   color: "var(--red)",    bg: "var(--red-bg)"   },
};

const DEPT_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  assembly:   { color: "var(--blue)",   bg: "var(--blue-bg)",   border: "rgba(96,165,250,0.2)" },
  government: { color: "var(--purple)", bg: "var(--purple-bg)", border: "rgba(167,139,250,0.2)" },
  security:   { color: "var(--red)",    bg: "var(--red-bg)",    border: "rgba(248,113,113,0.2)" },
  archive:    { color: "var(--amber)",  bg: "var(--amber-bg)",  border: "rgba(251,191,36,0.2)" },
};

function getDeptColors(slug: string) {
  return DEPT_COLOR[slug] ?? { color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-strong)" };
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; section?: string; q?: string }>;
}) {
  const { dept, section, q } = await searchParams;
  const session = await auth();
  const role = (session?.user as any)?.role;
  const passportId = (session?.user as any)?.passportId as number | undefined;
  const departments = getAllDepartments();
  const activeDept = dept ? departments.find((d) => d.slug === dept) : null;

  const visibleDepts = role === "admin"
    ? departments
    : departments.filter((d) => d.slug !== "security");

  const isSearching = !!q?.trim();
  const isArchiveView = !!(dept || section || isSearching);

  let docs = isSearching
    ? searchDocuments(q!.trim(), role)
    : section
      ? getPublishedDocumentsBySection(Number(section), role)
      : getPublishedDocuments(dept, role);

  const allDocs = getPublishedDocuments(undefined, role);
  const recentDocs = allDocs.slice(0, 6);

  const myAppeals = passportId ? getAppealsByPassport(passportId) : [];
  const pendingAppeals = myAppeals.filter((a: any) => a.status === "pending" || a.status === "in_review");

  const activeDeptColors = activeDept ? getDeptColors(activeDept.slug) : null;
  const sections = activeDept ? getSectionsByDepartment(activeDept.id) : [];
  const selectedSectionId = section ? Number(section) : null;
  const topSections = sections.filter((s) => s.parent_id === null);

  const sysNotifs = session ? getSystemNotifications(true) : [];

  // ── Archive view ───────────────────────────────────────────────
  if (isArchiveView) {
    return (
      <div className="page-enter" style={{ maxWidth: "860px", paddingBottom: "48px" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Link href="/portal" style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none", transition: "color 0.15s" }}>
            Портал
          </Link>
          {activeDept && <>
            <span style={{ color: "var(--border-strong)", fontSize: "12px" }}>/</span>
            <span style={{ fontSize: "12px", color: activeDeptColors?.color ?? "var(--text-muted)" }}>{activeDept.name}</span>
          </>}
          {isSearching && <>
            <span style={{ color: "var(--border-strong)", fontSize: "12px" }}>/</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Поиск</span>
          </>}
        </div>

        {/* Search */}
        <form method="GET" action="/portal" style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {dept && <input type="hidden" name="dept" value={dept} />}
          <input name="q" defaultValue={q ?? ""} placeholder="Поиск по документам..." className="hero-search" />
          <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>Найти</button>
          {isSearching && (
            <a href={dept ? `/portal?dept=${dept}` : "/portal"} className="btn-secondary" style={{ flexShrink: 0 }}>Сбросить</a>
          )}
        </form>

        {/* Two-column: sections + docs */}
        {activeDept && topSections.length > 0 ? (
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            {/* Section tree */}
            <div style={{
              width: "196px", flexShrink: 0,
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "12px", padding: "10px 0", overflow: "hidden",
            }}>
              <div className="section-label" style={{ padding: "0 14px 10px" }}>Разделы</div>
              {[
                { id: null, title: "Все документы" },
                ...topSections.flatMap(sec => [
                  { id: sec.id, title: sec.title },
                  ...sections.filter(s => s.parent_id === sec.id).map(c => ({ id: c.id, title: "· " + c.title, indent: true as const })),
                ])
              ].map((item) => {
                const isActive = item.id === null ? !selectedSectionId : selectedSectionId === item.id;
                const href = item.id === null ? `/portal?dept=${activeDept.slug}` : `/portal?dept=${activeDept.slug}&section=${item.id}`;
                return (
                  <a key={String(item.id)} href={href} style={{
                    display: "block",
                    padding: `6px 14px 6px ${(item as any).indent ? "24px" : "14px"}`,
                    textDecoration: "none", fontSize: (item as any).indent ? "12px" : "13px",
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? "var(--bg-hover)" : "transparent",
                    borderLeft: isActive ? `2px solid ${activeDeptColors?.color ?? "var(--accent)"}` : "2px solid transparent",
                    transition: "background 0.15s, color 0.15s",
                  }}>
                    {item.title}
                  </a>
                );
              })}
            </div>

            {/* Doc list */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                {activeDeptColors && <div style={{ width: "3px", height: "16px", borderRadius: "2px", background: activeDeptColors.color }} />}
                <span style={{ fontWeight: 600, fontSize: "13px", color: activeDeptColors?.color ?? "var(--text)" }}>
                  {selectedSectionId ? sections.find(s => s.id === selectedSectionId)?.title ?? activeDept.name : activeDept.name}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>— {docs.length} {pluralDocs(docs.length)}</span>
              </div>
              <DocList docs={docs} dept={dept} isSearching={isSearching} q={q} activeDept={activeDept} />
            </div>
          </div>
        ) : (
          <>
            {isSearching ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                Результаты по «{q}» · {docs.length} {pluralDocs(docs.length)}
              </div>
            ) : activeDept && activeDeptColors ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "3px", height: "16px", borderRadius: "2px", background: activeDeptColors.color }} />
                <span style={{ fontWeight: 600, fontSize: "13px", color: activeDeptColors.color }}>{activeDept.name}</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>— {docs.length} {pluralDocs(docs.length)}</span>
              </div>
            ) : null}
            <DocList docs={docs} dept={dept} isSearching={isSearching} q={q} activeDept={activeDept} />
          </>
        )}
      </div>
    );
  }

  // ── Hub view ───────────────────────────────────────────────────
  return (
    <div className="page-enter" style={{ maxWidth: "820px", paddingBottom: "60px" }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <div className="section-label" style={{ marginBottom: "6px" }}>Официальный портал</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "clamp(1.7rem, 4vw, 2.2rem)", color: "var(--text)",
          letterSpacing: "-0.05em", lineHeight: 1.1, marginBottom: "8px",
        }}>
          Республика Пельгария
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "500px" }}>
          Государственная информационная система — законы, указы и реестр граждан
        </p>
      </div>

      {/* ── System notifications ─────────────────────────────────── */}
      {sysNotifs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
          {sysNotifs.map((n: any) => (
            <div key={n.id} className={`sys-notif-${n.type}`} style={{ padding: "11px 16px", borderRadius: "8px", fontSize: "13px", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>{n.title}</span>
              {n.content && <span style={{ marginLeft: "8px", opacity: 0.85 }}>{n.content}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Constitution notice ──────────────────────────────────── */}
      <div style={{
        marginBottom: "28px", padding: "16px 20px", borderRadius: "10px",
        border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.04)",
        display: "flex", alignItems: "flex-start", gap: "14px",
      }}>
        <div style={{ width: "3px", height: "40px", borderRadius: "2px", flexShrink: 0, background: "var(--amber)", marginTop: "2px" }} />
        <div>
          <div className="section-label" style={{ color: "var(--amber)", marginBottom: "4px" }}>
            Официальное уведомление · 2026
          </div>
          <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--text)", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Ведётся подготовка новой Конституции Пельгарии
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.55 }}>
            Конституционная комиссия приступила к разработке основного закона государства.
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "32px" }}>
        <Link href="/portal/appeals" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="section-label">Обращения</div>
          <div style={{ fontWeight: 800, fontSize: "2rem", color: "var(--text)", fontFamily: "monospace", letterSpacing: "-0.04em", lineHeight: 1 }}>
            {myAppeals.length}
          </div>
          {pendingAppeals.length > 0 ? (
            <div style={{ fontSize: "11.5px", color: "var(--amber)", fontWeight: 600 }}>
              {pendingAppeals.length} на рассмотрении
            </div>
          ) : (
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Нет активных</div>
          )}
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "auto", paddingTop: "8px" }}>Мои обращения →</div>
        </Link>

        <Link href="/portal?dept=assembly" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="section-label">Документов</div>
          <div style={{ fontWeight: 800, fontSize: "2rem", color: "var(--text)", fontFamily: "monospace", letterSpacing: "-0.04em", lineHeight: 1 }}>
            {allDocs.length}
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>В архиве</div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "auto", paddingTop: "8px" }}>Открыть архив →</div>
        </Link>

        <Link href="/profile" className="stat-card" style={{ textDecoration: "none" }}>
          <div className="section-label">Личный кабинет</div>
          <div style={{ fontWeight: 800, fontSize: "2rem", color: "var(--text)", fontFamily: "monospace", letterSpacing: "-0.04em", lineHeight: 1 }}>
            —
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Профиль и паспорт</div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "auto", paddingTop: "8px" }}>Мой профиль →</div>
        </Link>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <form method="GET" action="/portal" style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
        <input name="q" placeholder="Поиск по документам и законам..." className="hero-search" />
        <button type="submit" className="btn-primary" style={{ flexShrink: 0, padding: "0 20px" }}>Найти</button>
      </form>

      {/* ── Departments ──────────────────────────────────────────── */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div className="section-label">Ведомства</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
          {visibleDepts.map((d) => {
            const colors = getDeptColors(d.slug);
            const count = getPublishedDocuments(d.slug, role).length;
            return (
              <Link
                key={d.slug}
                href={`/portal?dept=${d.slug}`}
                className={`dept-card dept-${d.slug}`}
              >
                <div style={{
                  width: "40px", height: "40px", flexShrink: 0, borderRadius: "10px",
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px",
                }}>
                  {d.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text)", marginBottom: "2px" }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.description ?? "Официальный раздел"}
                  </div>
                </div>
                <span style={{
                  fontSize: "12px", fontWeight: 700, flexShrink: 0,
                  color: colors.color, padding: "3px 9px", borderRadius: "20px",
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  fontFamily: "monospace",
                }}>
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Recent documents ─────────────────────────────────────── */}
      {recentDocs.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div className="section-label">Последние документы</div>
            <Link href="/portal?dept=assembly" style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}>
              Все →
            </Link>
          </div>
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "12px", overflow: "hidden",
          }}>
            {recentDocs.map((doc: any, i: number) => {
              const b = ACCESS_BADGE[doc.access_level] ?? ACCESS_BADGE.public;
              const deptColors = getDeptColors(doc.department_slug ?? "");
              return (
                <a key={doc.id} href={`/portal/documents/${doc.id}`} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 16px", textDecoration: "none",
                  borderBottom: i < recentDocs.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.15s",
                }}
                  onMouseEnter={undefined}
                  className="row-item-v2"
                >
                  <span style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", flexShrink: 0, minWidth: "56px", letterSpacing: "0.04em" }}>
                    {doc.doc_number ?? `#${String(doc.id).padStart(3, "0")}`}
                  </span>
                  {doc.department_name && (
                    <span style={{ fontSize: "10.5px", flexShrink: 0, padding: "2px 7px", borderRadius: "5px", background: deptColors.bg, color: deptColors.color, lineHeight: 1.6 }}>
                      {doc.department_name}
                    </span>
                  )}
                  <span style={{ fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px", flex: 1 }}>
                    {doc.title}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span className="badge" style={{ background: b.bg, color: b.color }}>{b.label}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {fmt(doc.doc_date ?? doc.created_at)}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Archive document list ──────────────────────────────────────

function DocList({
  docs, dept, isSearching, q, activeDept,
}: {
  docs: any[];
  dept: string | undefined;
  isSearching: boolean;
  q: string | undefined;
  activeDept: { name: string; slug: string } | null | undefined;
}) {
  const ACCESS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    public:     { label: "Публичный",   color: "var(--green)",  bg: "var(--green-bg)" },
    restricted: { label: "Для граждан", color: "var(--amber)",  bg: "var(--amber-bg)" },
    secret:     { label: "Секретный",   color: "var(--red)",    bg: "var(--red-bg)"   },
  };
  const DEPT_COLOR: Record<string, { color: string; bg: string; border: string }> = {
    assembly:   { color: "var(--blue)",   bg: "var(--blue-bg)",   border: "rgba(96,165,250,0.2)" },
    government: { color: "var(--purple)", bg: "var(--purple-bg)", border: "rgba(167,139,250,0.2)" },
    security:   { color: "var(--red)",    bg: "var(--red-bg)",    border: "rgba(248,113,113,0.2)" },
    archive:    { color: "var(--amber)",  bg: "var(--amber-bg)",  border: "rgba(251,191,36,0.2)" },
  };
  function getDeptColors(slug: string) {
    return DEPT_COLOR[slug] ?? { color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-strong)" };
  }
  function fmt(d: string) {
    return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  }

  if (docs.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "12px", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--border-strong)", marginBottom: "10px", fontFamily: "monospace" }}>
          {isSearching ? `По запросу «${q}»` : "Пусто"}
        </div>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)", marginBottom: "6px" }}>
          {isSearching ? "Ничего не найдено" : activeDept ? `В «${activeDept.name}» пока нет документов` : "Документов нет"}
        </div>
        <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "20px" }}>
          {isSearching ? "Попробуйте другой запрос" : "Документы появятся после публикации"}
        </p>
        <a href="/portal" className="btn-secondary">← Вернуться</a>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
      {docs.map((doc, i) => {
        const b = ACCESS_BADGE[doc.access_level] ?? ACCESS_BADGE.public;
        const deptColors = getDeptColors(doc.department_slug ?? "");
        return (
          <a key={doc.id} href={`/portal/documents/${doc.id}`} className="row-item-v2" style={{
            textDecoration: "none",
            borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none",
            borderRadius: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace", flexShrink: 0, minWidth: "56px", letterSpacing: "0.04em" }}>
                {doc.doc_number ?? `#${String(doc.id).padStart(3, "0")}`}
              </span>
              {!dept && !isSearching && doc.department_name && (
                <span style={{ fontSize: "10.5px", flexShrink: 0, padding: "2px 7px", borderRadius: "5px", background: deptColors.bg, color: deptColors.color, lineHeight: 1.6 }}>
                  {doc.department_name}
                </span>
              )}
              <span style={{ fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13.5px" }}>
                {doc.title}
              </span>
              {doc.file_name && <span style={{ fontSize: "11px", flexShrink: 0, color: "var(--text-muted)" }}>(файл)</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "12px" }}>
              <span className="badge" style={{ background: b.bg, color: b.color }}>{b.label}</span>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {fmt(doc.doc_date ?? doc.created_at)}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
