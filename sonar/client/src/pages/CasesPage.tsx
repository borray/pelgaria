import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Case, Citizen, Law } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { RegistryMark } from '../components/ui/RegistryMark'

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'OPENED', label: 'Открыто' },
  { value: 'IN_PROGRESS', label: 'В процессе' },
  { value: 'CLOSED', label: 'Закрыто' },
]

interface CreateCaseForm {
  accused_id: string
  law_id: string
  description: string
}

export function CasesPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('cases.create')

  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [laws, setLaws] = useState<Law[]>([])
  const [form, setForm] = useState<CreateCaseForm>({ accused_id: '', law_id: '', description: '' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await apiClient.get<Case[]>(`/cases?${params.toString()}`)
      setCases(res.data)
    } catch {
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const openCreateModal = async () => {
    setShowCreateModal(true)
    setForm({ accused_id: '', law_id: '', description: '' })
    setCreateError(null)
    try {
      const [cRes, lRes] = await Promise.all([
        apiClient.get<Citizen[]>('/citizens'),
        apiClient.get<Law[]>('/laws?status=ACTIVE'),
      ])
      setCitizens(cRes.data)
      setLaws(lRes.data)
    } catch {
      setCitizens([])
      setLaws([])
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.accused_id || !form.description.trim()) {
      setCreateError('Обвиняемый и описание обязательны')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await apiClient.post<Case>('/cases', {
        accused_id: form.accused_id,
        law_id: form.law_id || null,
        description: form.description.trim(),
      })
      setShowCreateModal(false)
      navigate(`/cases/${res.data.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка создания'
      setCreateError(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: TableColumn<Case>[] = [
    {
      key: 'number',
      header: 'Номер',
      width: '110px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#1B3A6B', fontWeight: 600 }}>
          {row.number}
        </span>
      ),
    },
    {
      key: 'accused',
      header: 'Обвиняемый',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.accused?.nickname ?? '—'}</span>,
    },
    {
      key: 'law',
      header: 'Статья',
      render: (row) => (
        <span style={{ fontSize: '13px', color: '#6B7280' }}>
          {row.law ? `${row.law.number}: ${row.law.title}` : '—'}
        </span>
      ),
    },
    {
      key: 'registry_code',
      header: 'ШК',
      width: '210px',
      render: (row) => <RegistryMark code={row.registry_code} compact />,
    },
    {
      key: 'judge',
      header: 'Судья',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.judge?.login ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '120px',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'opened_at',
      header: 'Открыто',
      width: '120px',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.opened_at)}</span>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
          Судебные дела
        </h1>
        {canCreate && (
          <Button variant="primary" onClick={openCreateModal}>
            <IconPlus size={16} />
            Возбудить дело
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <input className="registry-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Дело, обвиняемый, номер или ШК..." />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '200px' }} />
      </div>

      {!loading && cases.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          <EmptyState
            title="Дела не найдены"
            description={statusFilter ? 'Измените фильтр' : 'Возбудите первое дело'}
            action={canCreate ? <Button variant="primary" size="sm" onClick={openCreateModal}><IconPlus size={14} />Возбудить дело</Button> : undefined}
          />
        </div>
      ) : (
        <Table
          columns={columns}
          data={cases}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/cases/${row.id}`)}
          loading={loading}
        />
      )}

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        {!loading && `Всего: ${cases.length}`}
      </div>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        description="Номер дела и ШК будут созданы автоматически и останутся постоянными."
        title="Возбудить дело"
        width={620}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>Возбудить</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Обвиняемый *"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            placeholder="— Выберите гражданина —"
            value={form.accused_id}
            onChange={(e) => setForm({ ...form, accused_id: e.target.value })}
            searchable
          />
          <Select
            label="Статья закона"
            options={laws.map((l) => ({ value: l.id, label: `${l.number}: ${l.title}` }))}
            placeholder="— Не указано —"
            value={form.law_id}
            onChange={(e) => setForm({ ...form, law_id: e.target.value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Описание *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              style={{ padding: '8px 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
            />
          </div>
          {createError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{createError}</div>}
        </form>
      </Modal>
    </div>
  )
}
