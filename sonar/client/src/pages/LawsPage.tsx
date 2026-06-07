import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Law } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'

const TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'LAW', label: 'Закон' },
  { value: 'DECREE', label: 'Указ' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'ACTIVE', label: 'Действует' },
  { value: 'REPEALED', label: 'Отменён' },
  { value: 'SUSPENDED', label: 'Приостановлен' },
]

interface CreateLawForm {
  type: string
  title: string
  body: string
  adopted_at: string
}

export function LawsPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('laws.create')

  const [laws, setLaws] = useState<Law[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<CreateLawForm>({ type: 'LAW', title: '', body: '', adopted_at: '' })

  const fetchLaws = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiClient.get<Law[]>(`/laws?${params.toString()}`)
      setLaws(res.data)
    } catch {
      setLaws([])
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => {
    const t = setTimeout(fetchLaws, 300)
    return () => clearTimeout(t)
  }, [fetchLaws])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      setCreateError('Название и текст обязательны')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      await apiClient.post('/laws', {
        type: form.type,
        title: form.title.trim(),
        body: form.body.trim(),
        ...(form.adopted_at ? { adopted_at: form.adopted_at } : {}),
      })
      setShowCreateModal(false)
      setForm({ type: 'LAW', title: '', body: '', adopted_at: '' })
      fetchLaws()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания'
      setCreateError(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: TableColumn<Law>[] = [
    {
      key: 'number',
      header: 'Номер',
      width: '130px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#1B3A6B', fontWeight: 600 }}>
          {row.number}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Тип',
      width: '100px',
      render: (row) => <Badge status={row.type} />,
    },
    {
      key: 'title',
      header: 'Название',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.title}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '130px',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'adopted_at',
      header: 'Дата принятия',
      width: '140px',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.adopted_at)}</span>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
          Законодательство
        </h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <IconPlus size={16} />
            Создать
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <IconSearch size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            placeholder="Поиск по названию, номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', height: '36px', padding: '0 10px 0 34px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <Select options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '140px' }} />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '180px' }} />
      </div>

      {!loading && laws.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          <EmptyState title="Законы не найдены" description={search || typeFilter || statusFilter ? 'Измените параметры поиска' : 'Создайте первый закон'} action={canCreate ? <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}><IconPlus size={14} />Создать</Button> : undefined} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={laws}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/laws/${row.id}`)}
          loading={loading}
        />
      )}

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        {!loading && `Всего: ${laws.length}`}
      </div>

      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateError(null); setForm({ type: 'LAW', title: '', body: '', adopted_at: '' }) }}
        title="Создать закон / указ"
        width={600}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>Создать</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Тип документа"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[{ value: 'LAW', label: 'Закон (ЗАК)' }, { value: 'DECREE', label: 'Указ (УКЗ)' }]}
          />
          <Input
            label="Название *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          <Input
            label="Дата принятия"
            type="date"
            value={form.adopted_at}
            onChange={(e) => setForm({ ...form, adopted_at: e.target.value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              Текст документа *
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              style={{ padding: '8px 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
            />
          </div>
          {createError && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>
              {createError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
