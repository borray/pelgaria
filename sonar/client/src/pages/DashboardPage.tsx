import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconBuilding,
  IconBuildingBank,
  IconGavel,
  IconId,
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
  }
  recent: {
    cases: Array<{
      id: string
      number: string
      status: string
      opened_at: string
      accused: { nickname: string }
    }>
    transactions: Array<{
      id: string
      amount: number
      description: string
      created_at: string
      performed_by: { login: string }
    }>
    citizens: Array<{
      id: string
      nickname: string
      reg_number: string
      created_at: string
    }>
  }
}

const number = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<DashboardData>('/dashboard')
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
  const cards = [
    {
      label: 'Граждане',
      value: number(metrics?.citizens ?? null),
      detail: 'в государственном реестре',
      icon: <IconUsers size={19} />,
      color: '#3B82F6',
      to: '/citizens',
      visible: hasPermission('citizens.view'),
    },
    {
      label: 'Активные дела',
      value: number(metrics?.active_cases ?? null),
      detail: 'открыто или в работе',
      icon: <IconGavel size={19} />,
      color: '#F97316',
      to: '/cases',
      visible: hasPermission('cases.view'),
    },
    {
      label: 'Баланс казны',
      value: `${number(metrics?.treasury_balance ?? null)} у.е.`,
      detail: 'текущий государственный баланс',
      icon: <IconBuildingBank size={19} />,
      color: '#10B981',
      to: '/treasury',
      visible: hasPermission('treasury.view'),
    },
    {
      label: 'Объекты РЕЛИКТ',
      value: number(metrics?.active_buildings ?? null),
      detail: 'действующих объектов',
      icon: <IconBuilding size={19} />,
      color: '#8B5CF6',
      to: '/buildings',
      visible: hasPermission('relict.view'),
    },
  ].filter((card) => card.visible)

  const quickLinks = [
    { to: '/citizens', label: 'Открыть реестр', icon: <IconUsers size={17} />, permission: 'citizens.view' },
    { to: '/passports', label: 'Паспорта', icon: <IconId size={17} />, permission: 'passports.view' },
    { to: '/laws', label: 'Архив законов', icon: <IconScale size={17} />, permission: 'laws.view' },
    { to: '/cases', label: 'Судебные дела', icon: <IconGavel size={17} />, permission: 'cases.view' },
  ].filter((item) => hasPermission(item.permission))

  const hasAttention =
    metrics?.unpaid_taxes_count !== null && (metrics?.unpaid_taxes_count ?? 0) > 0

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-eyebrow">
            <span className="system-live-dot" />
            Система работает штатно
          </div>
          <h1>{greeting}, {user?.login}</h1>
          <p>Оперативная сводка государства Пельагрия</p>
          <div className="dashboard-quick-links">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="sonar-orbit" aria-hidden="true">
          <span className="sonar-ring sonar-ring-one" />
          <span className="sonar-ring sonar-ring-two" />
          <span className="sonar-ring sonar-ring-three" />
          <span className="sonar-sweep" />
          <span className="sonar-core" />
          <span className="sonar-point sonar-point-one" />
          <span className="sonar-point sonar-point-two" />
        </div>
      </section>

      <section className="dashboard-metrics">
        {loading
          ? [0, 1, 2, 3].map((item) => <div key={item} className="dashboard-metric skeleton" />)
          : cards.map((card) => (
              <Link className="dashboard-metric" to={card.to} key={card.label}>
                <div className="dashboard-metric-icon" style={{ color: card.color, background: `${card.color}14` }}>
                  {card.icon}
                </div>
                <div>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </div>
                <IconArrowUpRight className="dashboard-card-arrow" size={18} />
              </Link>
            ))}
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel dashboard-activity">
          <div className="dashboard-panel-heading">
            <div>
              <span>Жизнь государства</span>
              <h2>Последние события</h2>
            </div>
            <span className="dashboard-live-label">LIVE</span>
          </div>

          <div className="activity-list">
            {data?.recent.cases.map((item) => (
              <Link to={`/cases/${item.id}`} className="activity-item" key={`case-${item.id}`}>
                <span className="activity-marker activity-marker-orange"><IconGavel size={15} /></span>
                <span>
                  <strong>Открыто дело {item.number}</strong>
                  <small>{item.accused.nickname} · {formatDateTime(item.opened_at)}</small>
                </span>
              </Link>
            ))}
            {data?.recent.transactions.map((item) => (
              <Link to="/treasury" className="activity-item" key={`tx-${item.id}`}>
                <span className={`activity-marker ${item.amount >= 0 ? 'activity-marker-green' : 'activity-marker-red'}`}>
                  <IconBuildingBank size={15} />
                </span>
                <span>
                  <strong>{item.description}</strong>
                  <small>{item.amount >= 0 ? '+' : ''}{number(item.amount)} у.е. · {formatDateTime(item.created_at)}</small>
                </span>
              </Link>
            ))}
            {data?.recent.citizens.map((item) => (
              <Link to={`/citizens/${item.id}`} className="activity-item" key={`citizen-${item.id}`}>
                <span className="activity-marker activity-marker-blue"><IconUsers size={15} /></span>
                <span>
                  <strong>В реестр внесён {item.nickname}</strong>
                  <small>{item.reg_number} · {formatDateTime(item.created_at)}</small>
                </span>
              </Link>
            ))}
            {!loading &&
              !data?.recent.cases.length &&
              !data?.recent.transactions.length &&
              !data?.recent.citizens.length && (
                <div className="dashboard-empty">События появятся после начала работы системы</div>
              )}
          </div>
        </section>

        <aside className="dashboard-side">
          {hasPermission('taxes.view') && (
            <Link to="/taxes" className={`attention-card ${hasAttention ? 'has-alert' : ''}`}>
              <div className="attention-icon"><IconAlertCircle size={20} /></div>
              <div>
                <span>Требует внимания</span>
                <strong>
                  {hasAttention
                    ? `${number(metrics?.unpaid_taxes_count ?? 0)} неоплаченных начислений`
                    : 'Критичных задач нет'}
                </strong>
                <small>
                  {hasAttention
                    ? `Сумма задолженности: ${number(metrics?.unpaid_taxes_amount ?? 0)} у.е.`
                    : 'Все контролируемые показатели в норме'}
                </small>
              </div>
              <IconArrowUpRight size={18} />
            </Link>
          )}

          <section className="dashboard-panel system-card">
            <div className="system-card-header">
              <span className="system-pulse" />
              <div>
                <strong>СОНАР online</strong>
                <small>Защищённый контур</small>
              </div>
            </div>
            <div className="system-row">
              <span>Активных законов</span>
              <strong>{number(metrics?.active_laws ?? null)}</strong>
            </div>
            <div className="system-row">
              <span>Состояние данных</span>
              <strong className="system-ok">Актуально</strong>
            </div>
            <div className="system-signature">SONAR / PELGARIA / {new Date().getFullYear()}</div>
          </section>
        </aside>
      </div>
    </div>
  )
}
