import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconPrinter } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Passport, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { printPdf } from '../utils/pdf'

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'VALID', label: 'Действителен' },
  { value: 'REVOKED', label: 'Отозван' },
  { value: 'EXPIRED', label: 'Истёк' },
]

export function PassportsPage() {
  const canIssue = usePermission('passports.issue')

  const [passports, setPassports] = useState<Passport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [selectedCitizenId, setSelectedCitizenId] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [issueLoading, setIssueLoading] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)

  const fetchPassports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiClient.get<Passport[]>(`/passports?${params.toString()}`)
      setPassports(res.data)
    } catch {
      setPassports([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchPassports()
  }, [fetchPassports])

  const fetchCitizens = async () => {
    try {
      const res = await apiClient.get<Citizen[]>('/citizens')
      setCitizens(res.data)
    } catch {
      setCitizens([])
    }
  }

  const openIssueModal = () => {
    setShowIssueModal(true)
    setSelectedCitizenId('')
    setIssuedAt('')
    setExpiresAt('')
    setIssueError(null)
    fetchCitizens()
  }

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCitizenId) {
      setIssueError('Выберите гражданина')
      return
    }
    setIssueLoading(true)
    setIssueError(null)
    try {
      await apiClient.post('/passports', {
        citizen_id: selectedCitizenId,
        ...(issuedAt ? { issued_at: issuedAt } : {}),
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      })
      setShowIssueModal(false)
      fetchPassports()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка выдачи'
      setIssueError(msg)
    } finally {
      setIssueLoading(false)
    }
  }

  const handleDownloadPdf = async (passport: Passport) => {
    setPdfLoadingId(passport.id)
    try {
      await printPdf(`/api/passports/${passport.id}/pdf`)
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoadingId(null)
    }
  }

  const columns: TableColumn<Passport>[] = [
    {
      key: 'number',
      header: 'Номер',
      width: '180px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#1B3A6B', fontWeight: 600 }}>
          {row.number}
        </span>
      ),
    },
    {
      key: 'citizen',
      header: 'Гражданин',
      render: (row) => (
        <span style={{ fontWeight: 500, color: '#0A1628' }}>
          {row.citizen?.nickname ?? '—'}
          {row.citizen && (
            <span style={{ color: '#9CA3AF', fontSize: '12px', marginLeft: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
              {row.citizen.reg_number}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'issued_at',
      header: 'Дата выдачи',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.issued_at)}</span>,
    },
    {
      key: 'expires_at',
      header: 'Действителен до',
      render: (row) => (
        <span style={{ color: '#6B7280', fontSize: '13px' }}>
          {row.expires_at ? formatDate(row.expires_at) : 'Бессрочно'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleDownloadPdf(row) }}
          loading={pdfLoadingId === row.id}
          title="Печать паспорта"
        >
          <IconPrinter size={14} />
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
          Паспорта
        </h1>
        {canIssue && (
          <Button variant="primary" onClick={openIssueModal}>
            <IconPlus size={16} />
            Выдать паспорт
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '200px' }}
        />
      </div>

      {!loading && passports.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          <EmptyState
            title="Паспорта не найдены"
            description={statusFilter ? 'Попробуйте изменить фильтр' : 'Выдайте первый паспорт'}
            action={
              canIssue ? (
                <Button variant="primary" size="sm" onClick={openIssueModal}>
                  <IconPlus size={14} />
                  Выдать паспорт
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <Table
          columns={columns}
          data={passports}
          keyExtractor={(row) => row.id}
          loading={loading}
        />
      )}

      <div style={{ marginTop: '12px', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        {!loading && `Всего: ${passports.length}`}
      </div>

      <Modal
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Выдать паспорт"
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
            value={selectedCitizenId}
            onChange={(e) => setSelectedCitizenId(e.target.value)}
            searchable
          />
          <Input
            label="Дата выдачи"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
          <Input
            label="Действителен до"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          {issueError && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>
              {issueError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
