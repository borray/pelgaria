import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconBulb,
  IconCheck,
  IconGavel,
  IconMessagePlus,
  IconPlus,
  IconPrinter,
  IconRefreshDot,
  IconSearch,
  IconStack2,
  IconTrash,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type { InitiativeStatus, InitiativeType, ProjectInitiative } from '../types'
import { usePermission } from '../hooks/usePermission'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { RegistryMark } from '../components/ui/RegistryMark'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate, formatDateTime } from '../utils/formatters'
import { printPdf } from '../utils/pdf'

const TYPE_LABELS: Record<InitiativeType, string> = {
  BUILDING: 'Здание',
  ORGANIZATION: 'Организация',
  DEPARTMENT: 'Ведомство',
  COMPANY: 'Компания',
  LAW: 'Закон',
  CAMPAIGN: 'Акция',
  DEVELOPMENT: 'Направление развития',
  POLICY: 'Политика',
  OTHER: 'Иное',
}

const STATUS_LABELS: Record<InitiativeStatus, string> = {
  SUBMITTED: 'Подана',
  UNDER_REVIEW: 'На рассмотрении',
  ACCEPTED: 'Принята',
  REJECTED: 'Отклонена',
  REVISION: 'На доработке',
  IMPLEMENTED: 'Реализована',
  ARCHIVED: 'Архив',
}

const STATUS_COLORS: Record<InitiativeStatus, string> = {
  SUBMITTED: '#2563EB',
  UNDER_REVIEW: '#7C3AED',
  ACCEPTED: '#16805C',
  REJECTED: '#B42318',
  REVISION: '#D97706',
  IMPLEMENTED: '#0F766E',
  ARCHIVED: '#6B7280',
}

// Делопроизводственные статусы (Канцелярия) и статусы решения (Совет).
const OFFICE_STATUSES: InitiativeStatus[] = ['SUBMITTED', 'UNDER_REVIEW']
const DECISION_STATUSES: InitiativeStatus[] = ['ACCEPTED', 'REJECTED', 'REVISION', 'IMPLEMENTED', 'ARCHIVED']

const EMPTY_FORM = {
  type: 'DEVELOPMENT' as InitiativeType,
  title: '',
  initiator: '',
  essence: '',
  state_request: '',
  responsible: '',
}

interface InitiativeStats {
  total: number
  review: number
  accepted: number
  revision: number
}

export function ProjectInitiativesPage() {
  const canCreate = usePermission('initiatives.create')
  const canManage = usePermission('initiatives.manage')
  const canDecide = usePermission('initiatives.decide')
  const isSuperadmin = useAuthStore((state) => state.hasPermission('system.superadmin'))
  const canDelete = isSuperadmin

  const [items, setItems] = useState<ProjectInitiative[]>([])
  const [stats, setStats] = useState<InitiativeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [selected, setSelected] = useState<ProjectInitiative | null>(null)
  const [editStatus, setEditStatus] = useState<InitiativeStatus>('SUBMITTED')
  const [editResponsible, setEditResponsible] = useState('')
  const [editDecisionNote, setEditDecisionNote] = useState('')
  const [note, setNote] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const statusOptions = useMemo(() => {
    const allowed = canDecide ? [...OFFICE_STATUSES, ...DECISION_STATUSES] : OFFICE_STATUSES
    return allowed.map((value) => ({ value, label: STATUS_LABELS[value] }))
  }, [canDecide])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      const suffix = params.toString() ? `?${params}` : ''
      const [listRes, statsRes] = await Promise.all([
        apiClient.get<ProjectInitiative[]>(`/project-initiatives${suffix}`),
        apiClient.get<InitiativeStats>('/project-initiatives/stats'),
      ])
      setItems(listRes.data)
      setStats(statsRes.data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter])

  useEffect(() => {
    const timer = window.setTimeout(fetchItems, 250)
    return () => window.clearTimeout(timer)
  }, [fetchItems])

  const openDetails = (initiative: ProjectInitiative) => {
    setSelected(initiative)
    setEditStatus(initiative.status)
    setEditResponsible(initiative.responsible ?? '')
    setEditDecisionNote(initiative.decision_note ?? '')
    setNote('')
    setDetailError(null)
  }

  const refreshSelected = async (id: string) => {
    const response = await apiClient.get<ProjectInitiative>(`/project-initiatives/${id}`)
    setSelected(response.data)
    setItems((current) => current.map((item) => item.id === id ? response.data : item))
  }

  const createInitiative = async () => {
    if (!createForm.title.trim() || !createForm.initiator.trim() || !createForm.essence.trim() || !createForm.state_request.trim()) {
      setCreateError('Заполните название, инициатора, суть и что требуется от государства')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const response = await apiClient.post<ProjectInitiative>('/project-initiatives', {
        ...createForm,
        responsible: createForm.responsible || null,
      })
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      await fetchItems()
      openDetails(response.data)
    } catch (error: unknown) {
      setCreateError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось зарегистрировать инициативу')
    } finally {
      setCreateLoading(false)
    }
  }

  const updateInitiative = async () => {
    if (!selected) return
    setUpdateLoading(true)
    setDetailError(null)
    try {
      await apiClient.patch(`/project-initiatives/${selected.id}`, {
        status: editStatus,
        responsible: editResponsible || null,
        decision_note: editDecisionNote || null,
      })
      await refreshSelected(selected.id)
      await fetchItems()
    } catch (error: unknown) {
      setDetailError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось сохранить изменения')
    } finally {
      setUpdateLoading(false)
    }
  }

  const addNote = async () => {
    if (!selected || !note.trim()) return
    setUpdateLoading(true)
    setDetailError(null)
    try {
      await apiClient.post(`/project-initiatives/${selected.id}/events`, { message: note })
      setNote('')
      await refreshSelected(selected.id)
    } catch (error: unknown) {
      setDetailError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось добавить отметку')
    } finally {
      setUpdateLoading(false)
    }
  }

  const deleteInitiative = async () => {
    if (!selected) return
    if (!window.confirm(`Удалить инициативу ${selected.number} из реестра? Действие необратимо.`)) return
    setUpdateLoading(true)
    setDetailError(null)
    try {
      await apiClient.delete(`/project-initiatives/${selected.id}`)
      setSelected(null)
      await fetchItems()
    } catch (error: unknown) {
      setDetailError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось удалить инициативу')
    } finally {
      setUpdateLoading(false)
    }
  }

  const visibleStats = useMemo(() => [
    { label: 'Всего в реестре', value: stats?.total ?? 0, icon: IconStack2 },
    { label: 'На рассмотрении', value: stats?.review ?? 0, icon: IconRefreshDot },
    { label: 'Приняты', value: stats?.accepted ?? 0, icon: IconCheck },
    { label: 'На доработке', value: stats?.revision ?? 0, icon: IconGavel, alert: Boolean(stats?.revision) },
  ], [stats])

  const columns: TableColumn<ProjectInitiative>[] = [
    {
      key: 'number',
      header: 'Рег. номер',
      width: '160px',
      render: (row) => (
        <div>
          <strong>{row.number}</strong>
          <div className="table-secondary">{formatDate(row.submitted_at)}</div>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Инициатива',
      render: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div className="table-secondary">{TYPE_LABELS[row.type]} · {row.initiator}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '150px',
      render: (row) => <Badge status={row.status} label={STATUS_LABELS[row.status]} color={STATUS_COLORS[row.status]} />,
    },
    {
      key: 'responsible',
      header: 'Ответственный',
      width: '150px',
      render: (row) => row.responsible ?? 'Не назначен',
    },
    {
      key: 'registry_code',
      header: 'ШК',
      width: '205px',
      render: (row) => <RegistryMark code={row.registry_code} compact />,
    },
  ]

  const isDecisionStatus = DECISION_STATUSES.includes(editStatus)

  return (
    <div className="office-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Канцелярия Верховного Совета</span>
          <h1>Проектные инициативы</h1>
          <p>Единый реестр инициатив Пельграда: регистрация, рассмотрение и решения Верховного Совета.</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => { setCreateError(null); setCreateForm(EMPTY_FORM); setCreateOpen(true) }}>
            <IconPlus size={16} /> Подать инициативу
          </Button>
        )}
      </div>

      <div className="office-stats">
        {visibleStats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={item.alert ? 'is-alert' : ''}>
              <Icon size={19} />
              <span>{item.label}<strong>{item.value}</strong></span>
            </div>
          )
        })}
      </div>

      <section className="office-register">
        <div className="section-heading office-toolbar-heading">
          <div><span>Реестр СОНАР</span><h2>Зарегистрированные инициативы</h2></div>
          <div className="office-toolbar">
            <label className="archive-search">
              <IconSearch size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Номер, ШК, название, инициатор" />
            </label>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              placeholder="Все статусы"
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              placeholder="Все типы"
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </div>
        {!loading && items.length === 0
          ? <EmptyState title="Инициативы не найдены" description="Измените фильтры или подайте новую проектную инициативу." />
          : <Table columns={columns} data={items} keyExtractor={(row) => row.id} loading={loading} onRowClick={openDetails} />}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Подать проектную инициативу"
        description="Канцелярия Верховного Совета присвоит регистрационный номер СОНАР и контрольный ШК."
        width={780}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button variant="primary" loading={createLoading} onClick={createInitiative}><IconBulb size={15} /> Зарегистрировать</Button>
          </>
        )}
      >
        <div className="form-section-stack">
          <section className="form-section">
            <div className="form-section-heading"><span>01</span><div><strong>Классификация</strong><small>Тип проекта и ответственный</small></div></div>
            <div className="form-grid">
              <Select label="Тип проекта" value={createForm.type} onChange={(event) => setCreateForm({ ...createForm, type: event.target.value as InitiativeType })} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input label="Ответственный" value={createForm.responsible} onChange={(event) => setCreateForm({ ...createForm, responsible: event.target.value })} placeholder="Необязательно" />
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-heading"><span>02</span><div><strong>Инициатива</strong><small>Кто подаёт и название</small></div></div>
            <div className="form-grid">
              <Input label="Инициатор *" value={createForm.initiator} onChange={(event) => setCreateForm({ ...createForm, initiator: event.target.value })} maxLength={180} placeholder="Игрок, организация или ведомство" />
              <Input label="Название инициативы *" value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} maxLength={180} />
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-heading"><span>03</span><div><strong>Содержание</strong><small>Суть и что требуется от государства</small></div></div>
            <label className="office-textarea-label">Суть инициативы *</label>
            <textarea className="document-textarea" rows={6} value={createForm.essence} onChange={(event) => setCreateForm({ ...createForm, essence: event.target.value })} />
            <label className="office-textarea-label">Что требуется от государства *</label>
            <textarea className="document-textarea" rows={5} value={createForm.state_request} onChange={(event) => setCreateForm({ ...createForm, state_request: event.target.value })} />
          </section>
          {createError && <div className="form-error">{createError}</div>}
        </div>
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.number} · ${selected.title}` : 'Карточка инициативы'}
        description={selected ? `${TYPE_LABELS[selected.type]} · подана ${formatDateTime(selected.submitted_at)}` : undefined}
        width={940}
        footer={selected && (
          <>
            {canDelete && <Button variant="danger" loading={updateLoading} onClick={deleteInitiative}><IconTrash size={15} /> Удалить</Button>}
            <Button variant="secondary" onClick={() => printPdf(`/api/project-initiatives/${selected.id}/pdf`)}><IconPrinter size={15} /> Сформировать</Button>
            {(canManage || canDecide) && <Button variant="primary" loading={updateLoading} onClick={updateInitiative}>Сохранить</Button>}
          </>
        )}
      >
        {selected && (
          <div className="office-detail">
            <div className="office-detail-identity">
              <div>
                <RegistryMark code={selected.registry_code} />
                <p>{selected.essence}</p>
              </div>
              <Badge status={selected.status} label={STATUS_LABELS[selected.status]} color={STATUS_COLORS[selected.status]} />
            </div>

            <div className="office-detail-grid">
              <div><span>Инициатор</span><strong>{selected.initiator}</strong></div>
              <div><span>Тип проекта</span><strong>{TYPE_LABELS[selected.type]}</strong></div>
              <div><span>Ответственный</span><strong>{selected.responsible ?? 'Не назначен'}</strong></div>
              <div><span>Зарегистрировал</span><strong>{selected.created_by.login}</strong></div>
            </div>

            <section className="form-section">
              <div className="form-section-heading"><span>01</span><div><strong>Что требуется от государства</strong></div></div>
              <p className="initiative-readonly">{selected.state_request}</p>
            </section>

            {(canManage || canDecide) && (
              <section className="form-section">
                <div className="form-section-heading"><span>02</span><div><strong>Делопроизводство и решение</strong><small>Изменение статуса автоматически попадёт в журнал</small></div></div>
                <div className="form-grid">
                  <Select label="Статус" value={editStatus} onChange={(event) => setEditStatus(event.target.value as InitiativeStatus)} options={statusOptions} />
                  <Input label="Ответственный" value={editResponsible} onChange={(event) => setEditResponsible(event.target.value)} placeholder="Не назначен" />
                  <div className="span-2">
                    <label className="office-textarea-label">{isDecisionStatus ? 'Резолюция / основание решения' : 'Служебная резолюция'}</label>
                    <textarea className="document-textarea" rows={4} value={editDecisionNote} onChange={(event) => setEditDecisionNote(event.target.value)} placeholder={canDecide ? 'Решение Совета вступает в силу после подписи' : 'Доступно Совету'} disabled={!canDecide && isDecisionStatus} />
                  </div>
                </div>
                {!canDecide && <p className="initiative-hint">Перевод в статусы решения (принята/отклонена/на доработке/реализована/архив) доступен только Совету.</p>}
              </section>
            )}

            {selected.decided_by_login && (
              <div className="office-detail-grid">
                <div><span>Решение подписал</span><strong>{selected.decided_by_login}</strong></div>
                <div><span>Дата решения</span><strong>{selected.decided_at ? formatDateTime(selected.decided_at) : '—'}</strong></div>
              </div>
            )}

            <section className="office-history">
              <div className="section-heading">
                <div><span>Аудит</span><h2>История рассмотрения</h2></div>
              </div>
              {canManage && (
                <div className="office-note-compose">
                  <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Добавить служебную отметку" onKeyDown={(event) => { if (event.key === 'Enter') addNote() }} />
                  <Button variant="secondary" disabled={!note.trim()} loading={updateLoading} onClick={addNote}><IconMessagePlus size={15} /> Добавить</Button>
                </div>
              )}
              <div className="office-timeline">
                {selected.events.map((event) => (
                  <div key={event.id}>
                    <span className="office-timeline-dot" />
                    <strong>{event.message}</strong>
                    <small>{event.created_by.login} · {formatDateTime(event.created_at)}</small>
                  </div>
                ))}
              </div>
            </section>
            {detailError && <div className="form-error">{detailError}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
