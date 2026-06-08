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
import { RegistryMark } from '../components/ui/RegistryMark'

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
  auto_number: boolean
  number: string
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = (): CreateLawForm => ({
  type: 'LAW',
  title: '',
  body: '',
  adopted_at: today(),
  auto_number: true,
  number: '',
})

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
  const [form, setForm] = useState<CreateLawForm>(emptyForm())

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
        adopted_at: form.adopted_at,
        auto_number: form.auto_number,
        ...(!form.auto_number ? { number: form.number } : {}),
      })
      setShowCreateModal(false)
      setForm(emptyForm())
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
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#26342E', fontWeight: 600 }}>
          {row.number}
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
      key: 'type',
      header: 'Тип',
      width: '100px',
      render: (row) => <Badge status={row.type} />,
    },
    {
      key: 'title',
      header: 'Название',
      render: (row) => <span style={{ fontWeight: 500, color: '#18211D' }}>{row.title}</span>,
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
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#18211D', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
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
            placeholder="Название, номер или ШК..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', height: '36px', padding: '0 10px 0 34px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <Select options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '140px' }} />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '180px' }} />
      </div>

      {!loading && laws.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
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
        onClose={() => { setShowCreateModal(false); setCreateError(null); setForm(emptyForm()) }}
        title="Создать закон / указ"
        description="Регистрация нормативного документа в едином реестре СОНАР"
        width={680}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>Создать</Button>
          </>
        }
      >
        <form onSubmit={handleCreate}>
          <section className="form-section">
            <div className="form-section-heading">
              <div><strong>Регистрация документа</strong><span>Система присвоит номер и уникальный ШК</span></div>
            </div>
            <div className="number-mode">
              <button type="button" className={form.auto_number ? 'is-active' : ''} onClick={() => setForm({ ...form, auto_number: true, number: '' })}>Автоматический номер</button>
              <button type="button" className={!form.auto_number ? 'is-active' : ''} onClick={() => setForm({ ...form, auto_number: false })}>Указать вручную</button>
            </div>
            {form.auto_number ? (
              <div className="document-preview">
                Формат номера:
                <strong>{form.type === 'LAW' ? 'ЗАК' : 'УКЗ'}-{new Date(form.adopted_at || Date.now()).getFullYear()}-0001</strong>
                · ШК будет создан автоматически
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <Input label="Регистрационный номер *" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Например: ЗАК-2026-0042" />
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-heading"><div><strong>Реквизиты</strong><span>Основные сведения нормативного акта</span></div></div>
            <div className="form-grid">
              <Select label="Тип документа" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'LAW', label: 'Закон' }, { value: 'DECREE', label: 'Указ' }]} />
              <Input label="Дата принятия *" type="date" value={form.adopted_at} onChange={(e) => setForm({ ...form, adopted_at: e.target.value })} />
              <div className="span-2">
                <Input label="Название документа *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus placeholder="Краткое официальное наименование" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-heading"><div><strong>Содержание</strong><span>Полный текст в редакции на дату принятия</span></div></div>
            <textarea className="document-textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={11} placeholder="Введите текст документа..." />
          </section>
          {createError && (
            <div className="form-error">
              {createError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
