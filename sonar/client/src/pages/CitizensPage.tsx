import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'INACTIVE', label: 'Неактивен' },
  { value: 'UNDER_INVESTIGATION', label: 'Под следствием' },
  { value: 'EXILED', label: 'В изгнании' },
  { value: 'BANNED', label: 'Забанен' },
]

interface CreateCitizenForm {
  nickname: string
  discord_username: string
  role_title: string
  status: string
  note: string
}

export function CitizensPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('citizens.create')

  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<CreateCitizenForm>({
    nickname: '',
    discord_username: '',
    role_title: 'Гражданин',
    status: 'ACTIVE',
    note: '',
  })

  const fetchCitizens = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await apiClient.get<Citizen[]>(`/citizens?${params.toString()}`)
      setCitizens(res.data)
    } catch {
      setCitizens([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(fetchCitizens, 300)
    return () => clearTimeout(timer)
  }, [fetchCitizens])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    if (!form.nickname.trim()) {
      setCreateError('Никнейм обязателен')
      return
    }
    setCreateLoading(true)
    try {
      await apiClient.post('/citizens', {
        nickname: form.nickname.trim(),
        discord_username: form.discord_username.trim() || null,
        role_title: form.role_title || 'Гражданин',
        status: form.status || 'ACTIVE',
        note: form.note.trim() || null,
      })
      setShowCreateModal(false)
      setForm({ nickname: '', discord_username: '', role_title: 'Гражданин', status: 'ACTIVE', note: '' })
      fetchCitizens()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Ошибка создания'
      setCreateError(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: TableColumn<Citizen>[] = [
    {
      key: 'reg_number',
      header: 'Рег. номер',
      width: '130px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#1B3A6B' }}>
          {row.reg_number}
        </span>
      ),
    },
    {
      key: 'nickname',
      header: 'Никнейм',
      render: (row) => (
        <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.nickname}</span>
      ),
    },
    {
      key: 'discord_username',
      header: 'Discord',
      render: (row) => (
        <span style={{ color: '#6B7280', fontSize: '13px' }}>
          {row.discord_username ?? '—'}
        </span>
      ),
    },
    {
      key: 'role_title',
      header: 'Роль',
      render: (row) => <span style={{ color: '#374151' }}>{row.role_title}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'joined_at',
      header: 'Дата вступления',
      render: (row) => (
        <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.joined_at)}</span>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#0A1628',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Реестр граждан
        </h1>
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            size="md"
          >
            <IconPlus size={16} />
            Добавить гражданина
          </Button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <IconSearch
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9CA3AF',
            }}
          />
          <input
            placeholder="Поиск по нику, Discord, номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px 0 34px',
              border: '1px solid #D0D7E3',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              color: '#1F2937',
              background: '#FFFFFF',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '180px' }}
        />
      </div>

      {!loading && citizens.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          <EmptyState
            title="Граждане не найдены"
            description={
              search || statusFilter
                ? 'Попробуйте изменить параметры поиска'
                : 'Добавьте первого гражданина'
            }
            action={
              canCreate ? (
                <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                  <IconPlus size={14} />
                  Добавить гражданина
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <Table
          columns={columns}
          data={citizens}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/citizens/${row.id}`)}
          loading={loading}
        />
      )}

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        {!loading && `Всего записей: ${citizens.length}`}
      </div>

      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setCreateError(null)
          setForm({ nickname: '', discord_username: '', role_title: 'Гражданин', status: 'ACTIVE', note: '' })
        }}
        title="Добавить гражданина"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                setCreateError(null)
              }}
            >
              Отмена
            </Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>
              Создать
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Никнейм *"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            autoFocus
          />
          <Input
            label="Discord username"
            value={form.discord_username}
            onChange={(e) => setForm({ ...form, discord_username: e.target.value })}
            placeholder="username"
          />
          <Input
            label="Звание / роль"
            value={form.role_title}
            onChange={(e) => setForm({ ...form, role_title: e.target.value })}
          />
          <Select
            label="Статус"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={STATUS_OPTIONS.slice(1)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              Примечание
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              style={{
                padding: '8px 10px',
                border: '1px solid #D0D7E3',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                color: '#1F2937',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
          {createError && (
            <div
              style={{
                padding: '8px 12px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '4px',
                color: '#DC2626',
                fontSize: '13px',
              }}
            >
              {createError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
