import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconEdit, IconTrash, IconArrowLeft, IconPrinter } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Citizen, GeneratedDocument } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate, formatDateTime, formatAmount } from '../utils/formatters'
import { printPdf } from '../utils/pdf'
import { RegistryMark } from '../components/ui/RegistryMark'

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'INACTIVE', label: 'Неактивен' },
  { value: 'UNDER_INVESTIGATION', label: 'Под следствием' },
  { value: 'EXILED', label: 'В изгнании' },
  { value: 'BANNED', label: 'Забанен' },
]

type TabKey = 'passport' | 'documents' | 'cases' | 'punishments' | 'taxes' | 'buildings'

export function CitizenDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canEdit = usePermission('citizens.edit')
  const canDelete = usePermission('citizens.delete')

  const [citizen, setCitizen] = useState<Citizen | null>(null)
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('passport')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    nickname: '',
    discord_username: '',
    role_title: '',
    status: '',
    note: '',
  })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiClient
      .get<Citizen>(`/citizens/${id}`)
      .then((res) => {
        setCitizen(res.data)
        setEditForm({
          nickname: res.data.nickname,
          discord_username: res.data.discord_username ?? '',
          role_title: res.data.role_title,
          status: res.data.status,
          note: res.data.note ?? '',
        })
      })
      .catch(() => {
        setCitizen(null)
      })
      .finally(() => setLoading(false))
    apiClient
      .get<GeneratedDocument[]>(`/print-center/documents?citizen_id=${encodeURIComponent(id)}`)
      .then((res) => setGeneratedDocuments(res.data))
      .catch(() => setGeneratedDocuments([]))
  }, [id])

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!citizen) return
    setEditError(null)
    setEditLoading(true)
    try {
      const res = await apiClient.put<Citizen>(`/citizens/${citizen.id}`, {
        nickname: editForm.nickname.trim(),
        discord_username: editForm.discord_username.trim() || null,
        role_title: editForm.role_title,
        status: editForm.status,
        note: editForm.note.trim() || null,
      })
      setCitizen(res.data)
      setShowEditModal(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка сохранения'
      setEditError(msg)
    } finally {
      setEditLoading(false)
    }
  }

  const [pdfLoading, setPdfLoading] = useState(false)

  const handleDownloadPdf = async () => {
    if (!citizen) return
    setPdfLoading(true)
    try {
      await printPdf(`/api/citizens/${citizen.id}/pdf`)
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!citizen) return
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/citizens/${citizen.id}`)
      navigate('/citizens')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка удаления'
      alert(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Spinner />
      </div>
    )
  }

  if (!citizen) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'Inter, sans-serif', color: '#6B7280' }}>
        Гражданин не найден
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'passport', label: 'Паспорт', count: citizen.passports?.length },
    { key: 'documents', label: 'Формы и справки', count: generatedDocuments.length },
    { key: 'cases', label: 'Дела', count: citizen.cases?.length },
    { key: 'punishments', label: 'Наказания', count: citizen.punishments?.length },
    { key: 'taxes', label: 'Налоги', count: citizen.tax_charges?.length },
    { key: 'buildings', label: 'Постройки', count: citizen.buildings?.length },
  ]

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Button variant="secondary" size="sm" onClick={() => navigate('/citizens')}>
          <IconArrowLeft size={14} />
          Назад
        </Button>
        <div style={{ flex: 1 }} />
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
            <IconEdit size={14} />
            Редактировать
          </Button>
        )}
        <Button variant="secondary" size="sm" loading={pdfLoading} onClick={handleDownloadPdf}>
          <IconPrinter size={14} />
          Сформировать досье
        </Button>
        {canDelete && (
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            <IconTrash size={14} />
            Удалить
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '4px',
              }}
            >
              {citizen.reg_number}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#0A1628', marginBottom: '8px' }}>
              {citizen.nickname}
            </div>
            <Badge status={citizen.status} />
          </div>
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <InfoRow label="Discord" value={citizen.discord_username ?? '—'} />
            <InfoRow label="Роль / звание" value={citizen.role_title} />
            <InfoRow label="Дата вступления" value={formatDate(citizen.joined_at)} />
            {citizen.user && (
              <InfoRow label="Аккаунт" value={citizen.user.login} />
            )}
            {citizen.note && (
              <InfoRow label="Примечание" value={citizen.note} />
            )}
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #D0D7E3', marginBottom: '16px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #4A90D9' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#4A90D9' : '#6B7280',
              fontFamily: 'Inter, sans-serif',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                style={{
                  background: activeTab === tab.key ? '#4A90D9' : '#D0D7E3',
                  color: activeTab === tab.key ? '#FFFFFF' : '#6B7280',
                  borderRadius: '10px',
                  padding: '0 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'passport' && (
          <PassportTab passports={citizen.passports ?? []} />
        )}
        {activeTab === 'documents' && (
          generatedDocuments.length === 0
            ? <EmptyState title="Прикрепленных документов нет" description="Сформируйте заявление или справку в Центре печати." />
            : <Table
                columns={[
                  { key: 'number', header: 'Документ', render: (row: GeneratedDocument) => <div><strong>{row.title}</strong><div className="table-secondary">{row.number}</div></div> },
                  { key: 'registry_code', header: 'ШК', width: '210px', render: (row: GeneratedDocument) => <RegistryMark code={row.registry_code} compact /> },
                  { key: 'created_at', header: 'Создан', width: '120px', render: (row: GeneratedDocument) => formatDate(row.created_at) },
                  { key: 'print', header: '', width: '130px', render: (row: GeneratedDocument) => <Button variant="secondary" size="sm" onClick={() => printPdf(`/api/print-center/documents/${row.id}/pdf`)}><IconPrinter size={14} />Сформировать</Button> },
                ]}
                data={generatedDocuments}
                keyExtractor={(row) => row.id}
              />
        )}
        {activeTab === 'cases' && (
          <CasesTab cases={citizen.cases ?? []} />
        )}
        {activeTab === 'punishments' && (
          <PunishmentsTab punishments={citizen.punishments ?? []} />
        )}
        {activeTab === 'taxes' && (
          <TaxesTab charges={citizen.tax_charges ?? []} />
        )}
        {activeTab === 'buildings' && (
          <BuildingsTab buildings={citizen.buildings ?? []} />
        )}
      </div>

      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditError(null) }}
        title="Редактировать гражданина"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditError(null) }}>
              Отмена
            </Button>
            <Button variant="primary" loading={editLoading} onClick={handleEdit}>
              Сохранить
            </Button>
          </>
        }
      >
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Никнейм *"
            value={editForm.nickname}
            onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
          />
          <Input
            label="Discord username"
            value={editForm.discord_username}
            onChange={(e) => setEditForm({ ...editForm, discord_username: e.target.value })}
          />
          <Input
            label="Звание / роль"
            value={editForm.role_title}
            onChange={(e) => setEditForm({ ...editForm, role_title: e.target.value })}
          />
          <Select
            label="Статус"
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            options={STATUS_OPTIONS}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              Примечание
            </label>
            <textarea
              value={editForm.note}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              rows={3}
              style={{
                padding: '8px 10px',
                border: '1px solid #D0D7E3',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
          {editError && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>
              {editError}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Удалить гражданина"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Отмена
            </Button>
            <Button variant="danger" loading={deleteLoading} onClick={handleDelete}>
              Удалить
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
          Вы уверены, что хотите удалить гражданина{' '}
          <strong>{citizen.nickname}</strong> ({citizen.reg_number})?
          Это действие нельзя отменить.
        </p>
      </Modal>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', color: '#374151' }}>{value}</div>
    </div>
  )
}

function PassportTab({ passports }: { passports: NonNullable<Citizen['passports']> }) {
  const columns: TableColumn<(typeof passports)[number]>[] = [
    {
      key: 'number',
      header: 'Номер',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{row.number}</span>
      ),
    },
    { key: 'status', header: 'Статус', render: (row) => <Badge status={row.status} /> },
    {
      key: 'issued_at',
      header: 'Выдан',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.issued_at)}</span>,
    },
    {
      key: 'expires_at',
      header: 'Истекает',
      render: (row) => (
        <span style={{ color: '#6B7280', fontSize: '13px' }}>{row.expires_at ? formatDate(row.expires_at) : '—'}</span>
      ),
    },
    {
      key: 'issued_by',
      header: 'Выдал',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{row.issued_by?.login ?? '—'}</span>,
    },
  ]

  if (passports.length === 0) return <EmptyState title="Паспорта не найдены" />
  return <Table columns={columns} data={passports} keyExtractor={(r) => r.id} />
}

function CasesTab({ cases }: { cases: NonNullable<Citizen['cases']> }) {
  const columns: TableColumn<(typeof cases)[number]>[] = [
    {
      key: 'number',
      header: 'Номер дела',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{row.number}</span>
      ),
    },
    { key: 'status', header: 'Статус', render: (row) => <Badge status={row.status} /> },
    {
      key: 'description',
      header: 'Описание',
      render: (row) => (
        <span style={{ color: '#374151', fontSize: '13px' }}>
          {row.description.length > 80 ? row.description.slice(0, 80) + '...' : row.description}
        </span>
      ),
    },
    {
      key: 'opened_at',
      header: 'Открыто',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.opened_at)}</span>,
    },
  ]

  if (cases.length === 0) return <EmptyState title="Дела не найдены" />
  return <Table columns={columns} data={cases} keyExtractor={(r) => r.id} />
}

function PunishmentsTab({ punishments }: { punishments: NonNullable<Citizen['punishments']> }) {
  const columns: TableColumn<(typeof punishments)[number]>[] = [
    { key: 'type', header: 'Тип', render: (row) => <Badge status={row.type} /> },
    { key: 'status', header: 'Статус', render: (row) => <Badge status={row.status} /> },
    {
      key: 'reason',
      header: 'Причина',
      render: (row) => (
        <span style={{ color: '#374151', fontSize: '13px' }}>
          {row.reason.length > 80 ? row.reason.slice(0, 80) + '...' : row.reason}
        </span>
      ),
    },
    {
      key: 'issued_at',
      header: 'Выдано',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(row.issued_at)}</span>,
    },
    {
      key: 'issued_by',
      header: 'Кем',
      render: (row) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{row.issued_by?.login ?? '—'}</span>,
    },
  ]

  if (punishments.length === 0) return <EmptyState title="Наказания не найдены" />
  return <Table columns={columns} data={punishments} keyExtractor={(r) => r.id} />
}

function TaxesTab({ charges }: { charges: NonNullable<Citizen['tax_charges']> }) {
  const columns: TableColumn<(typeof charges)[number]>[] = [
    {
      key: 'period',
      header: 'Период',
      render: (row) => <span style={{ color: '#374151', fontSize: '13px' }}>{row.period?.name ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Сумма',
      render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{formatAmount(row.amount)}</span>,
    },
    { key: 'status', header: 'Статус', render: (row) => <Badge status={row.status} /> },
    {
      key: 'paid_at',
      header: 'Оплачен',
      render: (row) => (
        <span style={{ color: '#6B7280', fontSize: '13px' }}>{row.paid_at ? formatDateTime(row.paid_at) : '—'}</span>
      ),
    },
  ]

  if (charges.length === 0) return <EmptyState title="Налоговые начисления не найдены" />
  return <Table columns={columns} data={charges} keyExtractor={(r) => r.id} />
}

function BuildingsTab({ buildings }: { buildings: NonNullable<Citizen['buildings']> }) {
  const columns: TableColumn<(typeof buildings)[number]>[] = [
    {
      key: 'reg_number',
      header: 'Рег. номер',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{row.reg_number}</span>
      ),
    },
    {
      key: 'name',
      header: 'Название',
      render: (row) => <span style={{ fontWeight: 500 }}>{row.name}</span>,
    },
    { key: 'type', header: 'Тип', render: (row) => <Badge status={row.type} /> },
    { key: 'status', header: 'Статус', render: (row) => <Badge status={row.status} /> },
    {
      key: 'coords',
      header: 'Координаты',
      render: (row) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#6B7280' }}>
          {row.coord_x}, {row.coord_y}, {row.coord_z}
        </span>
      ),
    },
  ]

  if (buildings.length === 0) return <EmptyState title="Постройки не найдены" />
  return <Table columns={columns} data={buildings} keyExtractor={(r) => r.id} />
}
