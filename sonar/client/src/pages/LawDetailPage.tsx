import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconPrinter,
  IconPaperclip,
  IconUpload,
  IconFileText,
  IconPhoto,
  IconExternalLink,
  IconPlayerPause,
  IconPlayerPlay,
  IconHistory,
  IconGitBranch,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Law, Case, LawAttachment } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import { ActionMenu } from '../components/ui/ActionMenu'
import { formatDate } from '../utils/formatters'
import { printPdfPost } from '../utils/pdf'
import { useTypeConfirm } from '../hooks/useTypeConfirm'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export function LawDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canEdit = usePermission('laws.edit')
  const canRepeal = usePermission('laws.repeal')
  const canDelete = usePermission('laws.delete')

  const [law, setLaw] = useState<Law | null>(null)
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<Case[]>([])
  const [availableLaws, setAvailableLaws] = useState<Law[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    short_title: '',
    body: '',
    category: '',
    summary: '',
    authority: '',
    source: '',
    keywords: '',
    parent_id: '',
    effective_at: '',
    change_note: '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [showRepealModal, setShowRepealModal] = useState(false)
  const [repealLoading, setRepealLoading] = useState(false)
  const [repealReason, setRepealReason] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [pdfLoading, setPdfLoading] = useState(false)

  const [attachments, setAttachments] = useState<LawAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deleteConfirm = useTypeConfirm(law?.number ?? '', showDeleteModal)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiClient.get<Law>(`/laws/${id}`)
      .then((r) => {
        setLaw(r.data)
        setEditForm({
          title: r.data.title,
          short_title: r.data.short_title ?? '',
          body: r.data.body,
          category: r.data.category ?? '',
          summary: r.data.summary ?? '',
          authority: r.data.authority ?? '',
          source: r.data.source ?? '',
          keywords: r.data.keywords?.join(', ') ?? '',
          parent_id: r.data.parent_id ?? '',
          effective_at: r.data.effective_at?.slice(0, 10) ?? '',
          change_note: '',
        })
        setAttachments(r.data.attachments ?? [])
      })
      .catch(() => setLaw(null))
      .finally(() => setLoading(false))

    apiClient.get<Case[]>('/cases')
      .then((r) => setCases(r.data.filter((c) => c.law_id === id)))
      .catch(() => setCases([]))

    apiClient.get<Law[]>('/laws')
      .then((r) => setAvailableLaws(r.data.filter((item) => item.id !== id && item.status === 'ACTIVE')))
      .catch(() => setAvailableLaws([]))
  }, [id])

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await apiClient.put<Law>(`/laws/${id}`, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        category: editForm.category.trim() || null,
        summary: editForm.summary.trim() || null,
        short_title: editForm.short_title.trim() || null,
        authority: editForm.authority.trim() || null,
        source: editForm.source.trim() || null,
        keywords: editForm.keywords,
        parent_id: editForm.parent_id || null,
        effective_at: editForm.effective_at || null,
        change_note: editForm.change_note.trim() || 'Обновление редакции',
      })
      setLaw((prev) => ({ ...res.data, attachments: prev?.attachments ?? attachments }))
      setShowEditModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка сохранения'
      setEditError(msg)
    } finally {
      setEditLoading(false)
    }
  }

  const handleRepeal = async () => {
    setRepealLoading(true)
    try {
      const res = await apiClient.post<Law>(`/laws/${id}/repeal`, { reason: repealReason.trim() || null })
      setLaw((prev) => ({ ...res.data, attachments: prev?.attachments ?? attachments }))
      setShowRepealModal(false)
      setRepealReason('')
    } catch {
      alert('Ошибка отмены закона')
    } finally {
      setRepealLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!law || !deleteConfirm.confirmed) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/laws/${law.id}`, { data: { confirm_number: law.number } })
      navigate('/laws')
    } catch (error: unknown) {
      setDeleteError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось удалить документ')
    } finally {
      setDeleteLoading(false)
    }
  }

  const changeStatus = async (status: 'ACTIVE' | 'SUSPENDED') => {
    setStatusLoading(true)
    try {
      const res = await apiClient.put<Law>(`/laws/${id}`, { status })
      setLaw((prev) => ({ ...res.data, attachments: prev?.attachments ?? attachments }))
    } catch {
      alert('Не удалось изменить статус')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    try {
      await printPdfPost(`/api/laws/${id}/pdf`)
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      list.forEach((f) => formData.append('files', f))
      const res = await apiClient.post<LawAttachment[]>(`/laws/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAttachments((prev) => [...res.data, ...prev])
    } catch (err: unknown) {
      setUploadError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось загрузить файлы')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteAttachment = async (attachmentId: string) => {
    try {
      await apiClient.delete(`/laws/${id}/attachments/${attachmentId}`)
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    } catch {
      alert('Не удалось удалить вложение')
    }
  }

  if (loading) return <div className="load-state"><Spinner /><span>Загружаем документ…</span></div>

  if (!law) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Закон не найден</p>
        <Button variant="secondary" onClick={() => navigate('/laws')} style={{ marginTop: '16px' }}>
          <IconArrowLeft size={16} />
          Назад
        </Button>
      </div>
    )
  }

  const manageItems = [
    {
      label: law.status === 'SUSPENDED' ? 'Возобновить действие' : 'Приостановить действие',
      icon: law.status === 'SUSPENDED' ? <IconPlayerPlay size={15} /> : <IconPlayerPause size={15} />,
      onClick: () => changeStatus(law.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'),
      disabled: statusLoading || law.status === 'REPEALED',
      hidden: !canEdit,
    },
    {
      label: 'Отменить действие',
      icon: <IconTrash size={15} />,
      danger: true,
      onClick: () => setShowRepealModal(true),
      hidden: !canRepeal || law.status === 'REPEALED',
    },
    {
      label: 'Удалить запись навсегда',
      icon: <IconTrash size={15} />,
      danger: true,
      onClick: () => setShowDeleteModal(true),
      hidden: !canDelete,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/laws')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: 'Inter, sans-serif', padding: '4px 0' }}
        >
          <IconArrowLeft size={16} />
          Законодательство
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#26342E' }}>{law.number}</span>
            {law.registry_code && <span className="registry-code">{law.registry_code}</span>}
            <Badge status={law.type} />
            <Badge status={law.status} />
            <span className="law-revision-pill">Редакция {law.revision_number}</span>
            {law.category && <span style={{ fontSize: '12px', color: '#6B7280' }}>· {law.category}</span>}
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#18211D', fontFamily: 'Inter, sans-serif' }}>
            {law.title}
          </h1>
          {law.summary && <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6B7280', maxWidth: '640px', lineHeight: 1.5 }}>{law.summary}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
          {canEdit && law.status !== 'REPEALED' && (
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
              <IconEdit size={14} />
              Редактировать
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pdfLoading}>
            <IconPrinter size={14} />
            Сформировать
          </Button>
          <ActionMenu items={manageItems} label="Управление документом" />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Дата принятия</div>
              <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{formatDate(law.adopted_at)}</div>
            </div>
            {law.effective_at && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Вступает в силу</div>
                <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{formatDate(law.effective_at)}</div>
              </div>
            )}
            {law.repealed_at && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Дата отмены</div>
                <div style={{ fontSize: '14px', color: '#DC2626', fontWeight: 500 }}>{formatDate(law.repealed_at)}</div>
              </div>
            )}
            {law.authority && (
              <div>
                <div className="law-meta-label">Издавший орган</div>
                <div className="law-meta-value">{law.authority}</div>
              </div>
            )}
            {law.source && (
              <div>
                <div className="law-meta-label">Источник публикации</div>
                <div className="law-meta-value">{law.source}</div>
              </div>
            )}
          </div>
          {law.parent && (
            <Link className="law-relation-banner" to={`/laws/${law.parent.id}`}>
              <IconGitBranch size={17} />
              <span>Изменяет или дополняет</span>
              <strong>{law.parent.number} · {law.parent.title}</strong>
              <IconExternalLink size={15} />
            </Link>
          )}
          {law.repeal_reason && <div className="law-repeal-note"><strong>Основание отмены</strong><span>{law.repeal_reason}</span></div>}
          {law.keywords?.length > 0 && (
            <div className="law-keywords">{law.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
          )}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Текст документа</div>
            <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.8', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap' }}>
              {law.body}
            </div>
          </div>
        </Card>

        {law.amendments && law.amendments.length > 0 && (
          <Card style={{ padding: '20px 24px' }}>
            <div className="law-card-heading"><IconGitBranch size={17} /><div><strong>Изменяющие документы</strong><small>{law.amendments.length} связанных актов</small></div></div>
            <div className="law-linked-list">
              {law.amendments.map((amendment) => (
                <Link key={amendment.id} to={`/laws/${amendment.id}`}>
                  <span>{amendment.number}</span>
                  <strong>{amendment.title}</strong>
                  <Badge status={amendment.status} />
                  <IconArrowLeft className="law-link-arrow" size={15} />
                </Link>
              ))}
            </div>
          </Card>
        )}

        {law.revisions && law.revisions.length > 0 && (
          <Card style={{ padding: '20px 24px' }}>
            <div className="law-card-heading"><IconHistory size={17} /><div><strong>История редакций</strong><small>Предыдущие состояния документа сохранены автоматически</small></div></div>
            <div className="law-timeline">
              <div className="law-timeline-row is-current">
                <span>{law.revision_number}</span>
                <div><strong>Действующая редакция</strong><small>Последнее состояние документа</small></div>
                <Badge status={law.status} />
              </div>
              {law.revisions.map((revision) => (
                <div className="law-timeline-row" key={revision.id}>
                  <span>{revision.revision_number}</span>
                  <div><strong>{revision.change_note || 'Изменение документа'}</strong><small>{formatDate(revision.created_at)} · {revision.created_by}</small></div>
                  <Badge status={revision.status} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              <IconPaperclip size={16} />
              Документы и сканы ({attachments.length})
            </div>
            {uploading && <span className="load-inline"><Spinner size={14} />Загрузка…</span>}
          </div>

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
              <div
                className={`attach-dropzone${dragOver ? ' is-drag' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files) }}
              >
                <IconUpload size={22} />
                <div>
                  <strong>Загрузить скан или документ</strong>
                  <small>Перетащите файлы или нажмите. PDF, изображения, Word — до 25 МБ.</small>
                </div>
              </div>
            </>
          )}

          {uploadError && <div className="form-error" style={{ marginTop: '12px' }}>{uploadError}</div>}

          {attachments.length > 0 ? (
            <div className="attach-list">
              {attachments.map((att) => (
                <div key={att.id} className="attach-row">
                  <span className="attach-icon">
                    {att.mime_type.startsWith('image/') ? <IconPhoto size={18} /> : <IconFileText size={18} />}
                  </span>
                  <div className="attach-meta">
                    <strong>{att.original_name}</strong>
                    <small>{formatFileSize(att.size)} · {formatDate(att.uploaded_at)}</small>
                  </div>
                  <div className="attach-actions">
                    <a href={att.url} target="_blank" rel="noreferrer" title="Открыть"><IconExternalLink size={15} /></a>
                    {canEdit && (
                      <ActionMenu items={[
                        { label: 'Удалить вложение', icon: <IconTrash size={15} />, danger: true, onClick: () => deleteAttachment(att.id) },
                      ]} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !canEdit && <div style={{ fontSize: '13px', color: '#9CA3AF', padding: '8px 0' }}>Вложения не прикреплены.</div>
          )}
        </Card>

        {cases.length > 0 && (
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Связанные дела ({cases.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cases.map((c) => (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#F8F9FB', borderRadius: '4px', textDecoration: 'none', border: '0.5px solid #CDD5D1' }}
                >
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#26342E', fontWeight: 600 }}>{c.number}</span>
                  <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>{c.accused?.nickname ?? '—'}</span>
                  <Badge status={c.status} />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditError(null) }}
        title="Новая редакция документа"
        description={`Текущая редакция ${law.revision_number} будет сохранена в истории.`}
        width={760}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Отмена</Button>
            <Button variant="primary" loading={editLoading} onClick={handleEdit}>Сохранить</Button>
          </>
        }
      >
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-grid">
            <div className="span-2"><Input label="Полное название" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
            <Input label="Краткое название" value={editForm.short_title} onChange={(e) => setEditForm({ ...editForm, short_title: e.target.value })} />
            <Input label="Категория / раздел" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            <Input label="Издавший орган" value={editForm.authority} onChange={(e) => setEditForm({ ...editForm, authority: e.target.value })} />
            <Input label="Источник публикации" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} />
            <Input label="Вступает в силу" type="date" value={editForm.effective_at} onChange={(e) => setEditForm({ ...editForm, effective_at: e.target.value })} />
            <Input label="Ключевые слова" value={editForm.keywords} onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })} />
            <div className="span-2"><Select searchable label="Изменяет или дополняет акт" value={editForm.parent_id} onChange={(e) => setEditForm({ ...editForm, parent_id: e.target.value })} placeholder="Самостоятельный документ" options={availableLaws.map((item) => ({ value: item.id, label: `${item.number} · ${item.title}` }))} /></div>
            <div className="span-2"><Input label="Краткое описание" value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Текст</label>
            <textarea
              value={editForm.body}
              onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
              rows={12}
              style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
            />
          </div>
          <Input label="Что изменено в этой редакции *" value={editForm.change_note} onChange={(e) => setEditForm({ ...editForm, change_note: e.target.value })} placeholder="Например: уточнена статья 4 и добавлен порядок вступления в силу" />
          {editError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{editError}</div>}
        </form>
      </Modal>

      <Modal
        open={showRepealModal}
        onClose={() => setShowRepealModal(false)}
        title="Отменить действие документа"
        description="Документ останется в архиве законодательства и будет доступен для поиска."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRepealModal(false)}>Отмена</Button>
            <Button variant="danger" loading={repealLoading} onClick={handleRepeal}>Отменить действие</Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: '#374151', fontFamily: 'Inter, sans-serif' }}>
          После отмены <strong>{law.number}</strong> перестанет считаться действующим. Предыдущая редакция будет сохранена.
        </p>
        <label className="modal-field-label">Основание отмены</label>
        <textarea className="document-textarea" rows={4} value={repealReason} onChange={(event) => setRepealReason(event.target.value)} placeholder="Укажите решение, заменяющий акт или другую причину" />
      </Modal>

      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteError(null) }}
        title="Удалить запись законодательства"
        description="Удаление возможно только для документа без связанных дел и изменяющих актов."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Отмена</Button>
            <Button variant="danger" loading={deleteLoading} disabled={!deleteConfirm.confirmed} onClick={handleDelete}>Удалить навсегда</Button>
          </>
        }
      >
        <p className="destructive-copy">Запись <strong>{law.number}</strong>, её редакции и вложения будут удалены без возможности восстановления.</p>
        <Input
          label={`Введите номер ${law.number} для подтверждения`}
          value={deleteConfirm.value}
          onChange={deleteConfirm.onChange}
          autoComplete="off"
        />
        {deleteError && <div className="form-error">{deleteError}</div>}
      </Modal>
    </div>
  )
}
