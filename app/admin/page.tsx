export const dynamic = 'force-dynamic';

import { getAllDocuments, getAllUsers, getAllPassports, getAllAppeals, getSystemNotifications } from "@/lib/db";
import Link from "next/link";

const STATUS_MAP: Record<string, string> = {
  active: "Активен", blocked: "Заблокирован", wanted: "В розыске",
  deactivating: "Деактивация", frozen: "Заморожен", temp_frozen: "Вр. заморожен",
  suspended: "Отстранён", deceased: "Выбыл",
};

export default function AdminDashboard() {
  const docs = getAllDocuments();
  const users = getAllUsers();
  const passports = getAllPassports();
  const appeals = getAllAppeals();
  const sysNotifs = getSystemNotifications(true);

  const published = docs.filter((d) => d.published === 1).length;
  const pendingAppeals = appeals.filter((a) => a.status === "pending");
  const recentDocs = docs.slice(0, 5);
  const recentPassports = passports.slice(0, 5);

  const stats = [
    { label: "Документов", value: docs.length, href: "/admin/documents" },
    { label: "Опубликовано", value: published, href: "/admin/documents" },
    { label: "Паспортов", value: passports.length, href: "/admin/passports" },
    { label: "Аккаунтов", value: users.length, href: "/admin/users" },
    { label: "Обращений", value: pendingAppeals.length, href: "/admin/appeals?status=pending" },
    { label: "Объявлений", value: sysNotifs.length, href: "/admin/system-notifications" },
  ];

  const quickActions = [
    { href: "/admin/documents/new", label: "Новый документ", desc: "Создать документ или акт" },
    { href: "/admin/passports/new", label: "Выдать паспорт", desc: "Зарегистрировать гражданина" },
    { href: "/admin/notifications/new", label: "Отправить уведомление", desc: "Предупреждение, блокировка, штраф" },
    { href: "/admin/sections/new", label: "Новый раздел", desc: "Создать раздел в архиве" },
    { href: "/admin/system-notifications/new", label: "Новое объявление", desc: "Сообщение для всех граждан" },
    { href: "/admin/users", label: "Пользователи", desc: "Управление аккаунтами" },
  ];

  const cardStyle: React.CSSProperties = {
    padding: "16px 18px", borderRadius: "10px",
    background: "var(--bg-surface)", border: "1px solid var(--border)",
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
          Панель управления
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", color: "var(--text)", letterSpacing: "-0.04em" }}>
          Обзор
        </h1>
      </div>

      {/* Stats row — 6 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px" }}>
        {stats.map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none" }}>
            <div className="card-glow" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions — 2 rows × 3 cols */}
      <div>
        <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "10px" }}>
          Быстрые действия
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
              <div className="card-glow" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)", marginBottom: "3px" }}>{a.label}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent section — 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>

        {/* Left: Recent passports */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              Последние паспорта
            </h2>
            <Link href="/admin/passports" style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}>Все</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {recentPassports.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 0" }}>Нет паспортов</div>
            ) : recentPassports.map((p) => (
              <Link key={p.id} href={`/admin/passports/${p.id}/edit`} className="row-item" style={{ textDecoration: "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>{p.passport_number}</div>
                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.minecraft_nick}</div>
                </div>
                <span className={`badge status-${p.status}`} style={{ fontSize: "10px", flexShrink: 0 }}>
                  {STATUS_MAP[p.status] ?? p.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Middle: Pending appeals */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              На рассмотрении
            </h2>
            <Link href="/admin/appeals" style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}>Все</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {pendingAppeals.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 0" }}>Нет обращений</div>
            ) : pendingAppeals.slice(0, 5).map((a) => (
              <Link key={a.id} href="/admin/appeals" className="row-item" style={{ textDecoration: "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.subject}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{a.passport_number} · {a.dept_name}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Recent documents */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              Последние документы
            </h2>
            <Link href="/admin/documents" style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}>Все</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {recentDocs.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 0" }}>Нет документов</div>
            ) : recentDocs.map((d) => (
              <Link key={d.id} href={`/admin/documents/${d.id}/edit`} className="row-item" style={{ textDecoration: "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.department_name}</div>
                </div>
                {d.published === 1 && (
                  <span className="badge" style={{ background: "var(--green-bg)", color: "var(--green)", fontSize: "10px", flexShrink: 0 }}>Опубл.</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
