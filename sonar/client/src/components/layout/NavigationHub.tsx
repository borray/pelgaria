import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBuilding,
  IconBuildingBank,
  IconCurrencyDollar,
  IconGavel,
  IconId,
  IconInbox,
  IconLayoutDashboard,
  IconMessageCircle,
  IconSearch,
  IconScale,
  IconShield,
  IconShieldCheck,
  IconUserCog,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { useAuthStore } from '../../store/auth'

interface HubItem {
  to: string
  label: string
  description: string
  icon: typeof IconUsers
  permission?: string
}

interface HubGroup {
  title: string
  caption: string
  items: HubItem[]
}

const groups: HubGroup[] = [
  {
    title: 'Работа с людьми',
    caption: 'Обслуживание и государственные реестры',
    items: [
      { to: '/office', label: 'Центр обслуживания', description: 'Сессии, заявления, документы и сканы', icon: IconInbox, permission: 'office.view' },
      { to: '/citizens', label: 'Граждане', description: 'Карточки граждан и учётные сведения', icon: IconUsers, permission: 'citizens.view' },
      { to: '/passports', label: 'Паспорта', description: 'Выдача, статусы и проверка документов', icon: IconId, permission: 'passports.view' },
      { to: '/verify', label: 'Проверка подлинности', description: 'Поиск документа по номеру или ШК', icon: IconShieldCheck },
    ],
  },
  {
    title: 'Государственное управление',
    caption: 'Право, финансы и контроль',
    items: [
      { to: '/laws', label: 'Законодательство', description: 'Конституция, законы, указы и архив', icon: IconScale, permission: 'laws.view' },
      { to: '/cases', label: 'Судебные дела', description: 'Производства, решения и материалы', icon: IconGavel, permission: 'cases.view' },
      { to: '/punishments', label: 'Наказания', description: 'Назначенные меры и сроки исполнения', icon: IconAlertTriangle, permission: 'punishments.view' },
      { to: '/taxes', label: 'Налоги', description: 'Начисления, задолженности и контроль', icon: IconCurrencyDollar, permission: 'taxes.view' },
      { to: '/treasury', label: 'Казна', description: 'Баланс и журнал государственных операций', icon: IconBuildingBank, permission: 'treasury.view' },
      { to: '/buildings', label: 'РЕЛИКТ', description: 'Реестр государственных объектов', icon: IconBuilding, permission: 'relict.view' },
    ],
  },
  {
    title: 'Связь и система',
    caption: 'Коммуникации и администрирование',
    items: [
      { to: '/chat', label: 'Служебная связь', description: 'Внутренний защищённый чат', icon: IconMessageCircle, permission: 'chat.send' },
      { to: '/accounts', label: 'Учётные записи', description: 'Сотрудники, доступ и блокировки', icon: IconUserCog, permission: 'accounts.manage' },
      { to: '/roles', label: 'Роли и полномочия', description: 'Настройка прав доступа', icon: IconShield, permission: 'roles.manage' },
    ],
  },
]

export function NavigationHub({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const [query, setQuery] = useState('')

  const visibleGroups = useMemo(() => groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (
        (!item.permission || hasPermission(item.permission))
        && `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())
      )),
    }))
    .filter((group) => group.items.length > 0), [hasPermission, query])

  if (!open) return null

  return (
    <div className="navigation-hub-backdrop" onClick={onClose}>
      <section className="navigation-hub" onClick={(event) => event.stopPropagation()} aria-label="Центр разделов">
        <header className="navigation-hub-header">
          <div>
            <span>Навигационный центр</span>
            <h2>Все рабочие пространства</h2>
          </div>
          <label className="navigation-hub-search">
            <IconSearch size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти задачу или реестр" autoFocus />
          </label>
          <button type="button" onClick={onClose} aria-label="Закрыть"><IconX size={20} /></button>
        </header>

        <NavLink to="/" end onClick={onClose} className="navigation-home-card">
          <span><IconLayoutDashboard size={20} /></span>
          <div><strong>Операционный обзор</strong><small>Сводка, очередь задач и последние события</small></div>
          <IconArrowUpRight size={18} />
        </NavLink>

        <div className="navigation-hub-groups">
          {visibleGroups.map((group) => (
            <section key={group.title} className="navigation-hub-group">
              <header><strong>{group.title}</strong><span>{group.caption}</span></header>
              <div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => isActive ? 'is-active' : ''}>
                      <span><Icon size={18} /></span>
                      <div><strong>{item.label}</strong><small>{item.description}</small></div>
                      <IconArrowUpRight size={15} />
                    </NavLink>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        {visibleGroups.length === 0 && <div className="navigation-hub-empty">Ничего не найдено. Попробуйте другой запрос.</div>}
        <footer><i /> СОНАР · служебный игровой контур Пельгарии</footer>
      </section>
    </div>
  )
}
