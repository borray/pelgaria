import { IconLogout, IconMenu2, IconUserCircle } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { SonarBrand } from '../brand/SonarBrand'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

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
          <SonarBrand light size="sm" />
        </Link>
        <div className="topbar-context">
          <span>Государство Пельагрия</span>
          <strong>Единый цифровой контур</strong>
        </div>
      </div>

      {user && (
        <div className="topbar-user-area">
          <Link to="/profile" className="topbar-profile">
            <div className="topbar-avatar">
              {user.discord_avatar
                ? <img src={user.discord_avatar} alt="" />
                : <IconUserCircle size={23} />}
            </div>
            <div className="topbar-profile-copy">
              <strong>{user.login}</strong>
              <span>{user.role.name}</span>
            </div>
          </Link>
          <button className="topbar-icon-button" onClick={handleLogout} title="Выйти">
            <IconLogout size={18} />
          </button>
        </div>
      )}
    </header>
  )
}
