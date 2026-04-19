import { db } from "@/lib/db";

export default function AdminDashboard() {
  const universeCount = (db.prepare("SELECT COUNT(*) as c FROM universes").get() as { c: number }).c;
  const userCount     = (db.prepare("SELECT COUNT(*) as c FROM users").get()     as { c: number }).c;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Панель управления</h1>
          <p className="page-subtitle">Обзор системы //:МОСТ</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 40 }}>
        <div className="stat-card">
          <div className="stat-value">{universeCount}</div>
          <div className="stat-label">Вселенных</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Объектов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{userCount}</div>
          <div className="stat-label">Операторов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Участников</div>
        </div>
      </div>

      <div className="card card-p" style={{ maxWidth: 480 }}>
        <p className="t-label" style={{ marginBottom: 12 }}>Фаза разработки</p>
        <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.7 }}>
          Фаза 1 активна — настройка фундамента. Управление вселенными доступно.
          Реестр объектов, УИН, QR-коды и временна́я шкала появятся в Фазе 2.
        </p>
      </div>
    </div>
  );
}
