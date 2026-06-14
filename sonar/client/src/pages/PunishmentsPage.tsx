import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconPrinter, IconTrash } from '@tabler/icons-react'
import { ActionMenu } from '../components/ui/ActionMenu'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { useTimedUnlock } from '../hooks/useTimedUnlock'
import { useTypeConfirm } from '../hooks/useTypeConfirm'
import type { Punishment, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { printPdfPost } from '../utils/pdf'
import { RegistryMark } from '../components/ui/RegistryMark'
import { PageHeader, RegistryToolbar } from '../components/ui/PageHeader'

const TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'BAN', label: 'Бан' },
  { value: 'WARNING', label: 'Предупреждение' },
  { value: 'FINE', label: 'Штраф' },
  { value: 'EXILE', label: 'Изгнание' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'REVOKED', label: 'Отозван' },
  { value: 'EXPIRED', label: 'Истёк' },
]

interface IssuePunishmentForm {
  citizen_id: string
  type: string
  reason: string
  issued_at: string
  expires_at: string
}

export function PunishmentsPage() {
  const canIssue = usePermission('punishments.issue')
  const canRevoke = usePermission('punishments.revoke')

  const [punishments, setPunishments] = useState<Punishment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [form, setForm] = useState<IssuePunishmentForm>({ citizen_id: '', type: 'WARNING', reason: '', issued_at: '', expires_at: '' })
  const [issueLoading, setIssueLoading] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [revokeLoadingId, setRevokeLoadingId] = useState<string | null>(null)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Punishment | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { unlocked: deleteUnlocked, secondsLeft: deleteCountdown } = useTimedUnlock(Boolean(deleteTarget), 6)
  const deleteConfirm = useTypeConfirm(deleteTarget?.number ?? '', Boolean(deleteTarget))

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/punishments/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchPunishments()
    } catch (err: unknown) {
      setDeleteError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка удаления')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDownloadPdf = async (p: Punishment) => {
    setPdfLoadingId(p.id)
    try {
      await printPdfPost(`/api/punishments/${p.id}/pdf`)
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoadingId(null)
    }
  }

  const fetchPunishments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await apiClient.get<Punishment[]>(`/punishments?${params.toString()}`)
      setPunishments(res.data)
    } catch {
      setPunishments([])
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, search])

  useEffect(() => {
    fetchPunishments()
  }, [fetchPunishments])

  const openIssueModal = async () => {
    setShowIssueModal(true)
    setForm({ citizen_id: '', type: 'WARNING', reason: '', issued_at: '', expires_at: '' })
    setIssueError(null)
    try {
      const res = await apiClient.get<Citizen[]>('/citizens')
      setCitizens(res.data)
    } catch {
      setCitizens([])
    }
  }

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.citizen_id || !form.reason.trim()) {
      setIssueError('Гражданин и причина обязательны')
      return
    }
    setIssueLoading(true)
    setIssueError(null)
    try {
      await apiClient.post('/punishments', {
        citizen_id: form.citizen_id,
        type: form.type,
        reason: form.reason.trim(),
        expires_at: form.expires_at || null,
        ...(form.issued_at ? { issued_at: form.issued_at } : {}),
      })
      setShowIssueModal(false)
      fetchPunishments()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setIssueError(msg)
    } finally {
      setIssueLoading(false)
    }
  }

  const handleRevoke = async (p: Punishment) => {
    setRevokeLoadingId(p.id)
    try {
      await apiClient.post(`/punishments/${p.id}/revoke`, {})
      fetchPunishments()
    } catch {
      alert('Ошибка отзыва')
    } finally {
      setRevokeLoadingId(null)
    }
  }

  const columns: TableColumn<Punishment>[] = [
    {
      key: 'number',
      header: 'Номер',
      width: '210px',
      render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600 }}>{row.number ?? 'Формируется'}</span>,
    },
    {
      key: 'citizen',
      header: 'Гражданин',
      render: (row) => <span style={{ fontWeight: 500, color: '#18211D' }}>{row.citizen?.nickname ?? '—'}</span>,
    },
    {
      key: 'type',
      header: 'Тип',
      width: '130px',
      render: (row) => <Badge status={row.type} />,
    },
    {
      key: 'reason',
      header: 'Причина',
      render: (row) => <span style={{ fontSize: '13px', color: '#374151' }}>{row.reason}</span>,
    },
    {
      key: 'registry_code',
      header: 'ШК',
      width: '150px',
      render: (row) => <RegistryMark code={row.registry_code} compact />,
    },
    {
      key: 'issued_by',
      header: 'Выдал',
      width: '120px',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.issued_by?.login ?? '—'}</span>,
    },
    {
      key: 'issued_at',
      header: 'Дата',
      width: '120px',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{formatDate(row.issued_at)}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '110px',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            loading={pdfLoadingId === row.id}
            onClick={(e) => { e.stopPropagation(); handleDownloadPdf(row) }}
            title="Сформировать постановление"
          >
            <IconPrinter size={14} /> Сформировать
          </Button>
          {row.status === 'ACTIVE' && canRevoke && (
            <Button
              variant="secondary"
              size="sm"
              loading={revokeLoadingId === row.id}
              onClick={(e) => { e.stopPropagation(); handleRevoke(row) }}
            >
              Отозвать
            </Button>
          )}
          {canIssue && (
            <ActionMenu items={[
              { label: 'Стереть запись навсегда', icon: <IconTrash size={15} />, danger: true, onClick: () => { setDeleteError(null); setDeleteTarget(row) } },
            ]} />
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="registry-page">
      <PageHeader
        eyebrow="Правопорядок"
        title="Наказания"
        description="Постановления, ограничения, штрафы и история применения мер к гражданам."
        actions={canIssue ? (
          <Button variant="primary" onClick={openIssueModal}>
            <IconPlus size={16} />
            Выдать наказание
          </Button>
        ) : undefined}
      />

      <RegistryToolbar summary={!loading ? `${punishments.length} записей` : 'Обновление'}>
        <input className="registry-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Гражданин, номер, ШК или причина..." />
        <Select options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '180px' }} />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '180px' }} />
      </RegistryToolbar>

      {!loading && punishments.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
          <EmptyState title="Наказания не найдены" description={typeFilter || statusFilter ? 'Измените фильтры' : 'Нет наказаний'} action={canIssue ? <Button variant="primary" size="sm" onClick={openIssueModal}><IconPlus size={14} />Выдать</Button> : undefined} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={punishments}
          keyExtractor={(row) => row.id}
          loading={loading}
        />
      )}

      {!loading && <div className="registry-footer"><span>Реестр мер</span><span>Показано: {punishments.length}</span></div>}

      <Modal
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        description="СОНАР автоматически присвоит постановлению официальный номер и ШК."
        width={640}
        title="Выдать наказание"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowIssueModal(false)}>Отмена</Button>
            <Button variant="primary" loading={issueLoading} onClick={handleIssue}>Выдать</Button>
          </>
        }
      >
        <form onSubmit={handleIssue} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Гражданин *"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            placeholder="— Выберите гражданина —"
            value={form.citizen_id}
            onChange={(e) => setForm({ ...form, citizen_id: e.target.value })}
            searchable
          />
          <Select
            label="Тип *"
            options={TYPE_OPTIONS.slice(1)}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Причина *</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Дата вынесения</label>
            <input
              type="date"
              value={form.issued_at}
              onChange={(e) => setForm({ ...form, issued_at: e.target.value })}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #CDD5D1', borderRadius: '8px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Истекает (необязательно)</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            />
          </div>
          {issueError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{issueError}</div>}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить запись о наказании"
        description="Запись будет стёрта из реестра без возможности восстановления."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={!deleteUnlocked || !deleteConfirm.confirmed}
              loading={deleteLoading}
              onClick={handleDelete}
            >
              {!deleteUnlocked ? `Подождите ${deleteCountdown}с` : 'Стереть навсегда'}
            </Button>
          </>
        }
      >
        <div className="danger-confirm" style={{ marginBottom: '14px' }}>
          Запись <strong>{deleteTarget?.number}</strong> о наказании гражданина <strong>{deleteTarget?.citizen?.nickname}</strong> будет уничтожена навсегда.
        </div>
        <Input
          label={`Введите номер «${deleteTarget?.number ?? ''}» для подтверждения`}
          value={deleteConfirm.value}
          onChange={deleteConfirm.onChange}
          placeholder={deleteTarget?.number ?? ''}
        />
        {deleteError && <div className="form-error" style={{ marginTop: '10px' }}>{deleteError}</div>}
      </Modal>
    </div>
  )
}
