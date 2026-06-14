import {
  IconCircleCheck,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMenu2,
  IconUserCircle,
} from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { SonarBrand } from '../brand/SonarBrand'
import { useLayoutStore } from '../../store/layout'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const collapsed = useLayoutStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="app-topbar">
      <div className="topbar-leading">
        <button className="mobile-menu-button" onClick={onMenuClick} aria-label="Открыть меню">
          <IconMenu2 size={20} />
        </button>
        <Link to="/" aria-label="Главная СОНАР" className="topbar-brand-link">
          <SonarBrand size="sm" />
        </Link>
        <button
          type="button"
          className="topbar-sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
          title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          {collapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
        </button>
        <span className="topbar-divider" />
        <div className="topbar-context">
          <strong>Рабочая среда</strong>
          <span><i /> Контур доступен</span>
        </div>
      </div>
      {user && (
        <div className="topbar-user-area">
          <span className="topbar-sync"><IconCircleCheck size={15} /> Данные синхронизированы</span>
          <Link to="/profile" className="topbar-profile">
            <span className="topbar-avatar">
              {user.discord_avatar ? <img src={user.discord_avatar} alt="" /> : <IconUserCircle size={22} />}
            </span>
            <span className="topbar-profile-copy">
              <strong>{user.login}</strong>
              <small>{user.role.name}</small>
            </span>
          </Link>
          <button className="topbar-icon-button" onClick={handleLogout} aria-label="Выйти">
            <IconLogout size={18} />
          </button>
        </div>
      )}
    </header>
  )
}
