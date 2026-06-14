import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconArchive,
  IconArrowRight,
  IconBrandDiscord,
  IconCalendar,
  IconCheck,
  IconClipboardText,
  IconClock,
  IconDeviceGamepad2,
  IconFileText,
  IconForms,
  IconInbox,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTrash,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type { Citizen, GeneratedDocument, ServiceAttachment, ServiceRequest, ServiceSession, ServiceSessionMode } from '../types'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ActionMenu } from '../components/ui/ActionMenu'
import { formatDateTime } from '../utils/formatters'
import { printPdf } from '../utils/pdf'
import { PrintCenterPage } from './PrintCenterPage'

type ContactTab = 'queue' | 'archive' | 'materials' | 'print'
type ContactChannel = 'GAME' | 'DISCORD' | 'FORM' | 'INTERNAL'

interface RegistryData {
  documents: Array<GeneratedDocument & { service_session?: Pick<ServiceSession, 'id' | 'number'> | null }>
  requests: Array<ServiceRequest & { service_session?: Pick<ServiceSession, 'id' | 'number'> | null }>
  attachments: Array<ServiceAttachment & { session: Pick<ServiceSession, 'id' | 'number' | 'subject'> }>
}

const channels: Array<{ value: ContactChannel; title: string; text: string; icon: typeof IconUser; mode: ServiceSessionMode }> = [
  { value: 'GAME', title: 'Игрок на связи', text: 'Работа в игре, голосе или при непосредственном диалоге.', icon: IconDeviceGamepad2, mode: 'ONLINE' },
  { value: 'DISCORD', title: 'Удалённое обращение', text: 'Заявка или сведения получены через Discord.', icon: IconBrandDiscord, mode: 'ONLINE' },
  { value: 'FORM', title: 'Готовая заявка', text: 'Игрок заранее прислал форму, скриншот или файл.', icon: IconForms, mode: 'OFFLINE' },
  { value: 'INTERNAL', title: 'Внутренняя работа', text: 'Операция сотрудника без участия игрока.', icon: IconSettings, mode: 'INTERNAL' },
]

const statusCopy: Record<string, { label: string; group: 'active' | 'waiting' | 'done' }> = {
  ACTIVE: { label: 'В работе', group: 'active' },
  WAITING_SCAN: { label: 'Ждём игрока', group: 'waiting' },
  REVIEW: { label: 'На рассмотрении', group: 'waiting' },
  COMPLETED: { label: 'Исполнено', group: 'done' },
  CANCELLED: { label: 'Отменено', group: 'done' },
}

const requestStatusLabels: Record<string, string> = {
  RECEIVED: 'Принято',
  REVIEW: 'На рассмотрении',
  IN_PROGRESS: 'В работе',
  WAITING: 'Ожидает сведений',
  COMPLETED: 'Исполнено',
  REJECTED: 'Отказано',
  CANCELLED: 'Отменено',
}

export function ServiceCenterPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const isHeadOfState = useAuthStore((state) => state.user?.role?.name === 'Глава государства')
  const requestedTab = params.get('tab')
  const [tab, setTabState] = useState<ContactTab>(
    requestedTab && ['queue', 'archive', 'materials', 'print'].includes(requestedTab)
      ? requestedTab as ContactTab
      : 'queue',
  )
  const [sessions, setSessions] = useState<ServiceSession[]>([])
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [registry, setRegistry] = useState<RegistryData>({ documents: [], requests: [], attachments: [] })
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [createOpen, setCreateOpen] = useState(false)
  const [channel, setChannel] = useState<ContactChannel>('GAME')
  const [subject, setSubject] = useState('')
  const [contact, setContact] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceSession | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<RegistryData['requests'][number] | null>(null)

  const setTab = (next: ContactTab) => {
    setTabState(next)
    setParams(next === 'queue' ? {} : { tab: next }, { replace: true })
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const [sessionResponse, citizenResponse] = await Promise.all([
        apiClient.get<ServiceSession[]>('/service-center/sessions'),
        apiClient.get<Citizen[]>('/citizens'),
      ])
      setSessions(sessionResponse.data)
      setCitizens(citizenResponse.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRegistry = useCallback(async () => {
    const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''
    const response = await apiClient.get<RegistryData>(`/service-center/registry${suffix}`)
    setRegistry(response.data)
  }, [query])

  useEffect(() => { void fetchSessions() }, [fetchSessions])
  useEffect(() => {
    if (tab !== 'materials') return
    const timer = window.setTimeout(() => void fetchRegistry(), 250)
    return () => window.clearTimeout(timer)
  }, [fetchRegistry, tab])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return sessions.filter((item) => {
      const copy = `${item.number} ${item.subject} ${item.citizen?.nickname ?? ''} ${item.citizen?.reg_number ?? ''}`.toLowerCase()
      const matchesQuery = !normalized || copy.includes(normalized)
      const group = statusCopy[item.status]?.group
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'OPEN' && group !== 'done')
        || (statusFilter === 'WAITING' && group === 'waiting')
        || (statusFilter === 'DONE' && group === 'done')
      return matchesQuery && matchesStatus
    })
  }, [query, sessions, statusFilter])

  const archivedSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return sessions.filter((item) => {
      if (statusCopy[item.status]?.group !== 'done') return false
      const copy = `${item.number} ${item.subject} ${item.citizen?.nickname ?? ''} ${item.citizen?.reg_number ?? ''}`.toLowerCase()
      return !normalized || copy.includes(normalized)
    })
  }, [query, sessions])

  const stats = useMemo(() => ({
    active: sessions.filter((item) => statusCopy[item.status]?.group === 'active').length,
    waiting: sessions.filter((item) => statusCopy[item.status]?.group === 'waiting').length,
    today: sessions.filter((item) => new Date(item.started_at).toDateString() === new Date().toDateString()).length,
    done: sessions.filter((item) => item.status === 'COMPLETED').length,
  }), [sessions])

  const resetCreate = () => {
    setChannel('GAME')
    setSubject('')
    setContact('')
    setCitizenId('')
    setError(null)
  }

  const createContact = async () => {
    if (!subject.trim()) {
      setError('Укажите, зачем игрок обратился')
      return
    }
    const selectedChannel = channels.find((item) => item.value === channel)!
    setCreating(true)
    setError(null)
    try {
      const response = await apiClient.post<ServiceSession>('/service-center/sessions', {
        mode: selectedChannel.mode,
        subject: subject.trim(),
        contact: contact.trim(),
        citizen_id: channel === 'INTERNAL' ? null : citizenId || null,
        data: { channel, source: selectedChannel.title },
      })
      setCreateOpen(false)
      resetCreate()
      navigate(`/office/sessions/${response.data.id}`)
    } catch (requestError: unknown) {
      setError((requestError as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось создать обращение')
    } finally {
      setCreating(false)
    }
  }

  const deleteContact = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/service-center/sessions/${deleteTarget.id}`)
      setDeleteTarget(null)
      await fetchSessions()
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="contact-center">
      <header className="contact-hero">
        <div className="contact-hero-copy">
          <span>СОНАР · Контакт</span>
          <h1>Работа с игроками<br />без лишней бюрократии</h1>
          <p>Найдите игрока, зафиксируйте цель и оформите всё необходимое в одном обращении.</p>
          <div>
            <Button variant="primary" onClick={() => { resetCreate(); setCreateOpen(true) }}><IconPlus size={17} />Новое обращение</Button>
            <button type="button" onClick={() => setTab('archive')}><IconArchive size={16} />Архив обращений</button>
          </div>
        </div>
        <div className="contact-hero-pulse">
          <div><IconUsers size={30} /><strong>{stats.active}</strong><span>сейчас в работе</span></div>
          <i /><i /><i />
        </div>
      </header>

      <section className="contact-stats">
        <article><span><IconInbox size={18} /></span><div><small>В работе</small><strong>{stats.active}</strong></div></article>
        <article><span><IconClock size={18} /></span><div><small>Ждём игрока</small><strong>{stats.waiting}</strong></div></article>
        <article><span><IconSparkles size={18} /></span><div><small>Открыто сегодня</small><strong>{stats.today}</strong></div></article>
        <article><span><IconCheck size={18} /></span><div><small>Исполнено всего</small><strong>{stats.done}</strong></div></article>
      </section>

      <nav className="contact-tabs">
        <button className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}><IconInbox size={17} /><span><strong>Обращения</strong><small>Очередь работы с игроками</small></span></button>
        <button className={tab === 'archive' ? 'is-active' : ''} onClick={() => setTab('archive')}><IconArchive size={17} /><span><strong>Архив дел</strong><small>Завершённые и отменённые обращения</small></span></button>
        <button className={tab === 'materials' ? 'is-active' : ''} onClick={() => setTab('materials')}><IconArchive size={17} /><span><strong>Материалы</strong><small>Документы, заявки и файлы</small></span></button>
        <button className={tab === 'print' ? 'is-active' : ''} onClick={() => setTab('print')}><IconSettings size={17} /><span><strong>Печатный контур</strong><small>Дополнительный инструмент</small></span></button>
      </nav>

      {tab === 'queue' && (
        <div className="contact-queue-layout">
          <main className="contact-queue">
            <header>
              <div><span>Рабочая очередь</span><h2>Обращения игроков</h2></div>
              <Button variant="primary" onClick={() => { resetCreate(); setCreateOpen(true) }}><IconPlus size={15} />Создать</Button>
            </header>
            <div className="contact-toolbar">
              <label><IconSearch size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Игрок, номер или цель обращения" /></label>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[
                { value: 'OPEN', label: 'Открытые' },
                { value: 'WAITING', label: 'Ожидают' },
                { value: 'DONE', label: 'Завершённые' },
                { value: 'ALL', label: 'Все обращения' },
              ]} />
            </div>
            <div className="contact-list">
              {loading && <div className="contact-list-loading">Загружаем обращения…</div>}
              {!loading && filtered.map((item) => {
                const channelValue = String((item.data as Record<string, unknown>)?.channel ?? '')
                const channelInfo = channels.find((entry) => entry.value === channelValue)
                const ChannelIcon = channelInfo?.icon ?? (item.mode === 'INTERNAL' ? IconSettings : IconUser)
                return (
                  <article key={item.id} onClick={() => navigate(`/office/sessions/${item.id}`)}>
                    <span className="contact-player-mark"><ChannelIcon size={20} /></span>
                    <div className="contact-list-main">
                      <header><strong>{item.citizen?.nickname ?? (item.mode === 'INTERNAL' ? 'Внутренняя операция' : 'Игрок не привязан')}</strong><Badge status={item.status} label={statusCopy[item.status]?.label} /></header>
                      <h3>{item.subject}</h3>
                      <footer><span>{item.number}</span><span>{channelInfo?.title ?? 'Старое обращение'}</span><span>{formatDateTime(item.started_at)}</span></footer>
                    </div>
                    <div className="contact-list-materials"><strong>{(item._count?.documents ?? 0) + (item._count?.requests ?? 0) + (item._count?.attachments ?? 0)}</strong><span>материалов</span></div>
                    {isHeadOfState ? <ActionMenu items={[{ label: 'Удалить обращение', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget(item) }]} /> : <IconArrowRight size={18} />}
                  </article>
                )
              })}
              {!loading && filtered.length === 0 && <EmptyState title="Обращений не найдено" description="Измените фильтр или начните работу с новым игроком." />}
            </div>
          </main>
          <aside className="contact-guide">
            <span>Новый порядок</span>
            <h3>Одно обращение.<br />Все действия внутри.</h3>
            <ol>
              <li><b>1</b><div><strong>Найдите игрока</strong><small>Или оставьте без привязки</small></div></li>
              <li><b>2</b><div><strong>Укажите цель</strong><small>Паспорт, заявление, справка</small></div></li>
              <li><b>3</b><div><strong>Оформите результат</strong><small>Документы и файлы сохранятся вместе</small></div></li>
            </ol>
            <footer>Печать больше не требуется для начала работы.</footer>
          </aside>
        </div>
      )}

      {tab === 'archive' && (
        <section className="contact-archive">
          <header>
            <div><span>Архив СОНАР-КОНТАКТ</span><h2>Завершённые обращения</h2><p>Закрытие не уничтожает рабочее дело: его можно открыть, изучить и при необходимости возобновить.</p></div>
            <label><IconSearch size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Номер, игрок или содержание" /></label>
          </header>
          <div className="contact-archive-list">
            {archivedSessions.map((item) => (
              <article key={item.id}>
                <button className="contact-archive-open" onClick={() => navigate(`/office/sessions/${item.id}`)}>
                  <span className="contact-player-mark"><IconArchive size={19} /></span>
                  <span>
                    <small>{item.number} · {formatDateTime(item.completed_at ?? item.updated_at)}</small>
                    <strong>{item.subject}</strong>
                    <em>{item.citizen?.nickname ?? (item.mode === 'INTERNAL' ? 'Внутренняя операция' : 'Игрок не привязан')}</em>
                  </span>
                  <Badge status={item.status} label={statusCopy[item.status]?.label} />
                  <span className="contact-archive-count">{(item._count?.documents ?? 0) + (item._count?.requests ?? 0) + (item._count?.attachments ?? 0)}<small>материалов</small></span>
                  <IconArrowRight size={18} />
                </button>
                {isHeadOfState && <ActionMenu items={[{ label: 'Удалить обращение', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget(item) }]} />}
              </article>
            ))}
            {!loading && archivedSessions.length === 0 && <EmptyState title="Архив пуст" description="Завершённые обращения появятся здесь и останутся доступными для просмотра." />}
          </div>
        </section>
      )}

      {tab === 'materials' && (
        <section className="contact-materials">
          <header><div><span>Единый архив</span><h2>Материалы обращений</h2></div><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Номер, ШК или название" /></header>
          <div>
            <article><header><IconFileText size={18} /><strong>Документы</strong><b>{registry.documents.length}</b></header>{registry.documents.slice(0, 40).map((item) => <button key={item.id} onClick={() => printPdf(`/api/print-center/documents/${item.id}/pdf`)}><span><strong>{item.number}</strong><small>{item.title}</small></span><IconArrowRight size={15} /></button>)}</article>
            <article><header><IconClipboardText size={18} /><strong>Заявки</strong><b>{registry.requests.length}</b></header>{registry.requests.slice(0, 40).map((item) => <button key={item.id} onClick={() => setSelectedRequest(item)}><span><strong>{item.number}</strong><small>{item.title}</small></span><Badge status={item.status} label={requestStatusLabels[item.status]} /></button>)}</article>
            <article><header><IconArchive size={18} /><strong>Файлы</strong><b>{registry.attachments.length}</b></header>{registry.attachments.slice(0, 40).map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><span><strong>{item.original_name}</strong><small>{item.session.number}</small></span><IconArrowRight size={15} /></a>)}</article>
          </div>
        </section>
      )}

      {tab === 'print' && (
        <div className="contact-print">
          <section><span><IconSettings size={25} /></span><div><small>Дополнительный модуль</small><h2>Печать не блокирует работу с игроком</h2><p>Диагностика и бумажные формы используются только тогда, когда действительно нужен физический документ.</p></div></section>
          <PrintCenterPage embedded />
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новое обращение"
        description="Зафиксируйте игрока, канал связи и ожидаемый результат."
        width={780}
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button><Button variant="primary" loading={creating} onClick={createContact}>Создать обращение</Button></>}
      >
        <div className="contact-create">
          <div className="contact-channel-grid">
            {channels.map(({ value, title, text, icon: ChannelIcon }) => (
              <button type="button" key={value} className={channel === value ? 'is-active' : ''} onClick={() => setChannel(value)}>
                <span><ChannelIcon size={20} /></span><strong>{title}</strong><small>{text}</small>
              </button>
            ))}
          </div>
          <div className="form-grid">
            {channel !== 'INTERNAL' && <Select label="Игрок / гражданин" value={citizenId} onChange={(event) => setCitizenId(event.target.value)} placeholder="Можно выбрать позже" searchable options={citizens.map((item) => ({ value: item.id, label: `${item.nickname} · ${item.reg_number}` }))} />}
            <Input label="Контакт или Discord" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="@username или примечание" />
            <div className="span-2"><Input label="Что нужно сделать *" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Например: выдать паспорт или принять заявление" /></div>
          </div>
          <div className="contact-create-note"><IconSparkles size={17} /><span>После создания откроется рабочая страница с документами, заявками, файлами и статусом обращения.</span></div>
          {error && <div className="form-error">{error}</div>}
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Удалить обращение" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="danger" loading={deleteLoading} onClick={deleteContact}>Удалить</Button></>}>
        <div className="danger-confirm"><strong>{deleteTarget?.number}</strong> и все связанные материалы будут удалены без возможности восстановления.</div>
      </Modal>

      <Modal
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `${selectedRequest.number} · ${selectedRequest.title}` : 'Карточка заявки'}
        description="Полная запись из архива СОНАР-КОНТАКТ"
        width={860}
        footer={selectedRequest && <>
          <Button variant="secondary" onClick={() => printPdf(`/api/office/${selectedRequest.id}/pdf`)}><IconFileText size={15} />Сформировать</Button>
          {selectedRequest.service_session && <Button variant="primary" onClick={() => navigate(`/office/sessions/${selectedRequest.service_session!.id}`)}>
            {selectedRequest.status === 'COMPLETED' ? <IconArchive size={15} /> : <IconRefresh size={15} />}
            {selectedRequest.status === 'COMPLETED' ? 'Открыть дело' : 'Продолжить работу'}
          </Button>}
        </>}
      >
        {selectedRequest && <div className="contact-request-detail">
          <section className="contact-request-summary">
            <div><span>Статус</span><Badge status={selectedRequest.status} label={requestStatusLabels[selectedRequest.status]} /></div>
            <div><span>Заявитель</span><strong>{selectedRequest.citizen ? `${selectedRequest.citizen.nickname} · ${selectedRequest.citizen.reg_number}` : selectedRequest.contact || 'Не указан'}</strong></div>
            <div><span>Ответственный</span><strong>{selectedRequest.assignee?.login ?? 'Не назначен'}</strong></div>
            <div><span>Срок</span><strong><IconCalendar size={14} />{selectedRequest.due_at ? new Date(selectedRequest.due_at).toLocaleDateString('ru-RU') : 'Не установлен'}</strong></div>
          </section>
          <section className="contact-request-body">
            <span>Содержание заявки</span>
            <p>{selectedRequest.description}</p>
            {selectedRequest.resolution && <div><strong>Результат исполнения</strong><p>{selectedRequest.resolution}</p></div>}
          </section>
          <section className="contact-request-history">
            <span>История работы</span>
            {(selectedRequest.events ?? []).map((event) => <article key={event.id}><i /><div><strong>{event.message}</strong><small>{event.created_by.login} · {formatDateTime(event.created_at)}</small></div></article>)}
            {!selectedRequest.events?.length && <p>История изменений пока пуста.</p>}
          </section>
        </div>}
      </Modal>
    </div>
  )
}
