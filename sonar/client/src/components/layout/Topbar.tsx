import {
  IconApps,
  IconChevronDown,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { SonarBrand } from '../brand/SonarBrand'
import { CommandPalette } from './CommandPalette'

export function Topbar({ onNavigationClick, navigationOpen }: { onNavigationClick: () => void; navigationOpen: boolean }) {
  const { user, logout, hasPermission } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const primaryNavigation = [
    { to: '/', label: 'Обзор' },
    { to: '/office', label: 'Обслуживание', permission: 'office.view' },
    { to: '/citizens', label: 'Граждане', permission: 'citizens.view' },
    { to: '/laws', label: 'Право', permission: 'laws.view' },
  ].filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <header className="app-topbar">
      <div className="topbar-leading">
        <Link to="/" aria-label="Главная СОНАР" className="topbar-brand-link">
          <SonarBrand size="sm" />
        </Link>
        <nav className="topbar-primary-nav" aria-label="Основные разделы">
          {primaryNavigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'is-active' : ''}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="topbar-tools">
        <CommandPalette />
        <button
          type="button"
          className={`topbar-sections-button${navigationOpen ? ' is-active' : ''}`}
          onClick={onNavigationClick}
          aria-expanded={navigationOpen}
        >
          <IconApps size={18} />
          <span>Все разделы</span>
          <IconChevronDown size={14} />
        </button>
      </div>
      {user && (
        <div className="topbar-user-area">
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
