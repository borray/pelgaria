import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'

const PATH_LABELS: Record<string, string> = {
  citizens: 'Граждане',
  passports: 'Паспорта',
  laws: 'Законодательство',
  cases: 'Дела',
  punishments: 'Наказания',
  taxes: 'Налоги',
  treasury: 'Казна',
  buildings: 'РЕЛИКТ',
  territories: 'Территории',
  diplomacy: 'Дипломатия',
  chat: 'Чат',
  accounts: 'Аккаунты',
  roles: 'Роли',
  login: 'Вход',
  'change-password': 'Смена пароля',
  profile: 'Профиль',
}

interface Crumb {
  label: string
  path: string
}

export function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs: Crumb[] = segments.map((seg, idx) => {
    const path = '/' + segments.slice(0, idx + 1).join('/')
    const label = PATH_LABELS[seg] ?? seg
    return { label, path }
  })

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '16px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
      }}
    >
      <Link
        to="/"
        style={{
          color: '#6B7280',
          textDecoration: 'none',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = '#1B3A6B')}
        onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = '#6B7280')}
      >
        СОНАР
      </Link>
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb.path}>
          <IconChevronRight size={14} color="#D0D7E3" />
          {idx === crumbs.length - 1 ? (
            <span style={{ color: '#1B3A6B', fontWeight: 500 }}>{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              style={{
                color: '#6B7280',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = '#1B3A6B')}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = '#6B7280')}
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
