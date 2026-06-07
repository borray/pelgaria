import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconFileTypePdf } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Punishment, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { downloadPdfPost } from '../utils/pdf'

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
  expires_at: string
}

export function PunishmentsPage() {
  const canIssue = usePermission('punishments.issue')
  const canRevoke = usePermission('punishments.revoke')

  const [punishments, setPunishments] = useState<Punishment[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [form, setForm] = useState<IssuePunishmentForm>({ citizen_id: '', type: 'WARNING', reason: '', expires_at: '' })
  const [issueLoading, setIssueLoading] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [revokeLoadingId, setRevokeLoadingId] = useState<string | null>(null)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)

  const handleDownloadPdf = async (p: Punishment) => {
    setPdfLoadingId(p.id)
    try {
      await downloadPdfPost(`/api/punishments/${p.id}/pdf`, `punishment-${p.id.slice(0, 8)}.pdf`)
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
      const res = await apiClient.get<Punishment[]>(`/punishments?${params.toString()}`)
      setPunishments(res.data)
    } catch {
      setPunishments([])
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => {
    fetchPunishments()
  }, [fetchPunishments])

  const openIssueModal = async () => {
    setShowIssueModal(true)
    setForm({ citizen_id: '', type: 'WARNING', reason: '', expires_at: '' })
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
      key: 'citizen',
      header: 'Гражданин',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.citizen?.nickname ?? '—'}</span>,
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
            title="Скачать постановление PDF"
          >
            <IconFileTypePdf size={14} />
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
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0A1628', fontFamily: 'Inter, sans-serif' }}>
          Наказания
        </h1>
        {canIssue && (
          <Button variant="primary" onClick={openIssueModal}>
            <IconPlus size={16} />
            Выдать наказание
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <Select options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '180px' }} />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '180px' }} />
      </div>

      {!loading && punishments.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '0.5px solid #D0D7E3', borderRadius: '4px' }}>
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

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        {!loading && `Всего: ${punishments.length}`}
      </div>

      <Modal
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Выдать наказание"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowIssueModal(false)}>Отмена</Button>
            <Button variant="primary" loading={issueLoading} onClick={handleIssue}>Выдать</Button>
          </>
        }
      >
        <form onSubmit={handleIssue} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Гражданин *</label>
            <select
              value={form.citizen_id}
              onChange={(e) => setForm({ ...form, citizen_id: e.target.value })}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            >
              <option value="">— Выберите гражданина —</option>
              {citizens.map((c) => (
                <option key={c.id} value={c.id}>{c.nickname} ({c.reg_number})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Тип *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            >
              {TYPE_OPTIONS.slice(1).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Причина *</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              style={{ padding: '8px 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Истекает (необязательно)</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            />
          </div>
          {issueError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{issueError}</div>}
        </form>
      </Modal>
    </div>
  )
}
