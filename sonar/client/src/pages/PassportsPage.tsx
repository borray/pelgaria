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
import { RegistryMark } from '../components/ui/RegistryMark'

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [selectedCitizenId, setSelectedCitizenId] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [validity, setValidity] = useState<'2Y' | '5Y' | 'PERMANENT'>('2Y')
  const [issueLoading, setIssueLoading] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)

  const fetchPassports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await apiClient.get<Passport[]>(`/passports?${params.toString()}`)
      setPassports(res.data)
    } catch {
      setPassports([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

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
    setValidity('2Y')
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

  const updateIssueDate = (value: string) => {
    setIssuedAt(value)
    if (!value || validity === 'PERMANENT') return
    const date = new Date(`${value}T00:00:00`)
    date.setFullYear(date.getFullYear() + (validity === '5Y' ? 5 : 2))
    setExpiresAt(date.toISOString().slice(0, 10))
  }

  const updateValidity = (value: '2Y' | '5Y' | 'PERMANENT') => {
    setValidity(value)
    if (value === 'PERMANENT') {
      setExpiresAt('')
    } else if (issuedAt) {
      const date = new Date(`${issuedAt}T00:00:00`)
      date.setFullYear(date.getFullYear() + (value === '5Y' ? 5 : 2))
      setExpiresAt(date.toISOString().slice(0, 10))
    }
  }

  const columns: TableColumn<Passport>[] = [
    {
      key: 'number',
      header: 'Номер',
      width: '180px',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#26342E', fontWeight: 600 }}>
          {row.number}
        </span>
      ),
    },
    {
      key: 'citizen',
      header: 'Гражданин',
      render: (row) => (
        <span style={{ fontWeight: 500, color: '#18211D' }}>
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
      key: 'registry_code',
      header: 'ШК',
      width: '210px',
      render: (row) => <RegistryMark code={row.registry_code} compact />,
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
          title="Сформировать паспорт"
        >
          <IconPrinter size={14} /> Сформировать
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#18211D', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
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
        <input className="registry-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Гражданин, номер или ШК..." />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '200px' }}
        />
      </div>

      {!loading && passports.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
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
        description="Номер паспорта и ШК будут присвоены автоматически реестром СОНАР."
        width={760}
        title="Выдать паспорт"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowIssueModal(false)}>Отмена</Button>
            <Button variant="primary" loading={issueLoading} onClick={handleIssue}>Выдать</Button>
          </>
        }
      >
        <form onSubmit={handleIssue} className="form-section-stack">
          <section className="form-section">
            <div className="form-section-heading"><span>01</span><div><strong>Получатель документа</strong><small>Проверьте реестровую запись перед выдачей</small></div></div>
            <Select label="Гражданин *" options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))} placeholder="— Найдите гражданина —" value={selectedCitizenId} onChange={(e) => setSelectedCitizenId(e.target.value)} searchable />
            {selectedCitizenId && <div className="document-preview"><RegistryMark code={citizens.find((c) => c.id === selectedCitizenId)?.reg_number} compact /><span>Паспорт будет связан с выбранной записью гражданина</span></div>}
          </section>
          <section className="form-section">
            <div className="form-section-heading"><span>02</span><div><strong>Срок и реквизиты</strong><small>Номер паспорта и ШК создаются автоматически</small></div></div>
            <div className="number-mode passport-validity">
              <button type="button" className={validity === '2Y' ? 'is-active' : ''} onClick={() => updateValidity('2Y')}>2 года</button>
              <button type="button" className={validity === '5Y' ? 'is-active' : ''} onClick={() => updateValidity('5Y')}>5 лет</button>
              <button type="button" className={validity === 'PERMANENT' ? 'is-active' : ''} onClick={() => updateValidity('PERMANENT')}>Бессрочно</button>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <Input label="Дата выдачи" type="date" value={issuedAt} onChange={(e) => updateIssueDate(e.target.value)} />
              <Input label="Действителен до" type="date" disabled={validity === 'PERMANENT'} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </section>
          <section className="passport-confirm">
            <div><span>Серия</span><strong>ПСП · автоматически</strong></div>
            <div><span>Защита</span><strong>ШК + штрихкод + гильош</strong></div>
            <div><span>Вывод</span><strong>PDF для ч/б печати</strong></div>
          </section>
          {issueError && (
            <div className="form-error">{issueError}</div>
          )}
        </form>
      </Modal>
    </div>
  )
}
