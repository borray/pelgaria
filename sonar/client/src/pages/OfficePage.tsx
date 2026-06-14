import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconInbox,
  IconMessagePlus,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconUserCheck,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type {
  Citizen,
  ServiceRequest,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
} from '../types'
import { usePermission } from '../hooks/usePermission'
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

interface OfficeStats {
  total: number
  active: number
  overdue: number
  urgent: number
  completed_today: number
}

interface StaffMember {
  id: string
  login: string
  role: { name: string }
}

const TYPE_LABELS: Record<ServiceRequestType, string> = {
  APPLICATION: 'Заявление',
  COMPLAINT: 'Жалоба',
  PETITION: 'Ходатайство',
  SERVICE: 'Запрос услуги',
  INTERNAL: 'Служебное поручение',
}

const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  RECEIVED: 'Принято',
  REVIEW: 'На рассмотрении',
  IN_PROGRESS: 'В работе',
  WAITING: 'Ожидает сведений',
  COMPLETED: 'Исполнено',
  REJECTED: 'Отказано',
  CANCELLED: 'Отменено',
}

const STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  RECEIVED: '#2563EB',
  REVIEW: '#7C3AED',
  IN_PROGRESS: '#D97706',
  WAITING: '#64748B',
  COMPLETED: '#16805C',
  REJECTED: '#B42318',
  CANCELLED: '#6B7280',
}

const PRIORITY_LABELS: Record<ServiceRequestPriority, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
}

const EMPTY_FORM = {
  type: 'APPLICATION' as ServiceRequestType,
  title: '',
  description: '',
  contact: '',
  priority: 'NORMAL' as ServiceRequestPriority,
  citizen_id: '',
  assignee_id: '',
  due_at: '',
}

const isOpen = (status: ServiceRequestStatus) =>
  ['RECEIVED', 'REVIEW', 'IN_PROGRESS', 'WAITING'].includes(status)

export function OfficePage({ serviceSessionId, embedded = false }: { serviceSessionId?: string; embedded?: boolean } = {}) {
  const canCreate = usePermission('office.create')
  const canManage = usePermission('office.manage')
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [stats, setStats] = useState<OfficeStats | null>(null)
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ServiceRequest | null>(null)
  const [editStatus, setEditStatus] = useState<ServiceRequestStatus>('RECEIVED')
  const [editPriority, setEditPriority] = useState<ServiceRequestPriority>('NORMAL')
  const [editAssignee, setEditAssignee] = useState('')
  const [editDueAt, setEditDueAt] = useState('')
  const [editResolution, setEditResolution] = useState('')
  const [note, setNote] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (mineOnly) params.set('mine', 'true')
      if (serviceSessionId) params.set('service_session_id', serviceSessionId)
      const suffix = params.toString() ? `?${params}` : ''
      const [requestRes, statsRes] = await Promise.all([
        apiClient.get<ServiceRequest[]>(`/office${suffix}`),
        apiClient.get<OfficeStats>('/office/stats'),
      ])
      setRequests(requestRes.data)
      setStats(statsRes.data)
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [mineOnly, search, serviceSessionId, statusFilter, typeFilter])

  useEffect(() => {
    Promise.allSettled([
      apiClient.get<Citizen[]>('/citizens'),
      apiClient.get<StaffMember[]>('/office/staff'),
    ]).then(([citizenResult, staffResult]) => {
      if (citizenResult.status === 'fulfilled') setCitizens(citizenResult.value.data)
      if (staffResult.status === 'fulfilled') setStaff(staffResult.value.data)
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(fetchRequests, 250)
    return () => window.clearTimeout(timer)
  }, [fetchRequests])

  const openDetails = (request: ServiceRequest) => {
    setSelected(request)
    setEditStatus(request.status)
    setEditPriority(request.priority)
    setEditAssignee(request.assignee_id ?? '')
    setEditDueAt(request.due_at ? request.due_at.slice(0, 10) : '')
    setEditResolution(request.resolution ?? '')
    setNote('')
    setDetailError(null)
  }

  const refreshSelected = async (id: string) => {
    const response = await apiClient.get<ServiceRequest>(`/office/${id}`)
    setSelected(response.data)
    setRequests((current) => current.map((item) => item.id === id ? response.data : item))
  }

  const createRequest = async () => {
    if (!createForm.title.trim() || !createForm.description.trim()) {
      setCreateError('Укажите тему и содержание обращения')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const response = await apiClient.post<ServiceRequest>('/office', {
        ...createForm,
        service_session_id: serviceSessionId || null,
        citizen_id: createForm.citizen_id || null,
        assignee_id: createForm.assignee_id || null,
        due_at: createForm.due_at || null,
      })
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      await fetchRequests()
      openDetails(response.data)
    } catch (error: unknown) {
      setCreateError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось зарегистрировать обращение')
    } finally {
      setCreateLoading(false)
    }
  }

  const updateRequest = async () => {
    if (!selected) return
    setUpdateLoading(true)
    setDetailError(null)
    try {
      await apiClient.patch(`/office/${selected.id}`, {
        status: editStatus,
        priority: editPriority,
        assignee_id: editAssignee || null,
        due_at: editDueAt || null,
        resolution: editResolution,
      })
      await refreshSelected(selected.id)
      await fetchRequests()
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
      await apiClient.post(`/office/${selected.id}/events`, { message: note })
      setNote('')
      await refreshSelected(selected.id)
    } catch (error: unknown) {
      setDetailError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось добавить отметку')
    } finally {
      setUpdateLoading(false)
    }
  }

  const visibleStats = useMemo(() => [
    { label: 'В работе', value: stats?.active ?? 0, icon: IconInbox },
    { label: 'Просрочено', value: stats?.overdue ?? 0, icon: IconAlertTriangle, alert: Boolean(stats?.overdue) },
    { label: 'Срочные', value: stats?.urgent ?? 0, icon: IconClock, alert: Boolean(stats?.urgent) },
    { label: 'Исполнено сегодня', value: stats?.completed_today ?? 0, icon: IconCheck },
  ], [stats])

  const columns: TableColumn<ServiceRequest>[] = [
    {
      key: 'number',
      header: 'Обращение',
      width: '190px',
      render: (row) => (
        <div>
          <strong>{row.number}</strong>
          <div className="table-secondary">{TYPE_LABELS[row.type]}</div>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Тема',
      render: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div className="table-secondary">{row.citizen ? `${row.citizen.nickname} · ${row.citizen.reg_number}` : row.contact || 'Без заявителя'}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '145px',
      render: (row) => <Badge status={row.status} label={STATUS_LABELS[row.status]} color={STATUS_COLORS[row.status]} />,
    },
    {
      key: 'assignee',
      header: 'Ответственный',
      width: '150px',
      render: (row) => row.assignee?.login ?? 'Не назначен',
    },
    {
      key: 'due_at',
      header: 'Срок',
      width: '115px',
      render: (row) => {
        const overdue = row.due_at && isOpen(row.status) && new Date(row.due_at) < new Date()
        return <span className={overdue ? 'office-deadline is-overdue' : 'office-deadline'}>{row.due_at ? formatDate(row.due_at) : '—'}</span>
      },
    },
    {
      key: 'registry_code',
      header: 'ШК',
      width: '205px',
      render: (row) => <RegistryMark code={row.registry_code} compact />,
    },
  ]

  return (
    <div className="office-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Документооборот</span>
          <h1>{embedded ? 'Заявки обращения' : 'Приёмная'}</h1>
          <p>{embedded ? 'Все заявки на этой странице автоматически связаны с текущим делом СОНАР-КОНТАКТ.' : 'Обращения игроков, заявления, жалобы и служебные поручения с контролем исполнения.'}</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => { setCreateError(null); setCreateOpen(true) }}>
            <IconPlus size={16} /> Зарегистрировать
          </Button>
        )}
      </div>

      {!embedded && <div className="office-stats">
        {visibleStats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={item.alert ? 'is-alert' : ''}>
              <Icon size={19} />
              <span>{item.label}<strong>{item.value}</strong></span>
            </div>
          )
        })}
      </div>}

      <section className="office-register">
        <div className="section-heading office-toolbar-heading">
          <div><span>Единый журнал</span><h2>Зарегистрированные обращения</h2></div>
          <div className="office-toolbar">
            <label className="archive-search">
              <IconSearch size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Номер, ШК, тема, игрок" />
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
            <button className={`office-mine-toggle${mineOnly ? ' is-active' : ''}`} onClick={() => setMineOnly((value) => !value)}>
              <IconUserCheck size={15} /> Только мои
            </button>
          </div>
        </div>
        {!loading && requests.length === 0
          ? <EmptyState title="Обращения не найдены" description="Измените фильтры или зарегистрируйте новое обращение." />
          : <Table columns={columns} data={requests} keyExtractor={(row) => row.id} loading={loading} onRowClick={openDetails} />}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Зарегистрировать обращение"
        description="Система присвоит официальный номер и контрольный ШК."
        width={760}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button variant="primary" loading={createLoading} onClick={createRequest}><IconInbox size={15} /> Зарегистрировать</Button>
          </>
        )}
      >
        <div className="form-section-stack">
          <section className="form-section">
            <div className="form-section-heading"><span>01</span><div><strong>Классификация</strong><small>Тип, приоритет и срок исполнения</small></div></div>
            <div className="form-grid">
              <Select label="Тип обращения" value={createForm.type} onChange={(event) => setCreateForm({ ...createForm, type: event.target.value as ServiceRequestType })} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              <Select label="Приоритет" value={createForm.priority} onChange={(event) => setCreateForm({ ...createForm, priority: event.target.value as ServiceRequestPriority })} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input label="Срок исполнения" type="date" value={createForm.due_at} onChange={(event) => setCreateForm({ ...createForm, due_at: event.target.value })} />
              <Select label="Ответственный" searchable value={createForm.assignee_id} onChange={(event) => setCreateForm({ ...createForm, assignee_id: event.target.value })} placeholder="Назначить позже" options={staff.map((item) => ({ value: item.id, label: `${item.login} · ${item.role.name}` }))} />
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-heading"><span>02</span><div><strong>Заявитель</strong><small>Привязка к реестру необязательна</small></div></div>
            <div className="form-grid">
              <Select label="Игрок" searchable value={createForm.citizen_id} onChange={(event) => setCreateForm({ ...createForm, citizen_id: event.target.value })} placeholder="Не указан" options={citizens.map((item) => ({ value: item.id, label: `${item.nickname} · ${item.reg_number}` }))} />
              <Input label="Контакт или источник" value={createForm.contact} onChange={(event) => setCreateForm({ ...createForm, contact: event.target.value })} placeholder="Discord, ведомство, личный приём" />
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-heading"><span>03</span><div><strong>Содержание</strong><small>Краткая тема и полное описание</small></div></div>
            <Input label="Тема обращения *" value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} maxLength={180} />
            <label className="office-textarea-label">Содержание обращения *</label>
            <textarea className="document-textarea" rows={7} value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} />
          </section>
          {createError && <div className="form-error">{createError}</div>}
        </div>
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.number} · ${selected.title}` : 'Карточка обращения'}
        description={selected ? `${TYPE_LABELS[selected.type]} · зарегистрировано ${formatDateTime(selected.created_at)}` : undefined}
        width={920}
        footer={selected && (
          <>
            <Button variant="secondary" onClick={() => printPdf(`/api/office/${selected.id}/pdf`)}><IconPrinter size={15} /> Сформировать</Button>
            {canManage && <Button variant="primary" loading={updateLoading} onClick={updateRequest}>Сохранить изменения</Button>}
          </>
        )}
      >
        {selected && (
          <div className="office-detail">
            <div className="office-detail-identity">
              <div>
                <RegistryMark code={selected.registry_code} />
                <p>{selected.description}</p>
              </div>
              <Badge status={selected.status} label={STATUS_LABELS[selected.status]} color={STATUS_COLORS[selected.status]} />
            </div>

            <div className="office-detail-grid">
              <div><span>Заявитель</span><strong>{selected.citizen ? `${selected.citizen.nickname} · ${selected.citizen.reg_number}` : selected.contact || 'Не указан'}</strong></div>
              <div><span>Регистратор</span><strong>{selected.created_by.login}</strong></div>
              <div><span>Ответственный</span><strong>{selected.assignee?.login ?? 'Не назначен'}</strong></div>
              <div><span>Срок</span><strong>{selected.due_at ? formatDate(selected.due_at) : 'Не установлен'}</strong></div>
            </div>

            {canManage && (
              <section className="form-section">
                <div className="form-section-heading"><span>01</span><div><strong>Исполнение</strong><small>Изменение статуса автоматически попадёт в журнал</small></div></div>
                <div className="form-grid">
                  <Select label="Статус" value={editStatus} onChange={(event) => setEditStatus(event.target.value as ServiceRequestStatus)} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
                  <Select label="Приоритет" value={editPriority} onChange={(event) => setEditPriority(event.target.value as ServiceRequestPriority)} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
                  <Select label="Ответственный" searchable value={editAssignee} onChange={(event) => setEditAssignee(event.target.value)} placeholder="Не назначен" options={staff.map((item) => ({ value: item.id, label: `${item.login} · ${item.role.name}` }))} />
                  <Input label="Срок исполнения" type="date" value={editDueAt} onChange={(event) => setEditDueAt(event.target.value)} />
                  <div className="span-2">
                    <label className="office-textarea-label">Резолюция / итог исполнения</label>
                    <textarea className="document-textarea" rows={4} value={editResolution} onChange={(event) => setEditResolution(event.target.value)} />
                  </div>
                </div>
              </section>
            )}

            <section className="office-history">
              <div className="section-heading">
                <div><span>Аудит</span><h2>История исполнения</h2></div>
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
