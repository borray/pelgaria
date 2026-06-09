import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconCheck,
  IconClipboardText,
  IconFileText,
  IconInnerShadowTop,
  IconPrinter,
  IconScan,
  IconTrash,
  IconUpload,
  IconUser,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type { ServiceAttachment, ServiceSession, ServiceSessionMode, ServiceSessionStatus } from '../types'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { RegistryMark } from '../components/ui/RegistryMark'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { ActionMenu } from '../components/ui/ActionMenu'
import { formatDateTime } from '../utils/formatters'
import { printPdf } from '../utils/pdf'
import { OfficePage } from './OfficePage'
import { PrintCenterPage } from './PrintCenterPage'

type SessionTab = 'overview' | 'workflow' | 'requests' | 'documents' | 'files'

const MODE_LABELS: Record<ServiceSessionMode, string> = {
  ONLINE: 'Онлайн-обслуживание',
  OFFLINE: 'Офлайн-обслуживание',
  INTERNAL: 'Внутренняя операция',
}

const STATUS_LABELS: Record<ServiceSessionStatus, string> = {
  ACTIVE: 'В работе',
  WAITING_SCAN: 'Ожидает скан',
  REVIEW: 'На сверке',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
}

const MODE_ICONS = {
  ONLINE: IconUser,
  OFFLINE: IconScan,
  INTERNAL: IconInnerShadowTop,
}

export function ServiceSessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isHeadOfState = useAuthStore((state) => state.user?.role?.name === 'Глава государства')
  const [session, setSession] = useState<ServiceSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SessionTab>('overview')
  const [uploading, setUploading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [ocrTarget, setOcrTarget] = useState<ServiceAttachment | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrSaving, setOcrSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'session' | 'document' | 'request' | 'attachment'; id: string; title: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchSession = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const response = await apiClient.get<ServiceSession>(`/service-center/sessions/${id}`)
      setSession(response.data)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void fetchSession() }, [fetchSession])
  useEffect(() => {
    if (!session) return
    setTab(session.mode === 'OFFLINE' ? 'workflow' : 'overview')
  }, [session?.id])

  const availableTabs = useMemo<Array<[SessionTab, string]>>(() => {
    if (!session) return []
    if (session.mode === 'OFFLINE') return [
      ['workflow', 'Маршрут обслуживания'],
      ['files', 'Сканы и распознавание'],
      ['requests', 'Обращения'],
      ['documents', 'Документы'],
      ['overview', 'Сводка'],
    ]
    if (session.mode === 'INTERNAL') return [
      ['overview', 'Служебная операция'],
      ['requests', 'Поручения'],
      ['documents', 'Документы'],
      ['files', 'Приложения'],
    ]
    return [
      ['overview', 'Карточка приёма'],
      ['requests', 'Обращения'],
      ['documents', 'Документы'],
      ['files', 'Приложения'],
    ]
  }, [session])

  const uploadFiles = async (files: FileList) => {
    if (!session || files.length === 0) return
    setUploading(true)
    const body = new FormData()
    Array.from(files).forEach((file) => body.append('files', file))
    try {
      await apiClient.post(`/service-center/sessions/${session.id}/attachments`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchSession()
      setTab('files')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const setStatus = async (status: ServiceSessionStatus) => {
    if (!session) return
    setStatusLoading(true)
    try {
      const response = await apiClient.patch<ServiceSession>(`/service-center/sessions/${session.id}`, { status })
      setSession(response.data)
    } finally {
      setStatusLoading(false)
    }
  }

  const saveOcr = async () => {
    if (!ocrTarget) return
    setOcrSaving(true)
    try {
      await apiClient.patch(`/service-center/attachments/${ocrTarget.id}`, { ocr_text: ocrText })
      setOcrTarget(null)
      await fetchSession()
    } finally {
      setOcrSaving(false)
    }
  }

  const deleteRecord = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/service-center/${deleteTarget.kind === 'session' ? 'sessions' : `${deleteTarget.kind}s`}/${deleteTarget.id}`)
      if (deleteTarget.kind === 'session') {
        navigate('/office', { replace: true })
        return
      }
      setDeleteTarget(null)
      await fetchSession()
    } finally {
      setDeleteLoading(false)
    }
  }

  const deleteMenu = (kind: 'document' | 'request' | 'attachment', recordId: string, title: string) =>
    isHeadOfState ? <ActionMenu items={[{ label: 'Удалить запись', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind, id: recordId, title }) }]} /> : null

  if (loading) return <div className="load-state"><span>Загрузка рабочей сессии…</span></div>
  if (!session) return <EmptyState title="Сессия не найдена" description="Возможно, запись была удалена." />

  const ModeIcon = MODE_ICONS[session.mode]
  const isClosed = session.status === 'COMPLETED' || session.status === 'CANCELLED'

  return (
    <div className="service-session-page">
      <button className="session-back" onClick={() => navigate('/office')}><IconArrowLeft size={15} />Центр обслуживания</button>

      <header className="session-hero">
        <div className="session-hero-icon"><ModeIcon size={24} /></div>
        <div className="session-hero-main">
          <span>{MODE_LABELS[session.mode]}</span>
          <h1>{session.subject}</h1>
          <div><strong>{session.number}</strong><RegistryMark code={session.registry_code} compact /></div>
        </div>
        <div className="session-hero-status">
          <Badge status={session.status} label={STATUS_LABELS[session.status]} />
          <small>Оператор: {session.operator.login}</small>
        </div>
        <div className="session-hero-actions">
          {!isClosed && <Button variant="primary" loading={statusLoading} onClick={() => setStatus('COMPLETED')}><IconCheck size={15} />Завершить</Button>}
          {isHeadOfState && <ActionMenu items={[{ label: 'Удалить сессию и все материалы', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind: 'session', id: session.id, title: session.number }) }]} />}
        </div>
      </header>

      {session.printer_check_bypassed && <div className="session-warning"><IconScan size={17} /><div><strong>Сессия начата без действующей проверки печати</strong><span>Это предупреждение сохранено в карточке операции.</span></div></div>}

      <div className="page-tabs session-tabs">
        {availableTabs.map(([value, label]) => <button key={value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </div>

      {tab === 'workflow' && <div className="offline-workflow">
        <section className="workflow-step is-complete">
          <b>01</b><div><strong>Сессия зарегистрирована</strong><p>Присвоены номер {session.number} и контрольный ШК.</p></div><IconCheck size={18} />
        </section>
        <section className="workflow-step">
          <b>02</b><div><strong>Выдать бланк заявителю</strong><p>Печатать в масштабе 100%. Заполнять чёрной гелевой ручкой по клеткам.</p></div>
          <Button variant="secondary" onClick={() => printPdf(`/api/service-center/sessions/${session.id}/offline-form.pdf`)}><IconPrinter size={15} />Печатный комплект</Button>
        </section>
        <section className={`workflow-step${session.attachments?.length ? ' is-complete' : ''}`}>
          <b>03</b><div><strong>Загрузить заполненные листы</strong><p>СОНАР сохранит оригиналы и запустит распознавание изображений.</p></div>
          <Button variant="secondary" loading={uploading} onClick={() => fileInput.current?.click()}><IconUpload size={15} />Загрузить сканы</Button>
        </section>
        <section className={`workflow-step${session.attachments?.some((item) => item.ocr_status === 'VERIFIED') ? ' is-complete' : ''}`}>
          <b>04</b><div><strong>Сверить распознавание</strong><p>Исправьте ошибки OCR перед созданием обращения или итогового документа.</p></div>
          <Button variant="secondary" onClick={() => setTab('files')}>Перейти к сверке</Button>
        </section>
        <section className="workflow-step">
          <b>05</b><div><strong>Оформить результат</strong><p>Создайте обращение, справку или иной документ внутри этой сессии.</p></div>
          <div className="workflow-actions"><Button variant="secondary" onClick={() => setTab('requests')}><IconClipboardText size={15} />Обращение</Button><Button variant="primary" onClick={() => setTab('documents')}><IconFileText size={15} />Документ</Button></div>
        </section>
      </div>}

      {tab === 'overview' && <div className="session-overview">
        <section className="session-facts">
          <div><span>Заявитель</span><strong>{session.citizen ? `${session.citizen.nickname} · ${session.citizen.reg_number}` : session.mode === 'INTERNAL' ? 'Внутренняя операция' : 'Не указан'}</strong></div>
          <div><span>Контакт</span><strong>{session.contact || 'Не указан'}</strong></div>
          <div><span>Начало</span><strong>{formatDateTime(session.started_at)}</strong></div>
          <div><span>Проверка печати</span><strong>{session.printer_check ? `Пройдена · ${session.printer_check.quality_score ?? '—'}/100` : 'Продолжено без проверки'}</strong></div>
        </section>
        <div className="session-entry-grid">
          <button onClick={() => setTab('requests')}><IconClipboardText size={22} /><strong>{session.mode === 'INTERNAL' ? 'Создать поручение' : 'Зарегистрировать обращение'}</strong><span>Запись сразу войдёт в материалы {session.number}.</span></button>
          <button onClick={() => setTab('documents')}><IconFileText size={22} /><strong>Сформировать документ</strong><span>Справка, заявление, выписка или служебная форма.</span></button>
          <button onClick={() => fileInput.current?.click()}><IconUpload size={22} /><strong>Добавить приложение</strong><span>Скан, PDF или иной материал обслуживания.</span></button>
        </div>
        <section className="session-material-summary">
          <div className="section-heading"><div><h2>Материалы сессии</h2><p>Всё созданное внутри рабочего пространства.</p></div></div>
          <div className="session-material-list">
            {session.requests?.map((item) => <div key={item.id}><IconClipboardText size={16} /><span><strong>{item.number}</strong><small>{item.title}</small></span>{deleteMenu('request', item.id, item.number)}</div>)}
            {session.documents?.map((item) => <div key={item.id}><IconFileText size={16} /><span><strong>{item.number}</strong><small>{item.title}</small></span>{deleteMenu('document', item.id, item.number)}</div>)}
            {session.attachments?.map((item) => <div key={item.id}><IconScan size={16} /><span><strong>{item.original_name}</strong><small>OCR: {item.ocr_status}</small></span>{deleteMenu('attachment', item.id, item.original_name)}</div>)}
            {!session.requests?.length && !session.documents?.length && !session.attachments?.length && <EmptyState title="Материалов пока нет" description="Начните работу с одного из действий выше." />}
          </div>
        </section>
      </div>}

      {tab === 'requests' && <OfficePage serviceSessionId={session.id} embedded />}
      {tab === 'documents' && <PrintCenterPage serviceSessionId={session.id} embedded />}

      {tab === 'files' && <section className="session-files">
        <div className="section-heading">
          <div><h2>{session.mode === 'OFFLINE' ? 'Сканы и распознавание' : 'Приложения сессии'}</h2><p>Оригиналы сохраняются в реестре вместе с результатом OCR и ручной сверкой.</p></div>
          <Button variant="primary" loading={uploading} onClick={() => fileInput.current?.click()}><IconUpload size={15} />Загрузить файлы</Button>
        </div>
        <div className="session-file-grid">
          {session.attachments?.map((item) => <article key={item.id}>
            <a href={item.url} target="_blank" rel="noreferrer"><IconScan size={20} /><span><strong>{item.original_name}</strong><small>{Math.ceil(item.size / 1024)} КБ · OCR: {item.ocr_status}{item.ocr_confidence != null ? ` · ${Math.round(item.ocr_confidence)}%` : ''}</small></span></a>
            <div><Button variant="secondary" size="sm" onClick={() => { setOcrTarget(item); setOcrText(item.ocr_text ?? '') }}>Сверить текст</Button>{deleteMenu('attachment', item.id, item.original_name)}</div>
          </article>)}
          {!session.attachments?.length && <EmptyState title="Файлы не загружены" description="Добавьте заполненный бланк, скан или приложение." />}
        </div>
      </section>}

      <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />

      <Modal open={Boolean(ocrTarget)} onClose={() => setOcrTarget(null)} title="Сверка распознанного текста" width={720} footer={<><Button variant="secondary" onClick={() => setOcrTarget(null)}>Отмена</Button><Button variant="primary" loading={ocrSaving} onClick={saveOcr}>Подтвердить сведения</Button></>}>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 11 }}>Исправьте результат по оригиналу скана. Подтверждённый текст станет доступен в поиске реестра.</p>
        <textarea className="ocr-review-textarea" value={ocrText} onChange={(event) => setOcrText(event.target.value)} placeholder="Введите сведения со скана вручную" />
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Удалить материал сессии" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="danger" loading={deleteLoading} onClick={deleteRecord}>Удалить</Button></>}>
        <div className="danger-confirm"><strong>{deleteTarget?.title}</strong> будет удалён без возможности восстановления. Удаление всей сессии также уничтожит связанные документы, обращения и файлы.</div>
      </Modal>
    </div>
  )
}
