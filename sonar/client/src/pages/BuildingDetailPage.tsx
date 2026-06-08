import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconEdit, IconTrash, IconUpload } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Building, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatDate, formatAmount } from '../utils/formatters'

const TYPE_OPTIONS = [
  { value: 'RESIDENTIAL', label: 'Жилое' },
  { value: 'GOVERNMENT', label: 'Государственное' },
  { value: 'COMMERCIAL', label: 'Коммерческое' },
  { value: 'MILITARY', label: 'Военное' },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'UNDER_CONSTRUCTION', label: 'В строительстве' },
  { value: 'ABANDONED', label: 'Заброшен' },
  { value: 'DEMOLISHED', label: 'Снесён' },
]

type BuildingWithTaxCharges = Building & {
  tax_charges?: Array<{ id: string; amount: number; status: string; paid_at?: string | null; period?: { name: string } | null }>
}

export function BuildingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canEdit = usePermission('relict.edit')
  const canDelete = usePermission('relict.delete')

  const [building, setBuilding] = useState<BuildingWithTaxCharges | null>(null)
  const [loading, setLoading] = useState(true)
  const [citizens, setCitizens] = useState<Citizen[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', type: '', status: '', coord_x: '0', coord_y: '0', coord_z: '0', description: '', tax_rate: '0', owner_id: '', built_at: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiBase = (window as Window & { _apiBase?: string })._apiBase || ''

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiClient.get<BuildingWithTaxCharges>(`/buildings/${id}`)
      .then((r) => {
        setBuilding(r.data)
        setEditForm({
          name: r.data.name,
          type: r.data.type,
          status: r.data.status,
          coord_x: String(r.data.coord_x),
          coord_y: String(r.data.coord_y),
          coord_z: String(r.data.coord_z),
          description: r.data.description ?? '',
          tax_rate: String(r.data.tax_rate),
          owner_id: r.data.owner_id,
          built_at: r.data.built_at ? r.data.built_at.slice(0, 10) : '',
        })
      })
      .catch(() => setBuilding(null))
      .finally(() => setLoading(false))

    apiClient.get<Citizen[]>('/citizens').then((r) => setCitizens(r.data)).catch(() => {})
  }, [id])

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await apiClient.put<BuildingWithTaxCharges>(`/buildings/${id}`, {
        name: editForm.name,
        type: editForm.type,
        status: editForm.status,
        coord_x: Number(editForm.coord_x),
        coord_y: Number(editForm.coord_y),
        coord_z: Number(editForm.coord_z),
        description: editForm.description || null,
        tax_rate: Number(editForm.tax_rate),
        owner_id: editForm.owner_id,
        ...(editForm.built_at ? { built_at: editForm.built_at } : {}),
      })
      setBuilding(res.data)
      setShowEditModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setEditError(msg)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/buildings/${id}`)
      navigate('/buildings')
    } catch {
      alert('Ошибка удаления')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      const res = await apiClient.post<BuildingWithTaxCharges>(`/buildings/${id}/screenshot`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBuilding(res.data)
    } catch {
      alert('Ошибка загрузки')
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Загрузка...</div>
  if (!building) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Объект не найден</p>
      <Button variant="secondary" onClick={() => navigate('/buildings')} style={{ marginTop: '16px' }}><IconArrowLeft size={16} />Назад</Button>
    </div>
  )

  const screenshotUrl = building.screenshot_url
    ? `${apiBase}${building.screenshot_url}`
    : null

  return (
    <div>
      <button onClick={() => navigate('/buildings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: 'Inter, sans-serif', marginBottom: '20px', padding: '4px 0' }}>
        <IconArrowLeft size={16} />РЕЛИКТ
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', fontWeight: 700, color: '#26342E' }}>{building.reg_number}</span>
            <Badge status={building.type} />
            <Badge status={building.status} />
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#18211D', fontFamily: 'Inter, sans-serif' }}>{building.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
              <IconEdit size={14} />Редактировать
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
              <IconTrash size={14} />Удалить
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Владелец</div>
              <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{building.owner?.nickname ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Координаты</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#374151' }}>
                X:{building.coord_x} Y:{building.coord_y} Z:{building.coord_z}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Налог</div>
              <div style={{ fontSize: '14px', color: building.tax_rate > 0 ? '#D97706' : '#9CA3AF', fontWeight: 500 }}>
                {building.tax_rate > 0 ? formatAmount(building.tax_rate) : 'Нет'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Зарегистрирован</div>
              <div style={{ fontSize: '14px', color: '#374151' }}>{formatDate(building.created_at)}</div>
            </div>
          </div>
          {building.description && (
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Описание</div>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{building.description}</p>
            </div>
          )}
        </Card>

        <Card style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Скриншот</div>
          {screenshotUrl ? (
            <div>
              <img
                src={screenshotUrl}
                alt="Скриншот"
                style={{ width: '100%', borderRadius: '4px', border: '0.5px solid #CDD5D1', marginBottom: '12px', maxHeight: '240px', objectFit: 'cover' }}
              />
              {canEdit && (
                <Button variant="secondary" size="sm" loading={uploadLoading} onClick={() => fileInputRef.current?.click()}>
                  <IconUpload size={14} />Заменить
                </Button>
              )}
            </div>
          ) : (
            <div style={{ border: '2px dashed #CDD5D1', borderRadius: '4px', padding: '32px', textAlign: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '0 0 12px 0' }}>Скриншот не загружен</p>
              {canEdit && (
                <Button variant="secondary" size="sm" loading={uploadLoading} onClick={() => fileInputRef.current?.click()}>
                  <IconUpload size={14} />Загрузить
                </Button>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadScreenshot} />
        </Card>
      </div>

      {building.tax_charges && building.tax_charges.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Card title="Налоговая история" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #CDD5D1' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '13px' }}>Период</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '13px' }}>Сумма</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '13px' }}>Статус</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '13px' }}>Оплачено</th>
                  </tr>
                </thead>
                <tbody>
                  {building.tax_charges.map((tc) => (
                    <tr key={tc.id} style={{ borderBottom: '0.5px solid #CDD5D1', background: '#FFFFFF' }}>
                      <td style={{ padding: '10px 16px', color: '#374151' }}>{tc.period?.name ?? '—'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{formatAmount(tc.amount)}</td>
                      <td style={{ padding: '10px 16px' }}><Badge status={tc.status} /></td>
                      <td style={{ padding: '10px 16px', color: '#6B7280', fontSize: '13px' }}>{tc.paid_at ? formatDate(tc.paid_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Редактировать объект" description="Изменение технических и регистрационных сведений РЕЛИКТ." width={680}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Отмена</Button>
            <Button variant="primary" loading={editLoading} onClick={handleEdit}>Сохранить</Button>
          </>
        }
      >
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Название" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Select label="Тип" options={TYPE_OPTIONS} value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
          <Select
            label="Владелец"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            placeholder="— Выберите —"
            value={editForm.owner_id}
            onChange={(e) => setEditForm({ ...editForm, owner_id: e.target.value })}
            searchable
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <Input label="X" type="number" value={editForm.coord_x} onChange={(e) => setEditForm({ ...editForm, coord_x: e.target.value })} />
            <Input label="Y" type="number" value={editForm.coord_y} onChange={(e) => setEditForm({ ...editForm, coord_y: e.target.value })} />
            <Input label="Z" type="number" value={editForm.coord_z} onChange={(e) => setEditForm({ ...editForm, coord_z: e.target.value })} />
          </div>
          <Select label="Статус" options={STATUS_OPTIONS} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} />
          <Input label="Налог (у.е.)" type="number" min="0" value={editForm.tax_rate} onChange={(e) => setEditForm({ ...editForm, tax_rate: e.target.value })} />
          <Input label="Дата постройки" type="date" value={editForm.built_at} onChange={(e) => setEditForm({ ...editForm, built_at: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Описание</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }} />
          </div>
          {editError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{editError}</div>}
        </form>
      </Modal>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Удалить объект" description="Проверьте номер и наименование объекта перед необратимым удалением."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Отмена</Button>
            <Button variant="danger" loading={deleteLoading} onClick={handleDelete}>Удалить</Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: '#374151', fontFamily: 'Inter, sans-serif' }}>
          Удалить объект <strong>{building.name}</strong> ({building.reg_number})? Это действие необратимо.
        </p>
      </Modal>
    </div>
  )
}
