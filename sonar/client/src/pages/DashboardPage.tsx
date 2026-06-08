import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconAlertCircle,
  IconArrowRight,
  IconBuilding,
  IconBuildingBank,
  IconFileText,
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
    cases: Array<{ id: string; number: string; status: string; opened_at: string; accused: { nickname: string } }>
    transactions: Array<{ id: string; amount: number; description: string; created_at: string; performed_by: { login: string } }>
    citizens: Array<{ id: string; nickname: string; reg_number: string; created_at: string }>
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
    { label: 'Граждан в реестре', value: formatNumber(metrics?.citizens ?? null), to: '/citizens', permission: 'citizens.view' },
    { label: 'Дел в работе', value: formatNumber(metrics?.active_cases ?? null), to: '/cases', permission: 'cases.view' },
    { label: 'Баланс казны', value: `${formatNumber(metrics?.treasury_balance ?? null)} у.е.`, to: '/treasury', permission: 'treasury.view' },
    { label: 'Объектов РЕЛИКТ', value: formatNumber(metrics?.active_buildings ?? null), to: '/buildings', permission: 'relict.view' },
  ].filter((item) => hasPermission(item.permission))

  const quickLinks = [
    { to: '/citizens', label: 'Реестр граждан', description: 'Карточки и учётные сведения', icon: IconUsers, permission: 'citizens.view' },
    { to: '/passports', label: 'Паспорта', description: 'Выдача и проверка документов', icon: IconId, permission: 'passports.view' },
    { to: '/laws', label: 'Законодательство', description: 'Законы, указы и архив', icon: IconScale, permission: 'laws.view' },
    { to: '/print-center', label: 'Центр документов', description: 'Формы, справки и выписки', icon: IconFileText },
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
  ].slice(0, 7)

  const hasDebt = (metrics?.unpaid_taxes_count ?? 0) > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="page-kicker">Рабочий стол</span>
          <h1>{greeting}, {user?.login}</h1>
          <p>Краткая сводка и последние изменения в государственных реестрах.</p>
        </div>
        <div className="dashboard-date">
          <span>{new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(new Date())}</span>
          <strong>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date())}</strong>
        </div>
      </header>

      <section className="dashboard-summary" aria-label="Основные показатели">
        {loading
          ? [0, 1, 2, 3].map((item) => <div className="summary-item skeleton" key={item} />)
          : summaries.map((item) => (
            <Link to={item.to} className="summary-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <IconArrowRight size={17} />
            </Link>
          ))}
      </section>

      <div className="dashboard-layout">
        <section className="dashboard-section activity-section">
          <header className="dashboard-section-header">
            <div><span>Обновления</span><h2>Последние события</h2></div>
            <span className="system-status"><i /> Данные актуальны</span>
          </header>
          <div className="activity-list">
            {events.map((event) => {
              const Icon = event.icon
              return (
                <Link to={event.to} className="activity-item" key={event.key}>
                  <span className="activity-marker"><Icon size={17} /></span>
                  <span><strong>{event.title}</strong><small>{event.meta}</small></span>
                  <IconArrowRight size={16} />
                </Link>
              )
            })}
            {!loading && events.length === 0 && <div className="dashboard-empty">Новых событий пока нет.</div>}
          </div>
        </section>

        <aside className="dashboard-aside">
          <section className="dashboard-section quick-section">
            <header className="dashboard-section-header"><div><span>Быстрый доступ</span><h2>Основные операции</h2></div></header>
            <div className="quick-list">
              {quickLinks.map((item) => {
                const Icon = item.icon
                return (
                  <Link to={item.to} key={item.to}>
                    <span><Icon size={18} /></span>
                    <div><strong>{item.label}</strong><small>{item.description}</small></div>
                    <IconArrowRight size={16} />
                  </Link>
                )
              })}
            </div>
          </section>

          {hasPermission('taxes.view') && (
            <Link to="/taxes" className={`attention-card${hasDebt ? ' has-alert' : ''}`}>
              <IconAlertCircle size={20} />
              <div>
                <span>Контроль начислений</span>
                <strong>{hasDebt ? `${formatNumber(metrics?.unpaid_taxes_count ?? 0)} требуют оплаты` : 'Просроченных начислений нет'}</strong>
                <small>{hasDebt ? `Общая сумма: ${formatNumber(metrics?.unpaid_taxes_amount ?? 0)} у.е.` : 'Проверка выполнена автоматически'}</small>
              </div>
              <IconArrowRight size={16} />
            </Link>
          )}

          <section className="system-note">
            <IconBuilding size={19} />
            <div><strong>СОНАР работает штатно</strong><span>{formatNumber(metrics?.active_laws ?? null)} действующих законов в системе</span></div>
          </section>
        </aside>
      </div>
    </div>
  )
}
