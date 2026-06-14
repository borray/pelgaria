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
import { useToast } from '../components/ui/Toast'
import { formatDate } from '../utils/formatters'
import { RegistryMark } from '../components/ui/RegistryMark'
import { PageHeader, RegistryToolbar } from '../components/ui/PageHeader'

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
  const toast = useToast()

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
      toast.success('Гражданин добавлен')
      fetchCitizens()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Ошибка создания'
      setCreateError(msg)
      toast.error(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: TableColumn<Citizen>[] = [
    {
      key: 'reg_number',
      header: 'Рег. номер',
      width: '210px',
      render: (row) => <RegistryMark code={row.reg_number} compact />,
    },
    {
      key: 'nickname',
      header: 'Никнейм',
      render: (row) => (
        <span style={{ fontWeight: 500, color: '#18211D' }}>{row.nickname}</span>
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
    <div className="registry-page">
      <PageHeader
        eyebrow="Государственный реестр"
        title="Граждане"
        description="Единая база жителей Пельгарии, их статусов, ролей и связанных государственных записей."
        actions={canCreate ? (
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            size="md"
          >
            <IconPlus size={16} />
            Добавить гражданина
          </Button>
        ) : undefined}
      />

      <RegistryToolbar summary={!loading ? `${citizens.length} записей` : 'Обновление'}>
        <div className="registry-search-shell">
          <IconSearch size={16} />
          <input
            className="registry-search"
            placeholder="Поиск по нику, Discord, номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '180px' }}
        />
      </RegistryToolbar>

      {!loading && citizens.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
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

      {!loading && <div className="registry-footer"><span>Реестр граждан</span><span>Показано: {citizens.length}</span></div>}

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
                border: '1px solid #CDD5D1',
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
