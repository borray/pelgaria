import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'

const PATH_LABELS: Record<string, string> = {
  office: 'СОНАР · Контакт', dashboard: 'Обзор',
  sessions: 'Обращение',
  citizens: 'Игроки', passports: 'Паспорта', laws: 'Законодательство', cases: 'Дела',
  punishments: 'Наказания', taxes: 'Налоги', treasury: 'Казна', buildings: 'РЕЛИКТ',
  chat: 'Чат', accounts: 'Аккаунты',
  roles: 'Роли', profile: 'Профиль', 'print-center': 'Печатный контур',
}

export function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  return (
    <nav className="app-breadcrumbs" aria-label="Путь к странице">
      <Link to="/dashboard" className="breadcrumb-home">СОНАР</Link>
      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join('/')}`
        const current = index === segments.length - 1
        return (
          <Fragment key={path}>
            <IconChevronRight size={13} />
            {current ? <span>{PATH_LABELS[segment] ?? segment}</span> : <Link to={path}>{PATH_LABELS[segment] ?? segment}</Link>}
          </Fragment>
        )
      })}
    </nav>
  )
}
