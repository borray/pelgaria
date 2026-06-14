import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconArchive,
  IconCheck,
  IconClipboardText,
  IconClock,
  IconFileText,
  IconHome,
  IconMessageCircle,
  IconPaperclip,
  IconPlayerPause,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconUser,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type { ServiceAttachment, ServiceSession, ServiceSessionStatus } from '../types'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { ActionMenu } from '../components/ui/ActionMenu'
import { formatDateTime } from '../utils/formatters'
import { OfficePage } from './OfficePage'
import { PrintCenterPage } from './PrintCenterPage'

type ContactWorkspace = 'work' | 'requests' | 'documents' | 'files'

const statusLabels: Record<ServiceSessionStatus, string> = {
  ACTIVE: 'В работе',
  WAITING_SCAN: 'Ждём игрока',
  REVIEW: 'На рассмотрении',
  COMPLETED: 'Исполнено',
  CANCELLED: 'Отменено',
}

export function ServiceSessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isHeadOfState = useAuthStore((state) => state.user?.role?.name === 'Глава государства')
  const canManage = useAuthStore((state) => state.hasPermission('office.manage'))
  const [contact, setContact] = useState<ServiceSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspace, setWorkspace] = useState<ContactWorkspace>('work')
  const [uploading, setUploading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [ocrTarget, setOcrTarget] = useState<ServiceAttachment | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrSaving, setOcrSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'session' | 'document' | 'request' | 'attachment'; id: string; title: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchContact = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const response = await apiClient.get<ServiceSession>(`/service-center/sessions/${id}`)
      setContact(response.data)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void fetchContact() }, [fetchContact])

  const setStatus = async (status: ServiceSessionStatus) => {
    if (!contact) return
    setStatusLoading(true)
    try {
      const response = await apiClient.patch<ServiceSession>(`/service-center/sessions/${contact.id}`, { status })
      setContact(response.data)
    } finally {
      setStatusLoading(false)
    }
  }

  const uploadFiles = async (files: FileList) => {
    if (!contact || files.length === 0) return
    setUploading(true)
    const body = new FormData()
    Array.from(files).forEach((file) => body.append('files', file))
    try {
      await apiClient.post(`/service-center/sessions/${contact.id}/attachments`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchContact()
      setWorkspace('files')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const saveOcr = async () => {
    if (!ocrTarget) return
    setOcrSaving(true)
    try {
      await apiClient.patch(`/service-center/attachments/${ocrTarget.id}`, { ocr_text: ocrText })
      setOcrTarget(null)
      await fetchContact()
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
      await fetchContact()
    } finally {
      setDeleteLoading(false)
    }
  }

  const deleteMenu = (kind: 'document' | 'request' | 'attachment', recordId: string, title: string) =>
    isHeadOfState ? <ActionMenu items={[{ label: 'Удалить материал', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind, id: recordId, title }) }]} /> : null

  if (loading) return <div className="load-state"><span>Открываем обращение…</span></div>
  if (!contact) return <EmptyState title="Обращение не найдено" description="Возможно, оно было удалено." />

  const data = contact.data as Record<string, unknown>
  const source = String(data?.source ?? (contact.mode === 'INTERNAL' ? 'Внутренняя работа' : 'Старый формат'))
  const materialCount = (contact.requests?.length ?? 0) + (contact.documents?.length ?? 0) + (contact.attachments?.length ?? 0)
  const isClosed = contact.status === 'COMPLETED' || contact.status === 'CANCELLED'

  return (
    <div className="contact-workspace">
      <button className="contact-back" onClick={() => navigate('/office')}><IconArrowLeft size={15} />СОНАР · Контакт</button>

      <header className="contact-record-head">
        <div className="contact-record-person">
          <span><IconUser size={25} /></span>
          <div><small>{source}</small><h1>{contact.citizen?.nickname ?? (contact.mode === 'INTERNAL' ? 'Внутренняя операция' : 'Игрок не привязан')}</h1><p>{contact.subject}</p></div>
        </div>
        <div className="contact-record-code"><span>Обращение</span><strong>{contact.number}</strong><small>{formatDateTime(contact.started_at)}</small></div>
        <div className="contact-record-state"><Badge status={contact.status} label={statusLabels[contact.status]} /><small>Оператор: {contact.operator.login}</small></div>
        <div className="contact-record-actions">
          {!isClosed && <Button variant="primary" loading={statusLoading} onClick={() => setStatus('COMPLETED')}><IconCheck size={15} />Исполнено</Button>}
          {isClosed && canManage && <Button variant="secondary" loading={statusLoading} onClick={() => setStatus('ACTIVE')}><IconRefresh size={15} />Возобновить</Button>}
          {isClosed && <Button variant="primary" onClick={() => navigate('/office')}><IconHome size={15} />В СОНАР-КОНТАКТ</Button>}
          {isHeadOfState && <ActionMenu items={[{ label: 'Удалить обращение', icon: <IconTrash size={15} />, danger: true, onClick: () => setDeleteTarget({ kind: 'session', id: contact.id, title: contact.number }) }]} />}
        </div>
      </header>

      {isClosed && (
        <section className="contact-complete-banner">
          <span><IconCheck size={22} /></span>
          <div><small>Работа завершена</small><strong>Материалы сохранены в архиве СОНАР-КОНТАКТ</strong><p>Карточка остаётся доступной для просмотра. Если появились новые сведения, обращение можно вернуть в работу.</p></div>
          <Button variant="secondary" onClick={() => navigate('/office')}><IconHome size={15} />Главное меню</Button>
        </section>
      )}

      <div className="contact-work-layout">
        <aside className="contact-record-sidebar">
          <section>
            <span>Игрок</span>
            {contact.citizen ? <>
              <strong>{contact.citizen.nickname}</strong>
              <small>{contact.citizen.reg_number}</small>
              <Link to={`/citizens/${contact.citizen.id}`}><IconSearch size={14} />Открыть карточку</Link>
            </> : <p>Карточка игрока не привязана. Материалы всё равно сохранятся в обращении.</p>}
          </section>
          <dl>
            <div><dt>Контакт</dt><dd>{contact.contact || 'Не указан'}</dd></div>
            <div><dt>Канал</dt><dd>{source}</dd></div>
            <div><dt>Материалов</dt><dd>{materialCount}</dd></div>
          </dl>
          {!isClosed && <div className="contact-status-actions">
            <strong>Изменить состояние</strong>
            <button onClick={() => setStatus('ACTIVE')}><IconClock size={15} />В работе</button>
            <button onClick={() => setStatus('WAITING_SCAN')}><IconPlayerPause size={15} />Ждём игрока</button>
            <button onClick={() => setStatus('REVIEW')}><IconClipboardText size={15} />На рассмотрении</button>
          </div>}
        </aside>

        <main className="contact-record-main">
          <nav className="contact-work-tabs">
            <button className={workspace === 'work' ? 'is-active' : ''} onClick={() => setWorkspace('work')}><IconMessageCircle size={17} />Рабочий стол</button>
            <button className={workspace === 'requests' ? 'is-active' : ''} onClick={() => setWorkspace('requests')}><IconClipboardText size={17} />Заявки <b>{contact.requests?.length ?? 0}</b></button>
            <button className={workspace === 'documents' ? 'is-active' : ''} onClick={() => setWorkspace('documents')}><IconFileText size={17} />Документы <b>{contact.documents?.length ?? 0}</b></button>
            <button className={workspace === 'files' ? 'is-active' : ''} onClick={() => setWorkspace('files')}><IconPaperclip size={17} />Файлы <b>{contact.attachments?.length ?? 0}</b></button>
          </nav>

          {workspace === 'work' && (
            <div className="contact-desk">
              <section className="contact-purpose">
                <span>Цель обращения</span><h2>{contact.subject}</h2><p>Все действия ниже автоматически связываются с обращением {contact.number}.</p>
              </section>
              <div className="contact-quick-actions">
                <button onClick={() => setWorkspace('requests')}><span><IconClipboardText size={22} /></span><div><strong>Принять заявление</strong><small>Жалоба, просьба, услуга или внутреннее поручение</small></div><IconArrowLeft size={16} /></button>
                <button onClick={() => setWorkspace('documents')}><span><IconFileText size={22} /></span><div><strong>Создать документ</strong><small>Справка, выписка, заявление или печатная форма</small></div><IconArrowLeft size={16} /></button>
                <button onClick={() => fileInput.current?.click()}><span><IconUpload size={22} /></span><div><strong>Добавить материал</strong><small>Скриншот, PDF, изображение или иной файл</small></div><IconArrowLeft size={16} /></button>
              </div>
              <section className="contact-activity">
                <header><div><span>Хронология</span><h2>Что уже сделано</h2></div><strong>{materialCount} событий</strong></header>
                <div>
                  <article><i /><span><strong>Обращение создано</strong><small>{contact.operator.login} · {formatDateTime(contact.started_at)}</small></span></article>
                  {contact.requests?.map((item) => <article key={item.id}><i /><IconClipboardText size={15} /><span><strong>Зарегистрирована заявка {item.number}</strong><small>{item.title} · {formatDateTime(item.created_at)}</small></span>{deleteMenu('request', item.id, item.number)}</article>)}
                  {contact.documents?.map((item) => <article key={item.id}><i /><IconFileText size={15} /><span><strong>Сформирован документ {item.number}</strong><small>{item.title} · {formatDateTime(item.created_at)}</small></span>{deleteMenu('document', item.id, item.number)}</article>)}
                  {contact.attachments?.map((item) => <article key={item.id}><i /><IconArchive size={15} /><span><strong>Добавлен файл</strong><small>{item.original_name} · {formatDateTime(item.created_at)}</small></span>{deleteMenu('attachment', item.id, item.original_name)}</article>)}
                </div>
              </section>
            </div>
          )}

          {workspace === 'requests' && <OfficePage serviceSessionId={contact.id} embedded />}
          {workspace === 'documents' && <PrintCenterPage serviceSessionId={contact.id} embedded />}
          {workspace === 'files' && (
            <section className="contact-files">
              <header><div><span>Приложения</span><h2>Файлы обращения</h2><p>Скриншоты, заявления и другие материалы игрока.</p></div><Button variant="primary" loading={uploading} onClick={() => fileInput.current?.click()}><IconUpload size={15} />Добавить</Button></header>
              <div>
                {contact.attachments?.map((item) => <article key={item.id}>
                  <a href={item.url} target="_blank" rel="noreferrer"><span><IconArchive size={20} /></span><div><strong>{item.original_name}</strong><small>{Math.ceil(item.size / 1024)} КБ · анализ: {item.ocr_status}</small></div></a>
                  <div><Button variant="secondary" size="sm" onClick={() => { setOcrTarget(item); setOcrText(item.ocr_text ?? '') }}>Текст файла</Button>{deleteMenu('attachment', item.id, item.original_name)}</div>
                </article>)}
                {!contact.attachments?.length && <EmptyState title="Файлов пока нет" description="Добавьте скриншот, готовую заявку или приложение." />}
              </div>
            </section>
          )}
        </main>
      </div>

      <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />

      <Modal open={Boolean(ocrTarget)} onClose={() => setOcrTarget(null)} title="Текст и сведения из файла" width={720} footer={<><Button variant="secondary" onClick={() => setOcrTarget(null)}>Отмена</Button><Button variant="primary" loading={ocrSaving} onClick={saveOcr}>Сохранить</Button></>}>
        <p className="contact-ocr-note">Автоматически распознанный текст можно исправить вручную. После сохранения он будет доступен в поиске материалов.</p>
        <textarea className="ocr-review-textarea" value={ocrText} onChange={(event) => setOcrText(event.target.value)} placeholder="Текст или заметка к файлу" />
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Удалить материал" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="danger" loading={deleteLoading} onClick={deleteRecord}>Удалить</Button></>}>
        <div className="danger-confirm"><strong>{deleteTarget?.title}</strong> будет удалён без возможности восстановления.</div>
      </Modal>
    </div>
  )
}
