import React from 'react'
import { IconLogout } from '@tabler/icons-react'
import { useAuthStore } from '../../store/auth'
import { useNavigate } from 'react-router-dom'

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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: '18px',
            color: '#FFFFFF',
            letterSpacing: '0.05em',
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

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: '#FFFFFF',
              }}
            >
              {user.login}
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '11px',
                color: user.role.color,
              }}
            >
              {user.role.name}
            </div>
          </div>
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
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'
            }}
          >
            <IconLogout size={18} />
          </button>
        </div>
      )}
    </header>
  )
}
