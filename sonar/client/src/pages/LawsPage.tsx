import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowRight,
  IconBook2,
  IconFileText,
  IconHistory,
  IconPlus,
  IconSearch,
  IconScale,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Law, LawType } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { RegistryMark } from '../components/ui/RegistryMark'

const LAW_TYPES = [
  { value: 'LAW', label: 'Закон' },
  { value: 'DECREE', label: 'Указ' },
  { value: 'CONSTITUTION', label: 'Конституция / конституционный акт' },
  { value: 'REGULATION', label: 'Постановление' },
  { value: 'ORDER', label: 'Распоряжение' },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Действует' },
  { value: 'SUSPENDED', label: 'Приостановлен' },
  { value: 'REPEALED', label: 'Отменён' },
]

interface LawsOverview {
  constitution: Law | null
  stats: { total: number; active: number; suspended: number; repealed: number }
  categories: Array<{ category: string | null; _count: number }>
  recent: Array<Pick<Law, 'id' | 'number' | 'title' | 'type' | 'status' | 'revision_number'> & { updated_at: string }>
}

interface CreateLawForm {
  type: LawType
  category: string
  title: string
  short_title: string
  summary: string
  body: string
  authority: string
  source: string
  keywords: string
  parent_id: string
  adopted_at: string
  effective_at: string
  auto_number: boolean
  number: string
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = (type: LawType = 'LAW'): CreateLawForm => ({
  type,
  category: type === 'CONSTITUTION' ? 'Основы государственного строя' : '',
  title: type === 'CONSTITUTION' ? 'Конституция Пельагрии' : '',
  short_title: '',
  summary: '',
  body: '',
  authority: '',
  source: '',
  keywords: '',
  parent_id: '',
  adopted_at: today(),
  effective_at: '',
  auto_number: true,
  number: '',
})

export function LawsPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('laws.create')
  const [laws, setLaws] = useState<Law[]>([])
  const [overview, setOverview] = useState<LawsOverview | null>(null)
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
      const [lawsResponse, overviewResponse] = await Promise.all([
        apiClient.get<Law[]>(`/laws?${params.toString()}`),
        apiClient.get<LawsOverview>('/laws/overview'),
      ])
      setLaws(lawsResponse.data)
      setOverview(overviewResponse.data)
    } catch {
      setLaws([])
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(fetchLaws, 250)
    return () => window.clearTimeout(timer)
  }, [fetchLaws])

  const openCreate = (type: LawType = 'LAW') => {
    setForm(emptyForm(type))
    setCreateError(null)
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setCreateError('Название и полный текст обязательны')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const response = await apiClient.post<Law>('/laws', {
        ...form,
        category: form.category.trim() || null,
        short_title: form.short_title.trim() || null,
        summary: form.summary.trim() || null,
        authority: form.authority.trim() || null,
        source: form.source.trim() || null,
        keywords: form.keywords,
        parent_id: form.parent_id || null,
        effective_at: form.effective_at || null,
        ...(!form.auto_number ? { number: form.number } : {}),
      })
      setShowCreateModal(false)
      await fetchLaws()
      navigate(`/laws/${response.data.id}`)
    } catch (error: unknown) {
      setCreateError((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось создать документ')
    } finally {
      setCreateLoading(false)
    }
  }

  const activeLaws = useMemo(() => laws.filter((law) => law.status === 'ACTIVE'), [laws])
  const parentOptions = activeLaws
    .filter((law) => law.id !== form.parent_id)
    .map((law) => ({ value: law.id, label: `${law.number} · ${law.title}` }))

  const columns: TableColumn<Law>[] = [
    {
      key: 'number',
      header: 'Документ',
      width: '175px',
      render: (row) => (
        <div><strong>{row.number}</strong><div className="table-secondary">Редакция {row.revision_number}</div></div>
      ),
    },
    { key: 'registry_code', header: 'ШК', width: '205px', render: (row) => <RegistryMark code={row.registry_code} compact /> },
    { key: 'type', header: 'Тип', width: '130px', render: (row) => <Badge status={row.type} /> },
    {
      key: 'title',
      header: 'Название',
      render: (row) => (
        <div>
          <strong>{row.short_title || row.title}</strong>
          <div className="table-secondary">{row.category || row.summary || 'Без категории'}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Статус', width: '135px', render: (row) => <Badge status={row.status} /> },
    { key: 'adopted_at', header: 'Принят', width: '110px', render: (row) => formatDate(row.adopted_at) },
  ]

  return (
    <div className="laws-hub">
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Правовая система</span>
          <h1>Законодательство</h1>
          <p>Конституция, нормативные акты, редакции, изменения и архив правовых документов.</p>
        </div>
        {canCreate && <Button variant="primary" onClick={() => openCreate()}><IconPlus size={16} /> Новый акт</Button>}
      </div>

      <section className={`constitution-card${overview?.constitution ? '' : ' is-empty'}`}>
        <div className="constitution-symbol"><IconBook2 size={28} /></div>
        <div className="constitution-copy">
          <span>Основной закон</span>
          {overview?.constitution ? (
            <>
              <h2>{overview.constitution.short_title || overview.constitution.title}</h2>
              <p>{overview.constitution.summary || 'Действующая редакция основного закона государства.'}</p>
              <div>
                <RegistryMark code={overview.constitution.registry_code} compact />
                <Badge status={overview.constitution.status} />
                <small>Редакция {overview.constitution.revision_number}</small>
              </div>
            </>
          ) : (
            <>
              <h2>Конституция не зарегистрирована</h2>
              <p>Создайте основной закон, чтобы закрепить его отдельно от общего реестра.</p>
            </>
          )}
        </div>
        {overview?.constitution
          ? <Button variant="secondary" onClick={() => navigate(`/laws/${overview.constitution!.id}`)}>Открыть <IconArrowRight size={15} /></Button>
          : canCreate && <Button variant="primary" onClick={() => openCreate('CONSTITUTION')}>Создать конституцию</Button>}
      </section>

      <div className="law-stats">
        <div><IconScale size={19} /><span>Действует<strong>{overview?.stats.active ?? 0}</strong></span></div>
        <div><IconHistory size={19} /><span>Приостановлено<strong>{overview?.stats.suspended ?? 0}</strong></span></div>
        <div><IconFileText size={19} /><span>Архив<strong>{overview?.stats.repealed ?? 0}</strong></span></div>
        <div><IconBook2 size={19} /><span>Всего актов<strong>{overview?.stats.total ?? 0}</strong></span></div>
      </div>

      <section className="law-register">
        <div className="section-heading law-register-heading">
          <div><span>Единый правовой реестр</span><h2>Нормативные акты</h2></div>
          <div className="law-filters">
            <label className="archive-search"><IconSearch size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Текст, номер, ШК, орган или ключевое слово" /></label>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} placeholder="Все типы" options={LAW_TYPES} />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="Все статусы" options={STATUS_OPTIONS} />
          </div>
        </div>

        {!loading && laws.length === 0
          ? <EmptyState title="Документы не найдены" description="Измените фильтры или создайте новый нормативный акт." action={canCreate ? <Button size="sm" onClick={() => openCreate()}><IconPlus size={14} /> Создать</Button> : undefined} />
          : <Table columns={columns} data={laws} keyExtractor={(row) => row.id} onRowClick={(row) => navigate(`/laws/${row.id}`)} loading={loading} />}
      </section>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={form.type === 'CONSTITUTION' ? 'Зарегистрировать конституцию' : 'Создать нормативный акт'}
        description="Документ получит защищённый номер, ШК и первую редакцию."
        width={820}
        footer={<><Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button><Button variant="primary" loading={createLoading} onClick={handleCreate}>Зарегистрировать</Button></>}
      >
        <div className="form-section-stack">
          <section className="form-section">
            <div className="form-section-heading"><span>01</span><div><strong>Классификация</strong><small>Вид акта, место в системе и нумерация</small></div></div>
            <div className="form-grid">
              <Select label="Тип документа" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as LawType })} options={LAW_TYPES} />
              <Input label="Категория / отрасль" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Государственное устройство" />
              <div className="span-2">
                <Select label="Изменяет или дополняет акт" searchable value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })} placeholder="Самостоятельный документ" options={parentOptions} />
              </div>
            </div>
            <div className="number-mode">
              <button type="button" className={form.auto_number ? 'is-active' : ''} onClick={() => setForm({ ...form, auto_number: true, number: '' })}>Автоматический номер</button>
              <button type="button" className={!form.auto_number ? 'is-active' : ''} onClick={() => setForm({ ...form, auto_number: false })}>Указать вручную</button>
            </div>
            {!form.auto_number && <Input label="Регистрационный номер" value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} placeholder="КОНСТ-01 или ЗАК-2026-04" />}
          </section>

          <section className="form-section">
            <div className="form-section-heading"><span>02</span><div><strong>Реквизиты</strong><small>Официальное представление документа</small></div></div>
            <div className="form-grid">
              <div className="span-2"><Input label="Полное название *" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
              <Input label="Краткое название" value={form.short_title} onChange={(event) => setForm({ ...form, short_title: event.target.value })} />
              <Input label="Издавший орган / должностное лицо" value={form.authority} onChange={(event) => setForm({ ...form, authority: event.target.value })} />
              <Input label="Дата принятия" type="date" value={form.adopted_at} onChange={(event) => setForm({ ...form, adopted_at: event.target.value })} />
              <Input label="Вступает в силу" type="date" value={form.effective_at} onChange={(event) => setForm({ ...form, effective_at: event.target.value })} />
              <div className="span-2"><Input label="Краткое описание" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></div>
              <Input label="Источник публикации" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
              <Input label="Ключевые слова через запятую" value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} />
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-heading"><span>03</span><div><strong>Полный текст</strong><small>Разделы и статьи можно вводить с переносами строк</small></div></div>
            <textarea className="document-textarea law-body-editor" rows={16} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={'Раздел I. Общие положения\n\nСтатья 1. ...'} />
          </section>
          {createError && <div className="form-error">{createError}</div>}
        </div>
      </Modal>
    </div>
  )
}
