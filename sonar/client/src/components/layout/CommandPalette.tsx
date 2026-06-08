import { useEffect, useMemo, useState } from 'react'
import {
  IconBuilding,
  IconBuildingBank,
  IconGavel,
  IconId,
  IconLayoutDashboard,
  IconMap,
  IconMessageCircle,
  IconScale,
  IconSearch,
  IconUsers,
  IconPrinter,
  IconInbox,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

const destinations = [
  { label: 'Главная', hint: 'Оперативная сводка', path: '/', icon: IconLayoutDashboard },
  { label: 'Граждане', hint: 'Государственный реестр', path: '/citizens', icon: IconUsers, permission: 'citizens.view' },
  { label: 'Паспорта', hint: 'Документы граждан', path: '/passports', icon: IconId, permission: 'passports.view' },
  { label: 'Законодательство', hint: 'Законы и указы', path: '/laws', icon: IconScale, permission: 'laws.view' },
  { label: 'Судебные дела', hint: 'Правопорядок', path: '/cases', icon: IconGavel, permission: 'cases.view' },
  { label: 'Казна', hint: 'Финансовые операции', path: '/treasury', icon: IconBuildingBank, permission: 'treasury.view' },
  { label: 'РЕЛИКТ', hint: 'Реестр объектов', path: '/buildings', icon: IconBuilding, permission: 'relict.view' },
  { label: 'Территории', hint: 'Управление землями', path: '/territories', icon: IconMap, permission: 'territories.view' },
  { label: 'Чат', hint: 'Защищённая связь', path: '/chat', icon: IconMessageCircle, permission: 'chat.send' },
  { label: 'Приёмная', hint: 'Обращения, заявления и поручения', path: '/office', icon: IconInbox, permission: 'office.view' },
  { label: 'Центр печати', hint: 'Справки, заявления и выписки', path: '/print-center', icon: IconPrinter },
]

export function CommandPalette() {
  const navigate = useNavigate()
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const items = useMemo(() => destinations
    .filter((item) => !item.permission || hasPermission(item.permission))
    .filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase())), [query, hasPermission])

  if (!open) {
    return (
      <button className="command-launcher" onClick={() => setOpen(true)} title="Быстрый переход">
        <IconSearch size={16} />
        <span>Быстрый переход</span>
        <kbd>Ctrl K</kbd>
      </button>
    )
  }

  return (
    <div className="command-backdrop" onClick={() => setOpen(false)}>
      <div className="command-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="command-input">
          <IconSearch size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Куда перейти?"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span><Icon size={18} /></span>
                <div><strong>{item.label}</strong><small>{item.hint}</small></div>
              </button>
            )
          })}
          {items.length === 0 && <div className="command-empty">Раздел не найден</div>}
        </div>
      </div>
    </div>
  )
}
