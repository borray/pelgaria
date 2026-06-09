import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArchive,
  IconCheck,
  IconClipboardText,
  IconFileText,
  IconInnerShadowTop,
  IconPlayerPlay,
  IconPrinter,
  IconScan,
  IconTrash,
  IconUpload,
  IconUser,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type {
  Citizen,
  GeneratedDocument,
  PrinterTestSheet,
  ServiceAttachment,
  ServiceRequest,
  ServiceSession,
  ServiceSessionMode,
} from '../types'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { RegistryMark } from '../components/ui/RegistryMark'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ActionMenu } from '../components/ui/ActionMenu'
import { formatDateTime } from '../utils/formatters'
import { printPdf } from '../utils/pdf'

type CenterTab = 'sessions' | 'registry' | 'station'

interface Readiness {
  ready: boolean
  check: PrinterTestSheet | null
  valid_until: string | null
}

interface RegistryData {
  documents: Array<GeneratedDocument & { service_session?: Pick<ServiceSession, 'id' | 'number'> | null }>
  requests: Array<ServiceRequest & { service_session?: Pick<ServiceSession, 'id' | 'number'> | null }>
  attachments: Array<ServiceAttachment & { session: Pick<ServiceSession, 'id' | 'number' | 'subject'> }>
}

const MODES: Array<{ value: ServiceSessionMode; title: string; text: string; icon: typeof IconUser }> = [
  { value: 'ONLINE', title: 'Онлайн-обслуживание', text: 'Сотрудник заполняет обращения и документы непосредственно в СОНАР.', icon: IconUser },
  { value: 'OFFLINE', title: 'Офлайн-обслуживание', text: 'Печатные бланки, сканы, распознавание и обязательная сверка.', icon: IconScan },
  { value: 'INTERNAL', title: 'Внутренняя операция', text: 'Служебные поручения, справки и документы без внешнего заявителя.', icon: IconInnerShadowTop },
]

const MODE_LABELS: Record<ServiceSessionMode, string> = {
  ONLINE: 'Онлайн',
  OFFLINE: 'Офлайн',
  INTERNAL: 'Внутренняя',
}

export function ServiceCenterPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const isHeadOfState = useAuthStore((state) => state.user?.role?.name === 'Глава государства')
  const requestedTab = params.get('tab') as CenterTab | null
  const [tab, setTabState] = useState<CenterTab>(requestedTab ?? 'sessions')
  const [sessions, setSessions] = useState<ServiceSession[]>([])
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [readiness, setReadiness] = useState<Readiness>({ ready: false, check: null, valid_until: null })
  const [loading, setLoading] = useState(true)
  const [startOpen, setStartOpen] = useState(false)
  const [mode, setMode] = useState<ServiceSessionMode>('ONLINE')
  const [subject, setSubject] = useState('')
  const [contact, setContact] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [bypass, setBypass] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stationLoading, setStationLoading] = useState(false)
  const [testSheets, setTestSheets] = useState<PrinterTestSheet[]>([])
  const [registry, setRegistry] = useState<RegistryData>({ documents: [], requests: [], attachments: [] })
  const [registrySearch, setRegistrySearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'session' | 'document' | 'request' | 'attachment' | 'test-sheet'; id: string; title: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const scanInput = useRef<HTMLInputElement>(null)

  const setTab = (next: CenterTab) => {
    setTabState(next)
    setParams(next === 'sessions' ? {} : { tab: next }, { replace: true })
  }

  const fetchCore = useCallback(async () => {
    setLoading(true)
    try {
      const [sessionRes, readinessRes, citizenRes] = await Promise.all([
        apiClient.get<ServiceSession[]>('/service-center/sessions'),
        apiClient.get<Readiness>('/service-center/readiness'),
        apiClient.get<Citizen[]>('/citizens'),
      ])
      setSessions(sessionRes.data)
      setReadiness(readinessRes.data)
      setCitizens(citizenRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStation = useCallback(async () => {
    const response = await apiClient.get<PrinterTestSheet[]>('/print-center/test-sheets')
    setTestSheets(response.data)
  }, [])

  const fetchRegistry = useCallback(async () => {
    const suffix = registrySearch ? `?search=${encodeURIComponent(registrySearch)}` : ''
    const response = await apiClient.get<RegistryData>(`/service-center/registry${suffix}`)
    setRegistry(response.data)
  }, [registrySearch])

  useEffect(() => { void fetchCore() }, [fetchCore])
  useEffect(() => {
    if (tab === 'station') void fetchStation()
    if (tab === 'registry') {
      const timer = window.setTimeout(() => void fetchRegistry(), 250)
      return () => window.clearTimeout(timer)
    }
  }, [fetchRegistry, fetchStation, tab])

  const createSession = async () => {
    if (!subject.trim()) {
      setError('Укажите предмет обслуживания')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const response = await apiClient.post<ServiceSession>('/service-center/sessions', {
        mode,
        subject,
        contact,
        citizen_id: citizenId || null,
        printer_check_bypassed: bypass,
      })
      setStartOpen(false)
      navigate(`/office/sessions/${response.data.id}`)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось начать сессию')
    } finally {
      setCreating(false)
    }
  }

  const createTestSheet = async () => {
    setStationLoading(true)
    try {
      const response = await apiClient.post<PrinterTestSheet>('/print-center/test-sheets', {})
      await fetchStation()
      await printPdf(`/api/print-center/test-sheets/${response.data.id}/pdf`, true)
    } finally {
      setStationLoading(false)
    }
  }

  const uploadPrinterScan = async (file: File) => {
    const sheet = testSheets.find((item) => item.status === 'PRINTED') ?? testSheets[0]
    if (!sheet) return
    setStationLoading(true)
    const body = new FormData()
    body.append('scan', file)
    try {
      await apiClient.post(`/service-center/printer-checks/${sheet.id}/scan`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await Promise.all([fetchStation(), fetchCore()])
    } finally {
      setStationLoading(false)
      if (scanInput.current) scanInput.current.value = ''
    }
  }

  const deleteRecord = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const endpoint = deleteTarget.kind === 'test-sheet'
        ? `/print-center/test-sheets/${deleteTarget.id}`
        : `/service-center/${deleteTarget.kind === 'session' ? 'sessions' : `${deleteTarget.kind}s`}/${deleteTarget.id}`
      await apiClient.delete(endpoint)
      setDeleteTarget(null)
      await Promise.all([fetchCore(), fetchRegistry(), fetchStation()])
    } finally {
      setDeleteLoading(false)
    }
  }

  const stats = useMemo(() => ({
    active: sessions.filter((item) => item.status !== 'COMPLETED' && item.status !== 'CANCELLED').length,
    offlineReview: sessions.filter((item) => item.mode === 'OFFLINE' && item.status === 'REVIEW').length,
    today: sessions.filter((item) => new Date(item.started_at).toDateString() === new Date().toDateString()).length,
  }), [sessions])

  const sessionColumns: TableColumn<ServiceSession>[] = [
    { key: 'number', header: 'Сессия', width: '175px', render: (row) => <div><strong>{row.number}</strong><div className="table-secondary">{MODE_LABELS[row.mode]}</div></div> },
    { key: 'subject', header: 'Предмет', render: (row) => <div><strong>{row.subject}</strong><div className="table-secondary">{row.citizen ? `${row.citizen.nickname} · ${row.citizen.reg_number}` : 'Без привязки к гражданину'}</div></div> },
    { key: 'registry_code', header: 'ШК', width: '205px', render: (row) => <RegistryMark code={row.registry_code} compact /> },
    { key: 'files', header: 'Материалы', width: '115px', render: (row) => `${row._count?.documents ?? 0} док. · ${row._count?.attachments ?? 0} файлов` },
    { key: 'status', header: 'Статус', width: '125px', render: (row) => <Badge status={row.status} /> },
    { key: 'started_at', header: 'Начата', width: '145px', render: (row) => formatDateTime(row.started_at) },
    { key: 'actions', header: '', width: '46px', render: (row) => isHeadOfState ? <ActionMenu items={[{ label: 'Удалить сессию и материалы', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind: 'session', id: row.id, title: row.number }) }]} /> : null },
  ]

  const deleteMenu = (kind: 'document' | 'request' | 'attachment', id: string, title: string) =>
    isHeadOfState ? <ActionMenu items={[{ label: 'Удалить запись', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind, id, title }) }]} /> : null

  return (
    <div className="service-center-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Единое рабочее место</span>
          <h1>Центр обслуживания</h1>
          <p>Здесь начинается обслуживание. После запуска система открывает отдельное рабочее пространство сессии.</p>
        </div>
        <Button variant="primary" onClick={() => { setError(null); setStartOpen(true) }}><IconPlayerPlay size={16} />Начать сессию</Button>
      </div>

      <div className={`printer-readiness ${readiness.ready ? 'is-ready' : 'is-warning'}`}>
        <span>{readiness.ready ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />}</span>
        <div>
          <strong>{readiness.ready ? 'Ваша станция печати проверена' : 'Ваша проверка станции печати просрочена'}</strong>
          <small>{readiness.ready && readiness.valid_until ? `Действует до ${formatDateTime(readiness.valid_until)}` : 'Проверка индивидуальна для текущей учётной записи.'}</small>
        </div>
        <button type="button" onClick={() => setTab('station')}>Открыть проверку</button>
      </div>

      <div className="page-tabs">
        {([['sessions', 'Сессии'], ['registry', 'Единый реестр'], ['station', 'Моя станция печати']] as Array<[CenterTab, string]>).map(([value, label]) => (
          <button key={value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>

      {tab === 'sessions' && <>
        <div className="office-stats">
          <div><IconPlayerPlay size={20} /><span>Активные<strong>{stats.active}</strong></span></div>
          <div><IconScan size={20} /><span>На сверке<strong>{stats.offlineReview}</strong></span></div>
          <div><IconClipboardText size={20} /><span>Сегодня<strong>{stats.today}</strong></span></div>
          <div><IconArchive size={20} /><span>Всего сессий<strong>{sessions.length}</strong></span></div>
        </div>
        <section className="office-register">
          <div className="section-heading"><div><h2>Журнал обслуживания</h2><p>Откройте сессию, чтобы продолжить работу с её документами и материалами.</p></div></div>
          <Table columns={sessionColumns} data={sessions} keyExtractor={(row) => row.id} loading={loading} onRowClick={(row) => navigate(`/office/sessions/${row.id}`)} />
        </section>
      </>}

      {tab === 'registry' && <section className="office-register">
        <div className="section-heading office-toolbar-heading">
          <div><h2>Единый реестр материалов</h2><p>Документы, обращения и сканы из всех сессий.</p></div>
          <Input placeholder="Номер, ШК, название или текст скана" value={registrySearch} onChange={(event) => setRegistrySearch(event.target.value)} />
        </div>
        <div className="registry-groups">
          <article>
            <header><IconFileText size={17} /><strong>Документы</strong><b>{registry.documents.length}</b></header>
            {registry.documents.slice(0, 30).map((item) => <div className="registry-record" key={item.id}><button onClick={() => printPdf(`/api/print-center/documents/${item.id}/pdf`)}><span><strong>{item.number}</strong><small>{item.title}</small></span><RegistryMark code={item.registry_code} compact /></button>{deleteMenu('document', item.id, item.number)}</div>)}
          </article>
          <article>
            <header><IconClipboardText size={17} /><strong>Обращения</strong><b>{registry.requests.length}</b></header>
            {registry.requests.slice(0, 30).map((item) => <div className="registry-record" key={item.id}><button onClick={() => printPdf(`/api/office/${item.id}/pdf`)}><span><strong>{item.number}</strong><small>{item.title}</small></span><Badge status={item.status} /></button>{deleteMenu('request', item.id, item.number)}</div>)}
          </article>
          <article>
            <header><IconScan size={17} /><strong>Сканы и приложения</strong><b>{registry.attachments.length}</b></header>
            {registry.attachments.slice(0, 30).map((item) => <div className="registry-record" key={item.id}><a href={item.url} target="_blank" rel="noreferrer"><span><strong>{item.original_name}</strong><small>{item.session.number} · OCR: {item.ocr_status}</small></span><IconUpload size={15} /></a>{deleteMenu('attachment', item.id, item.original_name)}</div>)}
          </article>
        </div>
      </section>}

      {tab === 'station' && <section className="station-workspace">
        <div className="section-heading">
          <div><h2>Проверка станции текущего аккаунта</h2><p>Результат действует 24 часа только для вашей учётной записи.</p></div>
          <Button variant="primary" loading={stationLoading} onClick={createTestSheet}><IconPrinter size={16} />Напечатать пробный лист</Button>
        </div>
        <input ref={scanInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => event.target.files?.[0] && void uploadPrinterScan(event.target.files[0])} />
        <div className="station-actions">
          <button type="button" disabled={!testSheets.length || stationLoading} onClick={() => scanInput.current?.click()}><IconScan size={20} /><strong>Загрузить скан</strong><span>JPG, PNG или WebP</span></button>
          <div><IconCheck size={20} /><strong>Автоматическая оценка</strong><span>Порог пригодности: 65 из 100</span></div>
        </div>
        {testSheets.length ? <Table
          columns={[
            { key: 'number', header: 'Пробный лист', render: (row: PrinterTestSheet) => <strong>{row.number}</strong> },
            { key: 'created_at', header: 'Создан', render: (row: PrinterTestSheet) => formatDateTime(row.created_at) },
            { key: 'quality', header: 'Оценка', render: (row: PrinterTestSheet) => row.quality_score != null ? `${row.quality_score}/100` : 'Ожидает скан' },
            { key: 'status', header: 'Статус', render: (row: PrinterTestSheet) => <Badge status={row.status} /> },
            { key: 'print', header: '', render: (row: PrinterTestSheet) => <Button variant="secondary" size="sm" onClick={() => printPdf(`/api/print-center/test-sheets/${row.id}/pdf`)}><IconPrinter size={14} />Печать</Button> },
            { key: 'actions', header: '', width: '46px', render: (row: PrinterTestSheet) => isHeadOfState ? <ActionMenu items={[{ label: 'Удалить пробный лист', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind: 'test-sheet', id: row.id, title: row.number }) }]} /> : null },
          ]}
          data={testSheets}
          keyExtractor={(row) => row.id}
        /> : <EmptyState title="Ваших проверок пока нет" description="Напечатайте первый пробный лист для этой учётной записи." />}
      </section>}

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Начать сессию обслуживания" width={760} footer={<><Button variant="secondary" onClick={() => setStartOpen(false)}>Отмена</Button><Button variant="primary" loading={creating} onClick={createSession}>Открыть рабочее пространство</Button></>}>
        <div className="session-mode-grid">
          {MODES.map(({ value, title, text, icon: ModeIcon }) => <button key={value} className={mode === value ? 'is-active' : ''} onClick={() => setMode(value)}><ModeIcon size={20} /><strong>{title}</strong><span>{text}</span></button>)}
        </div>
        <div className="form-grid">
          <Input label="Предмет обслуживания *" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <Input label="Контакт" value={contact} onChange={(event) => setContact(event.target.value)} />
          {mode !== 'INTERNAL' && <Select label="Гражданин" value={citizenId} onChange={(event) => setCitizenId(event.target.value)} placeholder="Без привязки" searchable options={citizens.map((item) => ({ value: item.id, label: `${item.nickname} · ${item.reg_number}` }))} />}
        </div>
        {!readiness.ready && <label className="bypass-check"><input type="checkbox" checked={bypass} onChange={(event) => setBypass(event.target.checked)} /><span><strong>Продолжить без проверки станции</strong><small>Предупреждение появится снова при следующей сессии этого аккаунта.</small></span></label>}
        {error && <div className="form-error">{error}</div>}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Удалить запись центра обслуживания" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="danger" loading={deleteLoading} onClick={deleteRecord}>Удалить</Button></>}>
        <div className="danger-confirm"><strong>{deleteTarget?.title}</strong> будет удалена без возможности восстановления. При удалении сессии удаляются все её обращения, документы и загруженные материалы.</div>
      </Modal>
    </div>
  )
}
