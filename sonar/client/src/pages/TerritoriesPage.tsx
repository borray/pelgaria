import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Territory, User } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'

const STATUS_OPTIONS = [
  { value: 'DEVELOPED', label: 'Освоена' },
  { value: 'UNDER_CONSTRUCTION', label: 'В строительстве' },
  { value: 'DISPUTED', label: 'Спорная' },
  { value: 'NEUTRAL', label: 'Нейтральная' },
]

interface TerritoryForm {
  name: string
  description: string
  minister_id: string
  coordinates: string
  status: string
}

const emptyForm = (): TerritoryForm => ({ name: '', description: '', minister_id: '', coordinates: '', status: 'NEUTRAL' })

export function TerritoriesPage() {
  const canManage = usePermission('territories.manage')

  const [territories, setTerritories] = useState<Territory[]>([])
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [form, setForm] = useState<TerritoryForm>(emptyForm())
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchTerritories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<Territory[]>('/territories')
      setTerritories(res.data)
    } catch {
      setTerritories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTerritories()
    apiClient.get<User[]>('/accounts').then((r) => setUsers(r.data)).catch(() => {})
  }, [fetchTerritories])

  const openCreateModal = () => {
    setForm(emptyForm())
    setSaveError(null)
    setShowCreateModal(true)
  }

  const openEditModal = (t: Territory) => {
    setSelectedTerritory(t)
    setForm({
      name: t.name,
      description: t.description ?? '',
      minister_id: t.minister_id ?? '',
      coordinates: t.coordinates ?? '',
      status: t.status,
    })
    setSaveError(null)
    setShowEditModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setSaveError('Название обязательно'); return }
    setSaveLoading(true)
    setSaveError(null)
    try {
      await apiClient.post('/territories', {
        name: form.name.trim(),
        description: form.description || null,
        minister_id: form.minister_id || null,
        coordinates: form.coordinates || null,
        status: form.status,
      })
      setShowCreateModal(false)
      fetchTerritories()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setSaveError(msg)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTerritory) return
    setSaveLoading(true)
    setSaveError(null)
    try {
      await apiClient.put(`/territories/${selectedTerritory.id}`, {
        name: form.name.trim(),
        description: form.description || null,
        minister_id: form.minister_id || null,
        coordinates: form.coordinates || null,
        status: form.status,
      })
      setShowEditModal(false)
      fetchTerritories()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setSaveError(msg)
    } finally {
      setSaveLoading(false)
    }
  }

  const columns: TableColumn<Territory>[] = [
    {
      key: 'name',
      header: 'Название',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.name}</span>,
    },
    {
      key: 'minister',
      header: 'Ответственный',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.minister?.login ?? '—'}</span>,
    },
    {
      key: 'coordinates',
      header: 'Координаты',
      render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#6B7280' }}>{row.coordinates ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '150px',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '90px',
      render: (row) => (
        canManage ? (
          <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); openEditModal(row) }}>
            Изменить
          </Button>
        ) : null
      ),
    },
  ]

  const TerritoryFormContent = (
    <form onSubmit={showCreateModal ? handleCreate : handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label="Название *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Ответственный</label>
        <select value={form.minister_id} onChange={(e) => setForm({ ...form, minister_id: e.target.value })} style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}>
          <option value="">— Не назначен —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.login}</option>)}
        </select>
      </div>
      <Input label="Координаты" value={form.coordinates} onChange={(e) => setForm({ ...form, coordinates: e.target.value })} placeholder="X, Y, Z или описание" />
      <Select label="Статус" options={STATUS_OPTIONS} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Описание</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ padding: '8px 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }} />
      </div>
      {saveError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{saveError}</div>}
    </form>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>Территории</h1>
        {canManage && (
          <Button variant="primary" onClick={openCreateModal}>
            <IconPlus size={16} />Добавить территорию
          </Button>
        )}
      </div>

      {!loading && territories.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          <EmptyState title="Территории не найдены" description="Добавьте первую территорию" action={canManage ? <Button variant="primary" size="sm" onClick={openCreateModal}><IconPlus size={14} />Добавить</Button> : undefined} />
        </div>
      ) : (
        <Table columns={columns} data={territories} keyExtractor={(row) => row.id} loading={loading} />
      )}

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        {!loading && `Всего: ${territories.length}`}
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Добавить территорию"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
            <Button variant="primary" loading={saveLoading} onClick={handleCreate}>Создать</Button>
          </>
        }
      >
        {TerritoryFormContent}
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Редактировать территорию"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Отмена</Button>
            <Button variant="primary" loading={saveLoading} onClick={handleEdit}>Сохранить</Button>
          </>
        }
      >
        {TerritoryFormContent}
      </Modal>
    </div>
  )
}
