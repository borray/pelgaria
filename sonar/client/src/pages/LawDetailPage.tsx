import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { IconArrowLeft, IconEdit, IconTrash, IconPrinter } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Law, Case } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { formatDate } from '../utils/formatters'
import { printPdfPost } from '../utils/pdf'

export function LawDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canEdit = usePermission('laws.edit')
  const canRepeal = usePermission('laws.repeal')

  const [law, setLaw] = useState<Law | null>(null)
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<Case[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', body: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [showRepealModal, setShowRepealModal] = useState(false)
  const [repealLoading, setRepealLoading] = useState(false)

  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiClient.get<Law>(`/laws/${id}`)
      .then((r) => {
        setLaw(r.data)
        setEditForm({ title: r.data.title, body: r.data.body })
      })
      .catch(() => setLaw(null))
      .finally(() => setLoading(false))

    apiClient.get<Case[]>('/cases')
      .then((r) => setCases(r.data.filter((c) => c.law_id === id)))
      .catch(() => setCases([]))
  }, [id])

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await apiClient.put<Law>(`/laws/${id}`, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
      })
      setLaw(res.data)
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
      const res = await apiClient.post<Law>(`/laws/${id}/repeal`, {})
      setLaw(res.data)
      setShowRepealModal(false)
    } catch {
      alert('Ошибка отмены закона')
    } finally {
      setRepealLoading(false)
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

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Загрузка...</div>
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#26342E' }}>{law.number}</span>
            {law.registry_code && <span className="registry-code">{law.registry_code}</span>}
            <Badge status={law.type} />
            <Badge status={law.status} />
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#18211D', fontFamily: 'Inter, sans-serif' }}>
            {law.title}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {canEdit && law.status === 'ACTIVE' && (
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
              <IconEdit size={14} />
              Редактировать
            </Button>
          )}
          {canRepeal && law.status === 'ACTIVE' && (
            <Button variant="danger" size="sm" onClick={() => setShowRepealModal(true)}>
              <IconTrash size={14} />
              Отменить закон
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pdfLoading}>
            <IconPrinter size={14} />
            Сформировать
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Дата принятия</div>
              <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{formatDate(law.adopted_at)}</div>
            </div>
            {law.repealed_at && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Дата отмены</div>
                <div style={{ fontSize: '14px', color: '#DC2626', fontWeight: 500 }}>{formatDate(law.repealed_at)}</div>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Текст документа</div>
            <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.8', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap' }}>
              {law.body}
            </div>
          </div>
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
        title="Редактировать"
        width={600}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Отмена</Button>
            <Button variant="primary" loading={editLoading} onClick={handleEdit}>Сохранить</Button>
          </>
        }
      >
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Название" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Текст</label>
            <textarea
              value={editForm.body}
              onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
              rows={12}
              style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
            />
          </div>
          {editError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{editError}</div>}
        </form>
      </Modal>

      <Modal
        open={showRepealModal}
        onClose={() => setShowRepealModal(false)}
        title="Отменить закон"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRepealModal(false)}>Отмена</Button>
            <Button variant="danger" loading={repealLoading} onClick={handleRepeal}>Отменить закон</Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: '#374151', fontFamily: 'Inter, sans-serif' }}>
          Вы уверены, что хотите отменить закон <strong>{law.number}</strong>? Это действие нельзя отменить.
        </p>
      </Modal>
    </div>
  )
}
