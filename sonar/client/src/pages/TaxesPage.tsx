import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconFileTypePdf } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { TaxPeriod, TaxCharge, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatDate, formatAmount } from '../utils/formatters'
import { downloadPdf } from '../utils/pdf'

const CHARGE_STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'UNPAID', label: 'Не оплачен' },
  { value: 'PAID', label: 'Оплачен' },
  { value: 'CANCELLED', label: 'Отменён' },
]

interface SummaryItem {
  citizen: { id: string; reg_number: string; nickname: string }
  charged: number
  paid: number
  debt: number
}

export function TaxesPage() {
  const canCharge = usePermission('taxes.charge')
  const canMarkPaid = usePermission('taxes.mark_paid')

  const [tab, setTab] = useState<'periods' | 'charges'>('periods')
  const [periods, setPeriods] = useState<TaxPeriod[]>([])
  const [charges, setCharges] = useState<TaxCharge[]>([])
  const [summary, setSummary] = useState<SummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState('')
  const [chargeStatusFilter, setChargeStatusFilter] = useState('')
  const [citizens, setCitizens] = useState<Citizen[]>([])

  const [showCreatePeriodModal, setShowCreatePeriodModal] = useState(false)
  const [periodForm, setPeriodForm] = useState({ name: '', starts_at: '', ends_at: '' })
  const [periodLoading, setPeriodLoading] = useState(false)
  const [periodError, setPeriodError] = useState<string | null>(null)

  const [showChargeModal, setShowChargeModal] = useState(false)
  const [chargeForm, setChargeForm] = useState({ citizen_id: '', period_id: '', amount: '' })
  const [chargeLoading, setChargeLoading] = useState(false)
  const [chargeError, setChargeError] = useState<string | null>(null)

  const [showAutoModal, setShowAutoModal] = useState(false)
  const [autoPeriodId, setAutoPeriodId] = useState('')
  const [autoLoading, setAutoLoading] = useState(false)
  const [payLoadingId, setPayLoadingId] = useState<string | null>(null)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)

  const handleDownloadPeriodPdf = async (period: TaxPeriod) => {
    setPdfLoadingId(period.id)
    try {
      await downloadPdf(`/api/taxes/periods/${period.id}/pdf`, `taxes-${period.name.replace(/\s+/g, '-')}.pdf`)
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoadingId(null)
    }
  }

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await apiClient.get<TaxPeriod[]>('/taxes/periods')
      setPeriods(res.data)
    } catch { setPeriods([]) }
  }, [])

  const fetchCharges = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (periodFilter) params.set('period_id', periodFilter)
      if (chargeStatusFilter) params.set('status', chargeStatusFilter)
      const [chargesRes, summaryRes] = await Promise.all([
        apiClient.get<TaxCharge[]>(`/taxes/charges?${params.toString()}`),
        apiClient.get<SummaryItem[]>(`/taxes/summary${periodFilter ? `?period_id=${periodFilter}` : ''}`),
      ])
      setCharges(chargesRes.data)
      setSummary(summaryRes.data)
    } catch {
      setCharges([])
      setSummary([])
    } finally {
      setLoading(false)
    }
  }, [periodFilter, chargeStatusFilter])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  useEffect(() => {
    if (tab === 'charges') {
      fetchCharges()
    } else {
      setLoading(true)
      fetchPeriods().finally(() => setLoading(false))
    }
  }, [tab, fetchCharges, fetchPeriods])

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodForm.name || !periodForm.starts_at || !periodForm.ends_at) {
      setPeriodError('Все поля обязательны')
      return
    }
    setPeriodLoading(true)
    setPeriodError(null)
    try {
      await apiClient.post('/taxes/periods', periodForm)
      setShowCreatePeriodModal(false)
      setPeriodForm({ name: '', starts_at: '', ends_at: '' })
      fetchPeriods()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setPeriodError(msg)
    } finally {
      setPeriodLoading(false)
    }
  }

  const openChargeModal = async () => {
    setShowChargeModal(true)
    setChargeForm({ citizen_id: '', period_id: periods[0]?.id ?? '', amount: '' })
    setChargeError(null)
    try {
      const res = await apiClient.get<Citizen[]>('/citizens')
      setCitizens(res.data)
    } catch { setCitizens([]) }
  }

  const handleCharge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chargeForm.citizen_id || !chargeForm.period_id || !chargeForm.amount) {
      setChargeError('Все поля обязательны')
      return
    }
    setChargeLoading(true)
    setChargeError(null)
    try {
      await apiClient.post('/taxes/charges', {
        citizen_id: chargeForm.citizen_id,
        period_id: chargeForm.period_id,
        amount: Number(chargeForm.amount),
      })
      setShowChargeModal(false)
      fetchCharges()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setChargeError(msg)
    } finally {
      setChargeLoading(false)
    }
  }

  const handleMarkPaid = async (charge: TaxCharge) => {
    setPayLoadingId(charge.id)
    try {
      await apiClient.post(`/taxes/charges/${charge.id}/pay`, {})
      fetchCharges()
    } catch {
      alert('Ошибка оплаты')
    } finally {
      setPayLoadingId(null)
    }
  }

  const handleAutoCharge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!autoPeriodId) return
    setAutoLoading(true)
    try {
      const res = await apiClient.post<{ created: number }>('/taxes/charges/auto', { period_id: autoPeriodId })
      alert(`Создано начислений: ${res.data.created}`)
      setShowAutoModal(false)
      fetchCharges()
    } catch {
      alert('Ошибка автоначисления')
    } finally {
      setAutoLoading(false)
    }
  }

  const periodOptions = [{ value: '', label: 'Все периоды' }, ...periods.map((p) => ({ value: p.id, label: p.name }))]

  const periodColumns: TableColumn<TaxPeriod>[] = [
    {
      key: 'name',
      header: 'Название',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.name}</span>,
    },
    {
      key: 'starts_at',
      header: 'Начало',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{formatDate(row.starts_at)}</span>,
    },
    {
      key: 'ends_at',
      header: 'Конец',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{formatDate(row.ends_at)}</span>,
    },
    {
      key: 'pdf',
      header: '',
      width: '80px',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          loading={pdfLoadingId === row.id}
          onClick={(e) => { e.stopPropagation(); handleDownloadPeriodPdf(row) }}
          title="Скачать ведомость PDF"
        >
          <IconFileTypePdf size={14} />
        </Button>
      ),
    },
  ]

  const chargeColumns: TableColumn<TaxCharge>[] = [
    {
      key: 'citizen',
      header: 'Гражданин',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.citizen?.nickname ?? '—'}</span>,
    },
    {
      key: 'period',
      header: 'Период',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.period?.name ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Сумма',
      width: '120px',
      render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600, color: '#0A1628' }}>{formatAmount(row.amount)}</span>,
    },
    {
      key: 'building',
      header: 'Объект',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.building?.name ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '120px',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'paid_at',
      header: 'Оплачено',
      width: '120px',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.paid_at ? formatDate(row.paid_at) : '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (row) => (
        row.status === 'UNPAID' && canMarkPaid ? (
          <Button
            variant="primary"
            size="sm"
            loading={payLoadingId === row.id}
            onClick={(e) => { e.stopPropagation(); handleMarkPaid(row) }}
          >
            Оплатить
          </Button>
        ) : null
      ),
    },
  ]

  const summaryColumns: TableColumn<SummaryItem>[] = [
    {
      key: 'citizen',
      header: 'Гражданин',
      render: (row) => <span style={{ fontWeight: 500, color: '#0A1628' }}>{row.citizen.nickname}</span>,
    },
    {
      key: 'charged',
      header: 'Начислено',
      render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{formatAmount(row.charged)}</span>,
    },
    {
      key: 'paid',
      header: 'Оплачено',
      render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#16A34A' }}>{formatAmount(row.paid)}</span>,
    },
    {
      key: 'debt',
      header: 'Долг',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600, color: row.debt > 0 ? '#DC2626' : '#16A34A' }}>
          {formatAmount(row.debt)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>Налоги</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tab === 'periods' && canCharge && (
            <Button variant="primary" size="sm" onClick={() => { setShowCreatePeriodModal(true); setPeriodError(null) }}>
              <IconPlus size={14} />Создать период
            </Button>
          )}
          {tab === 'charges' && canCharge && (
            <>
              <Button variant="secondary" size="sm" onClick={() => { setShowAutoModal(true); setAutoPeriodId(periods[0]?.id ?? '') }}>
                Автоначисление
              </Button>
              <Button variant="primary" size="sm" onClick={openChargeModal}>
                <IconPlus size={14} />Начислить
              </Button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #E5E7EB' }}>
        {(['periods', 'charges'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: tab === t ? 600 : 400, color: tab === t ? '#4A90D9' : '#6B7280', borderBottom: tab === t ? '2px solid #4A90D9' : '2px solid transparent', marginBottom: '-2px' }}
          >
            {t === 'periods' ? 'Периоды' : 'Начисления'}
          </button>
        ))}
      </div>

      {tab === 'periods' && (
        <Table
          columns={periodColumns}
          data={periods}
          keyExtractor={(row) => row.id}
          loading={loading}
        />
      )}

      {tab === 'charges' && (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <Select options={periodOptions} value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={{ width: '220px' }} />
            <Select options={CHARGE_STATUS_OPTIONS} value={chargeStatusFilter} onChange={(e) => setChargeStatusFilter(e.target.value)} style={{ width: '180px' }} />
          </div>
          <Table
            columns={chargeColumns}
            data={charges}
            keyExtractor={(row) => row.id}
            loading={loading}
          />
          {summary.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0A1628', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
                Сводка по гражданам
              </h2>
              <Table
                columns={summaryColumns}
                data={summary}
                keyExtractor={(row) => row.citizen.id}
              />
            </div>
          )}
        </>
      )}

      <Modal
        open={showCreatePeriodModal}
        onClose={() => setShowCreatePeriodModal(false)}
        title="Создать налоговый период"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreatePeriodModal(false)}>Отмена</Button>
            <Button variant="primary" loading={periodLoading} onClick={handleCreatePeriod}>Создать</Button>
          </>
        }
      >
        <form onSubmit={handleCreatePeriod} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Название *" value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Начало *</label>
            <input type="date" value={periodForm.starts_at} onChange={(e) => setPeriodForm({ ...periodForm, starts_at: e.target.value })} style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Конец *</label>
            <input type="date" value={periodForm.ends_at} onChange={(e) => setPeriodForm({ ...periodForm, ends_at: e.target.value })} style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none' }} />
          </div>
          {periodError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{periodError}</div>}
        </form>
      </Modal>

      <Modal
        open={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        title="Создать начисление"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChargeModal(false)}>Отмена</Button>
            <Button variant="primary" loading={chargeLoading} onClick={handleCharge}>Начислить</Button>
          </>
        }
      >
        <form onSubmit={handleCharge} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Гражданин *"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            placeholder="— Выберите —"
            value={chargeForm.citizen_id}
            onChange={(e) => setChargeForm({ ...chargeForm, citizen_id: e.target.value })}
            searchable
          />
          <Select
            label="Период *"
            options={periods.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="— Выберите период —"
            value={chargeForm.period_id}
            onChange={(e) => setChargeForm({ ...chargeForm, period_id: e.target.value })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Сумма (у.е.) *</label>
            <input type="number" min="0" value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }} />
          </div>
          {chargeError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{chargeError}</div>}
        </form>
      </Modal>

      <Modal
        open={showAutoModal}
        onClose={() => setShowAutoModal(false)}
        title="Автоначисление по зданиям"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAutoModal(false)}>Отмена</Button>
            <Button variant="primary" loading={autoLoading} onClick={handleAutoCharge}>Начислить</Button>
          </>
        }
      >
        <form onSubmit={handleAutoCharge} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: '#374151', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            Будут созданы начисления для всех активных зданий с tax_rate &gt; 0.
          </p>
          <Select
            label="Период *"
            options={periods.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="— Выберите период —"
            value={autoPeriodId}
            onChange={(e) => setAutoPeriodId(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  )
}
