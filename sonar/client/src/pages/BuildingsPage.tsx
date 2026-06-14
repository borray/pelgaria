import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconSearch, IconPrinter } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Building, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { printPdf } from '../utils/pdf'
import { RegistryMark } from '../components/ui/RegistryMark'
import { PageHeader, RegistryToolbar } from '../components/ui/PageHeader'

const TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'RESIDENTIAL', label: 'Жилое' },
  { value: 'GOVERNMENT', label: 'Государственное' },
  { value: 'COMMERCIAL', label: 'Коммерческое' },
  { value: 'MILITARY', label: 'Военное' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'UNDER_CONSTRUCTION', label: 'В строительстве' },
  { value: 'ABANDONED', label: 'Заброшен' },
  { value: 'DEMOLISHED', label: 'Снесён' },
]

interface CreateBuildingForm {
  name: string
  type: string
  coord_x: string
  coord_y: string
  coord_z: string
  owner_id: string
  status: string
  description: string
  tax_rate: string
  built_at: string
}

export function BuildingsPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('relict.create')

  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState<CreateBuildingForm>({
    name: '',
    type: 'RESIDENTIAL',
    coord_x: '0',
    coord_y: '0',
    coord_z: '0',
    owner_id: '',
    status: 'ACTIVE',
    description: '',
    tax_rate: '0',
    built_at: '',
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleDownloadRegistryPdf = async () => {
    setPdfLoading(true)
    try {
      await printPdf('/api/buildings/registry/pdf')
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const fetchBuildings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiClient.get<Building[]>(`/buildings?${params.toString()}`)
      setBuildings(res.data)
    } catch {
      setBuildings([])
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => {
    const t = setTimeout(fetchBuildings, 300)
    return () => clearTimeout(t)
  }, [fetchBuildings])

  const openCreateModal = async () => {
    setShowCreateModal(true)
    setCreateError(null)
    setForm({ name: '', type: 'RESIDENTIAL', coord_x: '0', coord_y: '0', coord_z: '0', owner_id: '', status: 'ACTIVE', description: '', tax_rate: '0', built_at: '' })
    try {
      const res = await apiClient.get<Citizen[]>('/citizens')
      setCitizens(res.data)
    } catch { setCitizens([]) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.owner_id) {
      setCreateError('Название и владелец обязательны')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await apiClient.post<Building>('/buildings', {
        name: form.name.trim(),
        type: form.type,
        coord_x: Number(form.coord_x),
        coord_y: Number(form.coord_y),
        coord_z: Number(form.coord_z),
        owner_id: form.owner_id,
        status: form.status,
        description: form.description || null,
        tax_rate: Number(form.tax_rate),
        ...(form.built_at ? { built_at: form.built_at } : {}),
      })
      setShowCreateModal(false)
      navigate(`/buildings/${res.data.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания'
      setCreateError(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: TableColumn<Building>[] = [
    {
      key: 'reg_number',
      header: 'Рег. номер',
      width: '210px',
      render: (row) => <RegistryMark code={row.reg_number} compact />,
    },
    {
      key: 'name',
      header: 'Название',
      render: (row) => <span style={{ fontWeight: 500, color: '#18211D' }}>{row.name}</span>,
    },
    {
      key: 'type',
      header: 'Тип',
      width: '140px',
      render: (row) => <Badge status={row.type} />,
    },
    {
      key: 'coords',
      header: 'Координаты',
      width: '160px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#6B7280' }}>
          {row.coord_x}, {row.coord_y}, {row.coord_z}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Владелец',
      render: (row) => <span style={{ fontSize: '13px', color: '#374151' }}>{row.owner?.nickname ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '140px',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'tax_rate',
      header: 'Налог',
      width: '90px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: row.tax_rate > 0 ? '#D97706' : '#9CA3AF' }}>
          {row.tax_rate > 0 ? `${row.tax_rate} у.е.` : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="registry-page">
      <PageHeader
        eyebrow="РЕЛИКТ"
        title="Реестр объектов"
        description="Государственный учёт построек, владельцев, координат и технических паспортов."
        actions={<>
          <Button variant="secondary" loading={pdfLoading} onClick={handleDownloadRegistryPdf}>
            <IconPrinter size={16} />
            Сформировать реестр
          </Button>
          {canCreate && (
            <Button variant="primary" onClick={openCreateModal}>
              <IconPlus size={16} />
              Зарегистрировать объект
            </Button>
          )}
        </>}
      />

      <RegistryToolbar summary={!loading ? `${buildings.length} объектов` : 'Обновление'}>
        <div className="registry-search-shell">
          <IconSearch size={16} />
          <input
            className="registry-search"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '160px' }} />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '180px' }} />
      </RegistryToolbar>

      {!loading && buildings.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
          <EmptyState title="Объекты не найдены" description={search || typeFilter || statusFilter ? 'Измените параметры' : 'Добавьте первый объект'} action={canCreate ? <Button variant="primary" size="sm" onClick={openCreateModal}><IconPlus size={14} />Добавить</Button> : undefined} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={buildings}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/buildings/${row.id}`)}
          loading={loading}
        />
      )}

      {!loading && <div className="registry-footer"><span>Реестр РЕЛИКТ</span><span>Показано: {buildings.length}</span></div>}

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Зарегистрировать объект"
        description="Новая запись РЕЛИКТ получит регистрационный номер и защищенный технический паспорт."
        width={680}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>Создать</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Название *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Тип *" options={TYPE_OPTIONS.slice(1)} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <Select
            label="Владелец *"
            placeholder="— Выберите гражданина —"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            value={form.owner_id}
            onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
            searchable
            searchPlaceholder="Поиск гражданина..."
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <Input label="X" type="number" value={form.coord_x} onChange={(e) => setForm({ ...form, coord_x: e.target.value })} />
            <Input label="Y" type="number" value={form.coord_y} onChange={(e) => setForm({ ...form, coord_y: e.target.value })} />
            <Input label="Z" type="number" value={form.coord_z} onChange={(e) => setForm({ ...form, coord_z: e.target.value })} />
          </div>
          <Select label="Статус" options={STATUS_OPTIONS.slice(1)} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
          <Input label="Налог (у.е.)" type="number" min="0" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
          <Input label="Дата постройки" type="date" value={form.built_at} onChange={(e) => setForm({ ...form, built_at: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Описание</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }} />
          </div>
          {createError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{createError}</div>}
        </form>
      </Modal>
    </div>
  )
}
