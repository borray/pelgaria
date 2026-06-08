import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconArchive,
  IconFileCertificate,
  IconLink,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconFileDownload,
  IconTestPipe,
  IconScan,
  IconFlame,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import type { Building, Citizen, GeneratedDocument, PrinterTestSheet } from '../types'
import { usePermission } from '../hooks/usePermission'
import { useTimedUnlock } from '../hooks/useTimedUnlock'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Table, type TableColumn } from '../components/ui/Table'
import { RegistryMark } from '../components/ui/RegistryMark'
import { EmptyState } from '../components/ui/EmptyState'
import { ActionMenu } from '../components/ui/ActionMenu'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, formatDateTime } from '../utils/formatters'
import { confirmDocumentFormation, printPdf } from '../utils/pdf'

interface FormTemplate {
  id: string
  title: string
  description: string
  prefix: string
  fields: string[]
}

const FIELD_LABELS: Record<string, string> = {
  request_subject: 'Предмет обращения',
  request_text: 'Просьба / содержание',
  attachments_list: 'Перечень приложений',
  contact: 'Контакт для ответа',
  complaint_subject: 'Обжалуемое решение или действие',
  circumstances: 'Обстоятельства',
  deadline: 'Срок исполнения',
  coordinates: 'Координаты объекта',
  work_scope: 'Состав работ',
  conditions: 'Особые условия',
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

const LONG_FIELDS = new Set([
  'basis',
  'comment',
  'request_text',
  'attachments_list',
  'circumstances',
  'work_scope',
  'conditions',
])

export function PrintCenterPage() {
  const canAdmin = usePermission('accounts.manage')
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
  const [deleteTarget, setDeleteTarget] = useState<GeneratedDocument | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { unlocked: deleteUnlocked, secondsLeft: deleteCountdown } = useTimedUnlock(Boolean(deleteTarget))

  const [testSheets, setTestSheets] = useState<PrinterTestSheet[]>([])
  const [testLoading, setTestLoading] = useState(false)
  const [creatingTest, setCreatingTest] = useState(false)
  const [destroyTarget, setDestroyTarget] = useState<PrinterTestSheet | null>(null)
  const [destroyLoading, setDestroyLoading] = useState(false)
  const [destroyError, setDestroyError] = useState<string | null>(null)
  const { unlocked: destroyUnlocked, secondsLeft: destroyCountdown } = useTimedUnlock(Boolean(destroyTarget))

  const fetchTestSheets = useCallback(async () => {
    setTestLoading(true)
    try {
      const res = await apiClient.get<PrinterTestSheet[]>('/print-center/test-sheets')
      setTestSheets(res.data)
    } catch {
      setTestSheets([])
    } finally {
      setTestLoading(false)
    }
  }, [])

  useEffect(() => { fetchTestSheets() }, [fetchTestSheets])

  const runPrintTest = async () => {
    setCreatingTest(true)
    try {
      const res = await apiClient.post<PrinterTestSheet>('/print-center/test-sheets', {})
      await fetchTestSheets()
      await printPdf(`/api/print-center/test-sheets/${res.data.id}/pdf`, true)
    } catch {
      // ignore; список обновится при следующем заходе
    } finally {
      setCreatingTest(false)
    }
  }

  const handleDestroy = async () => {
    if (!destroyTarget) return
    setDestroyLoading(true)
    setDestroyError(null)
    try {
      await apiClient.delete(`/print-center/test-sheets/${destroyTarget.id}`)
      setDestroyTarget(null)
      await fetchTestSheets()
    } catch (err: unknown) {
      setDestroyError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось уничтожить лист')
    } finally {
      setDestroyLoading(false)
    }
  }

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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/print-center/documents/${deleteTarget.id}`)
      setDeleteTarget(null)
      await fetchDocuments()
    } catch (err: unknown) {
      setDeleteError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка удаления')
    } finally {
      setDeleteLoading(false)
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
    { key: 'actions', header: '', width: '180px', render: (row) => (
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" title="Сформировать документ" onClick={(e) => { e.stopPropagation(); printPdf(`/api/print-center/documents/${row.id}/pdf`) }}><IconPrinter size={15} />Сформировать</Button>
        {canAdmin && (
          <ActionMenu items={[
            { label: 'Удалить документ', icon: <IconTrash size={15} />, danger: true, onClick: () => { setDeleteError(null); setDeleteTarget(row) } },
          ]} />
        )}
      </div>
    ) },
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
            <div key={template.id} className="service-card">
              <button className="service-card-main" onClick={() => openTemplate(template)}>
                <span className="service-icon"><IconFileCertificate size={22} /></span>
                <strong>{template.title}</strong>
                <span className="service-desc">{template.description}</span>
              </button>
              <div className="service-card-actions">
                <button className="service-card-action" onClick={() => openTemplate(template)}>
                  <IconPlus size={13} /> Заполнить
                </button>
                <button
                  className="service-card-action is-ghost"
                  onClick={() => printPdf(`/api/print-center/templates/${template.id}/blank-pdf`)}
                  title="Напечатать пустой бланк для заполнения вручную"
                >
                  <IconFileDownload size={13} /> Бланк
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="service-catalog test-station">
        <div className="section-heading">
          <div><span>Контроль оборудования</span><h2>Проверка станции печати</h2></div>
          {canAdmin && (
            <Button variant="primary" loading={creatingTest} onClick={runPrintTest}>
              <IconTestPipe size={16} /> Печатать пробный лист
            </Button>
          )}
        </div>
        <div className="test-station-info">
          <span className="test-station-icon"><IconScan size={20} /></span>
          <p>
            Пробный лист содержит гильоши, штрих-коды, реперные квадраты по краям, шкалу плотности,
            цветовые плашки и микротекст для калибровки печати и контроля защитных элементов.
            Все пробные листы хранятся в отдельной мини-базе и <strong>подлежат обязательному уничтожению</strong> после проверки.
          </p>
        </div>
        <div className="test-sheet-list">
          {testLoading ? (
            <div className="load-state"><Spinner /><span>Загрузка пробных листов…</span></div>
          ) : testSheets.length === 0 ? (
            <EmptyState title="Пробных листов нет" description="Распечатайте пробный лист, чтобы проверить станцию печати." />
          ) : (
            testSheets.map((sheet) => (
              <div key={sheet.id} className="test-sheet-row">
                <span className="test-sheet-icon"><IconTestPipe size={17} /></span>
                <div className="test-sheet-meta">
                  <strong>{sheet.number}</strong>
                  <RegistryMark code={sheet.registry_code} compact />
                </div>
                <span className="test-sheet-when">{formatDateTime(sheet.created_at)} · {sheet.created_by_login}</span>
                <div className="test-sheet-actions">
                  <Button variant="secondary" size="sm" title="Печать пробного листа" onClick={() => printPdf(`/api/print-center/test-sheets/${sheet.id}/pdf`)}><IconPrinter size={14} /></Button>
                  {canAdmin && (
                    <ActionMenu items={[
                      { label: 'Уничтожить лист', icon: <IconFlame size={15} />, danger: true, onClick: () => { setDestroyError(null); setDestroyTarget(sheet) } },
                    ]} />
                  )}
                </div>
              </div>
            ))
          )}
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
                {selectedTemplate.fields.map((field) => LONG_FIELDS.has(field) ? (
                  <div className="span-2" key={field}>
                    <label className="office-textarea-label">{FIELD_LABELS[field] ?? field}</label>
                    <textarea className="document-textarea" rows={4} value={payload[field] ?? ''} onChange={(e) => setPayload({ ...payload, [field]: e.target.value })} />
                  </div>
                ) : (
                  <Input key={field} label={FIELD_LABELS[field] ?? field} value={payload[field] ?? ''} onChange={(e) => setPayload({ ...payload, [field]: e.target.value })} />
                ))}
              </div>
            </section>
            {error && <div className="form-error">{error}</div>}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить документ"
        description="Документ будет безвозвратно удалён из архива СОНАР."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button variant="danger" disabled={!deleteUnlocked} loading={deleteLoading} onClick={handleDelete}>
              {deleteUnlocked ? 'Удалить документ' : `Подождите ${deleteCountdown}с`}
            </Button>
          </>
        }
      >
        <div className="danger-confirm">
          Документ <strong>{deleteTarget?.number}</strong> «{deleteTarget?.title}» будет удалён. Восстановление невозможно.
        </div>
        {deleteError && <div className="form-error">{deleteError}</div>}
      </Modal>

      <Modal
        open={Boolean(destroyTarget)}
        onClose={() => setDestroyTarget(null)}
        title="Уничтожить пробный лист"
        description="Запись будет стёрта из мини-базы пробных листов без возможности восстановления."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDestroyTarget(null)}>Отмена</Button>
            <Button variant="danger" disabled={!destroyUnlocked} loading={destroyLoading} onClick={handleDestroy}>
              <IconFlame size={15} />
              {destroyUnlocked ? 'Подтвердить уничтожение' : `Подождите ${destroyCountdown}с`}
            </Button>
          </>
        }
      >
        <div className="danger-confirm">
          Пробный лист <strong>{destroyTarget?.number}</strong> ({destroyTarget?.registry_code}) будет уничтожен и удалён из мини-базы. Убедитесь, что бумажный образец также уничтожен.
        </div>
        {destroyError && <div className="form-error">{destroyError}</div>}
      </Modal>
    </div>
  )
}
