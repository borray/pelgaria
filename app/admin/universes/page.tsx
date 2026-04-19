import { db } from "@/lib/db";
import Link from "next/link";
import DeleteUniverseBtn from "./DeleteUniverseBtn";

type Universe = { id: number; name: string; code: string; description: string | null; status: string; created_at: string };

const STATUS_LABELS: Record<string, string> = {
  active:    "Активная",
  completed: "Завершённая",
  legendary: "Легендарная",
};

export default function UniversesPage() {
  const universes = db.prepare(
    "SELECT * FROM universes ORDER BY created_at DESC"
  ).all() as Universe[];

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Вселенные</h1>
          <p className="page-subtitle">Управление игровыми вселенными и их кодами</p>
        </div>
        <Link href="/admin/universes/new" className="btn btn-primary">
          + Добавить
        </Link>
      </div>

      <div className="card">
        {universes.length === 0 ? (
          <div className="empty">Вселенных пока нет. Создайте первую.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Название</th>
                <th>Статус</th>
                <th>Описание</th>
                <th>Создана</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {universes.map(u => (
                <tr key={u.id}>
                  <td className="td-mono">{u.code}</td>
                  <td className="td-primary">{u.name}</td>
                  <td>
                    <span className={`badge ${
                      u.status === "active"    ? "badge-active" :
                      u.status === "legendary" ? "badge-legend"  : "badge-done"
                    }`}>
                      {STATUS_LABELS[u.status] ?? u.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.description ?? <span style={{ color: "var(--fg-3)" }}>—</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(u.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Link href={`/admin/universes/${u.id}/edit`} className="btn btn-ghost btn-sm">
                        Изменить
                      </Link>
                      <DeleteUniverseBtn id={u.id} name={u.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
