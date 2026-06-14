import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconCircleCheck,
  IconGavel,
  IconId,
  IconInbox,
  IconPlayerPlay,
  IconScale,
  IconUsers,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/auth'
import { formatDateTime } from '../utils/formatters'

interface DashboardData {
  metrics: {
    citizens: number | null
    active_cases: number | null
    unpaid_taxes_count: number | null
    unpaid_taxes_amount: number | null
    treasury_balance: number | null
    active_laws: number | null
    active_buildings: number | null
    office_active: number | null
    office_overdue: number | null
  }
  recent: {
    cases: Array<{ id: string; number: string; status: string; opened_at: string; accused: { nickname: string } }>
    transactions: Array<{ id: string; amount: number; description: string; created_at: string; performed_by: { login: string } }>
    citizens: Array<{ id: string; nickname: string; reg_number: string; created_at: string }>
    requests: Array<{ id: string; number: string; title: string; status: string; priority: string; created_at: string }>
  }
}

const formatNumber = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient.get<DashboardData>('/dashboard')
      .then((response) => setData(response.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 6) return 'Доброй ночи'
    if (hour < 12) return 'Доброе утро'
    if (hour < 18) return 'Добрый день'
    return 'Добрый вечер'
  }, [])

  const metrics = data?.metrics
  const summaries = [
    { label: 'Игроков в реестре', value: formatNumber(metrics?.citizens ?? null), to: '/citizens', permission: 'citizens.view' },
    { label: 'Дел в работе', value: formatNumber(metrics?.active_cases ?? null), to: '/cases', permission: 'cases.view' },
    { label: 'Баланс казны', value: `${formatNumber(metrics?.treasury_balance ?? null)} у.е.`, to: '/treasury', permission: 'treasury.view' },
    { label: 'Объектов РЕЛИКТ', value: formatNumber(metrics?.active_buildings ?? null), to: '/buildings', permission: 'relict.view' },
  ].filter((item) => hasPermission(item.permission))

  const quickLinks = [
    { to: '/citizens', label: 'Реестр игроков', description: 'Карточки, паспорта и гражданство', icon: IconUsers, permission: 'citizens.view' },
    { to: '/office', label: 'СОНАР · Контакт', description: 'Обращения игроков и документы', icon: IconInbox, permission: 'office.view' },
    { to: '/passports', label: 'Паспорта', description: 'Выдача и проверка документов', icon: IconId, permission: 'passports.view' },
    { to: '/laws', label: 'Законодательство', description: 'Законы, указы и архив', icon: IconScale, permission: 'laws.view' },
  ].filter((item) => !item.permission || hasPermission(item.permission))

  const events = [
    ...(data?.recent.cases.map((item) => ({
      key: `case-${item.id}`,
      to: `/cases/${item.id}`,
      title: `Открыто дело ${item.number}`,
      meta: `${item.accused.nickname} · ${formatDateTime(item.opened_at)}`,
      icon: IconGavel,
    })) ?? []),
    ...(data?.recent.transactions.map((item) => ({
      key: `transaction-${item.id}`,
      to: '/treasury',
      title: item.description,
      meta: `${item.amount >= 0 ? '+' : ''}${formatNumber(item.amount)} у.е. · ${formatDateTime(item.created_at)}`,
      icon: IconBuildingBank,
    })) ?? []),
    ...(data?.recent.citizens.map((item) => ({
      key: `citizen-${item.id}`,
      to: `/citizens/${item.id}`,
      title: `В реестр внесён ${item.nickname}`,
      meta: `${item.reg_number} · ${formatDateTime(item.created_at)}`,
      icon: IconUsers,
    })) ?? []),
    ...(data?.recent.requests.map((item) => ({
      key: `request-${item.id}`,
      to: '/office',
      title: `Обращение ${item.number}: ${item.title}`,
      meta: `${item.status} · ${formatDateTime(item.created_at)}`,
      icon: IconInbox,
    })) ?? []),
  ].slice(0, 7)

  const hasDebt = (metrics?.unpaid_taxes_count ?? 0) > 0
  const today = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <div className="dashboard dashboard-v3">
      <section className="operations-hero">
        <div className="operations-hero-main">
          <span className="operations-status"><i /> Система доступна</span>
          <h1>{greeting}, {user?.login}</h1>
          <p>Рабочая смена собрана в одном экране: обслуживание, контрольные показатели и последние изменения.</p>
          {hasPermission('office.view') && (
            <Link to="/office" className="operations-primary-action">
              <IconPlayerPlay size={18} />
              <span><strong>Начать обслуживание</strong><small>Открыть новое обращение игрока</small></span>
              <IconArrowRight size={17} />
            </Link>
          )}
        </div>
        <aside className="operations-hero-side">
          <div className="operations-date"><IconCalendar size={17} /><span>{today}</span></div>
          <div className="operations-hero-metrics">
            <div><span>В работе</span><strong>{formatNumber(metrics?.office_active ?? null)}</strong><small>обращений игроков</small></div>
            <div><span>Правовая база</span><strong>{formatNumber(metrics?.active_laws ?? null)}</strong><small>действующих актов</small></div>
          </div>
          <div className="operations-integrity"><IconCircleCheck size={16} /><span>Реестры синхронизированы</span></div>
        </aside>
      </section>

      <section className="attention-board">
        <header>
          <div><span>Контроль смены</span><h2>Требует внимания</h2></div>
          <small>Показатели обновляются автоматически</small>
        </header>
        <div className="attention-board-grid">
          {hasPermission('office.view') && (
            <Link to="/office" className={(metrics?.office_overdue ?? 0) > 0 ? 'is-critical' : ''}>
              <span className="attention-index">01</span>
              <IconInbox size={19} />
              <div><strong>{formatNumber(metrics?.office_overdue ?? 0)}</strong><span>просроченных обращений</span></div>
              <IconArrowRight size={16} />
            </Link>
          )}
          {hasPermission('taxes.view') && (
            <Link to="/taxes" className={hasDebt ? 'is-critical' : ''}>
              <span className="attention-index">02</span>
              <IconAlertCircle size={19} />
              <div><strong>{formatNumber(metrics?.unpaid_taxes_count ?? 0)}</strong><span>неоплаченных начислений</span></div>
              <IconArrowRight size={16} />
            </Link>
          )}
          {hasPermission('cases.view') && (
            <Link to="/cases">
              <span className="attention-index">03</span>
              <IconGavel size={19} />
              <div><strong>{formatNumber(metrics?.active_cases ?? 0)}</strong><span>судебных дел в работе</span></div>
              <IconArrowRight size={16} />
            </Link>
          )}
          <div className="attention-ok">
            <span className="attention-index">04</span>
            <IconActivity size={19} />
            <div><strong>Штатно</strong><span>состояние систем</span></div>
          </div>
        </div>
      </section>

      <div className="operations-layout">
        <section className="operations-feed">
          <header className="operations-section-title">
            <div><span>Журнал системы</span><h2>Последние изменения</h2></div>
            <span className="operations-live"><i /> LIVE</span>
          </header>
          <div className="operations-timeline">
            {events.map((event, index) => {
              const Icon = event.icon
              return (
                <Link to={event.to} className="operations-event" key={event.key}>
                  <span className="operations-event-time">{String(index + 1).padStart(2, '0')}</span>
                  <span className="operations-event-icon"><Icon size={17} /></span>
                  <span><strong>{event.title}</strong><small>{event.meta}</small></span>
                  <IconArrowRight size={16} />
                </Link>
              )
            })}
            {!loading && events.length === 0 && <div className="dashboard-empty">Новых событий пока нет.</div>}
          </div>
        </section>

        <aside className="operations-side">
          <section className="operations-launcher">
            <header className="operations-section-title"><div><span>Запуск задачи</span><h2>Рабочие пространства</h2></div></header>
            <div>
              {quickLinks.map((item, index) => {
                const Icon = item.icon
                return (
                  <Link to={item.to} key={item.to}>
                    <small>{String(index + 1).padStart(2, '0')}</small>
                    <span><Icon size={18} /></span>
                    <div><strong>{item.label}</strong><p>{item.description}</p></div>
                    <IconArrowRight size={15} />
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="registry-pulse">
            <header><span>Масштаб системы</span><IconBuilding size={18} /></header>
            <div>
              {loading ? <div className="skeleton" /> : summaries.map((item) => (
                <Link to={item.to} key={item.label}><span>{item.label}</span><strong>{item.value}</strong></Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
