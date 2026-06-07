import { IconLogout } from '@tabler/icons-react'
import { useAuthStore } from '../../store/auth'
import { useNavigate, Link } from 'react-router-dom'

function RadarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="6" stroke="#3B82F6" strokeWidth="1" opacity="0.6"/>
      <circle cx="12" cy="12" r="2" fill="#3B82F6"/>
      <line x1="12" y1="12" x2="20" y2="5" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="19" cy="6" r="1.5" fill="#3B82F6" opacity="0.8"/>
    </svg>
  )
}

export function Topbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header
      style={{
        height: '56px',
        background: '#0A1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <RadarIcon />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span
            style={{
              fontFamily: "'Unbounded', sans-serif",
              fontWeight: 800,
              fontSize: '19px',
              letterSpacing: '0.14em',
              lineHeight: 1,
              textTransform: 'uppercase',
              background: 'linear-gradient(95deg, #60A5FA 0%, #3B82F6 55%, #2563EB 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            СОНАР
          </span>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.02em',
            }}
          >
            Государство Пельагрия
          </span>
        </div>
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/profile" style={{ textAlign: 'right', textDecoration: 'none' }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: '#FFFFFF',
              }}
            >
              {user.discord_avatar
                ? <img src={user.discord_avatar} style={{ width: 20, height: 20, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle' }} alt="" />
                : null}
              {user.login}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '11px',
                  color: '#FFFFFF',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  display: 'inline-block',
                }}
              >
                {user.role.name}
              </span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="Выйти"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'opacity 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF'
              ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'
              ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.8'
            }}
          >
            <IconLogout size={18} />
          </button>
        </div>
      )}
    </header>
  )
}
