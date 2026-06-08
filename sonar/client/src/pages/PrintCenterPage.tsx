import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconArchive,
  IconFileCertificate,
  IconLink,
  IconPlus,
  IconPrinter,
  IconSearch,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type { Building, Citizen, GeneratedDocument } from '../types'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Table, type TableColumn } from '../components/ui/Table'
import { RegistryMark } from '../components/ui/RegistryMark'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { confirmDocumentFormation, printPdf } from '../utils/pdf'

interface FormTemplate {
  id: string
  title: string
  description: string
  prefix: string
  fields: string[]
}

const FIELD_LABELS: Record<string, string> = {
  applicant_name: 'Имя заявителя',
  discord_username: 'Discord',
  basis: 'Основание',
  residence: 'Место проживания',
  comment: 'Дополнительные сведения',
  purpose: 'Цель предоставления',
  recipient: 'Кому предоставляется',
  period: 'Период',
  building_name: 'Наименование объекта',
  building_number: 'Номер РЕЛИКТ',
}

export function PrintCenterPage() {
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [citizens, setCitizens] = useState<Citizen[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null)
  const [citizenId, setCitizenId] = useState('')
  const [linkType, setLinkType] = useState('CITIZEN')
  const [linkId, setLinkId] = useState('')
  const [payload, setPayload] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<GeneratedDocument[]>(`/print-center/documents${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      setDocuments(res.data)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    Promise.allSettled([
      apiClient.get<FormTemplate[]>('/print-center/templates'),
      apiClient.get<Citizen[]>('/citizens'),
      apiClient.get<Building[]>('/buildings'),
    ]).then(([templateRes, citizenRes, buildingRes]) => {
      if (templateRes.status === 'fulfilled') setTemplates(templateRes.value.data)
      if (citizenRes.status === 'fulfilled') setCitizens(citizenRes.value.data)
      if (buildingRes.status === 'fulfilled') setBuildings(buildingRes.value.data)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchDocuments, 250)
    return () => clearTimeout(timer)
  }, [fetchDocuments])

  const openTemplate = (template: FormTemplate) => {
    setSelectedTemplate(template)
    setCitizenId('')
    setLinkType(template.id === 'RELICT_EXTRACT' ? 'BUILDING' : 'CITIZEN')
    setLinkId('')
    setPayload({})
    setError(null)
  }

  const createDocument = async () => {
    if (!selectedTemplate) return
    const confirmed = await confirmDocumentFormation(
      selectedTemplate.title,
      'Форма получит официальный номер и будет сохранена в архиве СОНАР.'
    )
    if (!confirmed) return
    setCreating(true)
    setError(null)
    try {
      const res = await apiClient.post<GeneratedDocument>('/print-center/documents', {
        template_type: selectedTemplate.id,
        citizen_id: citizenId || null,
        linked_entity_type: linkId ? linkType : (citizenId ? 'CITIZEN' : null),
        linked_entity_id: linkId || citizenId || null,
        payload,
      })
      setSelectedTemplate(null)
      await fetchDocuments()
      await printPdf(`/api/print-center/documents/${res.data.id}/pdf`, true)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось сформировать документ')
    } finally {
      setCreating(false)
    }
  }

  const stats = useMemo(() => ({
    total: documents.length,
    today: documents.filter((item) => new Date(item.created_at).toDateString() === new Date().toDateString()).length,
    linked: documents.filter((item) => item.linked_entity_id).length,
  }), [documents])

  const columns: TableColumn<GeneratedDocument>[] = [
    { key: 'number', header: 'Документ', width: '170px', render: (row) => <div><strong>{row.number}</strong><div className="table-secondary">{row.title}</div></div> },
    { key: 'registry_code', header: 'ШК', width: '210px', render: (row) => <RegistryMark code={row.registry_code} compact /> },
    { key: 'citizen', header: 'Гражданин', render: (row) => row.citizen ? `${row.citizen.nickname} · ${row.citizen.reg_number}` : 'Без привязки' },
    { key: 'link', header: 'Прикрепление', width: '150px', render: (row) => <span className={row.linked_entity_id ? 'link-status is-linked' : 'link-status'}><IconLink size={13} />{row.linked_entity_id ? row.linked_entity_type : 'Не прикреплен'}</span> },
    { key: 'created_at', header: 'Создан', width: '120px', render: (row) => formatDate(row.created_at) },
    { key: 'actions', header: '', width: '130px', render: (row) => <Button variant="secondary" size="sm" title="Сформировать документ" onClick={() => printPdf(`/api/print-center/documents/${row.id}/pdf`)}><IconPrinter size={15} />Сформировать</Button> },
  ]

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Документооборот</span>
          <h1>Центр печати</h1>
          <p>Формы, справки, выписки и архив сформированных документов.</p>
        </div>
        <Button variant="primary" onClick={() => templates[0] && openTemplate(templates[0])}><IconPlus size={16} />Новая форма</Button>
      </div>

      <div className="portal-stats">
        <div><IconArchive size={20} /><span>В архиве<strong>{stats.total}</strong></span></div>
        <div><IconPrinter size={20} /><span>Сегодня<strong>{stats.today}</strong></span></div>
        <div><IconLink size={20} /><span>Прикреплено<strong>{stats.linked}</strong></span></div>
      </div>

      <section className="service-catalog">
        <div className="section-heading"><div><span>Каталог услуг</span><h2>Печатные формы</h2></div></div>
        <div className="service-grid">
          {templates.map((template) => (
            <button key={template.id} className="service-card" onClick={() => openTemplate(template)}>
              <span className="service-icon"><IconFileCertificate size={22} /></span>
              <strong>{template.title}</strong>
              <span>{template.description}</span>
              <small>{template.prefix} · сформировать</small>
            </button>
          ))}
        </div>
      </section>

      <section className="print-archive">
        <div className="section-heading">
          <div><span>Журнал операций</span><h2>Архив печати</h2></div>
          <div className="archive-search"><IconSearch size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Номер, ШК, название или гражданин" /></div>
        </div>
        {!loading && documents.length === 0
          ? <EmptyState title="Документы не найдены" description="Выберите форму из каталога и сформируйте первый документ." />
          : <Table columns={columns} data={documents} keyExtractor={(row) => row.id} loading={loading} />}
      </section>

      <Modal
        open={Boolean(selectedTemplate)}
        onClose={() => setSelectedTemplate(null)}
        title={selectedTemplate?.title ?? 'Новая форма'}
        description="Документ получит официальный номер, ШК и сохранится в архиве СОНАР."
        width={720}
        footer={<><Button variant="secondary" onClick={() => setSelectedTemplate(null)}>Отмена</Button><Button variant="primary" loading={creating} onClick={createDocument}><IconPrinter size={15} />Сформировать</Button></>}
      >
        {selectedTemplate && (
          <div className="form-section-stack">
            <section className="form-section">
              <div className="form-section-heading"><span>01</span><div><strong>Получатель и привязка</strong><small>Документ можно прикрепить к реестровой записи</small></div></div>
              <div className="form-grid">
                <Select label="Гражданин" searchable options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))} value={citizenId} onChange={(e) => { setCitizenId(e.target.value); if (linkType === 'CITIZEN') setLinkId(e.target.value) }} placeholder="Без гражданина" />
                <Select label="Тип привязки" options={[{ value: 'CITIZEN', label: 'Гражданин' }, { value: 'BUILDING', label: 'Объект РЕЛИКТ' }]} value={linkType} onChange={(e) => { setLinkType(e.target.value); setLinkId('') }} />
                <div className="span-2">
                  <Select label="Прикрепить к записи" searchable options={(linkType === 'BUILDING' ? buildings.map((b) => ({ value: b.id, label: `${b.name} (${b.reg_number})` })) : citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` })))} value={linkId} onChange={(e) => {
                    setLinkId(e.target.value)
                    if (linkType === 'BUILDING') {
                      const building = buildings.find((item) => item.id === e.target.value)
                      if (building) setPayload((current) => ({ ...current, building_name: building.name, building_number: building.reg_number }))
                    }
                  }} placeholder="Не прикреплять" />
                </div>
              </div>
            </section>
            <section className="form-section">
              <div className="form-section-heading"><span>02</span><div><strong>Сведения формы</strong><small>Заполните только применимые поля</small></div></div>
              <div className="form-grid">
                {selectedTemplate.fields.map((field) => (
                  <Input key={field} label={FIELD_LABELS[field] ?? field} value={payload[field] ?? ''} onChange={(e) => setPayload({ ...payload, [field]: e.target.value })} />
                ))}
              </div>
            </section>
            {error && <div className="form-error">{error}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
