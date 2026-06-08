import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconPrinter, IconSearch, IconTrash } from '@tabler/icons-react'
import { ActionMenu } from '../components/ui/ActionMenu'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { useTimedUnlock } from '../hooks/useTimedUnlock'
import type { DiplomaticState, DiplomaticTreaty } from '../types'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Select } from '../components/ui/Select'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDate } from '../utils/formatters'
import { printPdfPost } from '../utils/pdf'
import { RegistryMark } from '../components/ui/RegistryMark'

const RELATION_OPTIONS = [
  { value: 'ALLIANCE', label: 'Союз' },
  { value: 'NEUTRAL', label: 'Нейтральные' },
  { value: 'TENSION', label: 'Напряжённость' },
  { value: 'WAR', label: 'Война' },
]

const TREATY_TYPE_OPTIONS = [
  { value: 'NON_AGGRESSION', label: 'Пакт о ненападении' },
  { value: 'ALLIANCE', label: 'Союз' },
  { value: 'TRADE', label: 'Торговый' },
  { value: 'OTHER', label: 'Иное' },
]

interface StateForm { name: string; relation_status: string; description: string }
interface TreatyForm { state_id: string; type: string; body: string; signed_at: string; auto_number: boolean; number: string }

const emptyStateForm = (): StateForm => ({ name: '', relation_status: 'NEUTRAL', description: '' })
const emptyTreatyForm = (states: DiplomaticState[]): TreatyForm => ({
  state_id: states[0]?.id ?? '',
  type: 'NON_AGGRESSION',
  body: '',
  signed_at: new Date().toISOString().slice(0, 10),
  auto_number: true,
  number: '',
})

export function DiplomacyPage() {
  const canManage = usePermission('diplomacy.manage')

  const [tab, setTab] = useState<'states' | 'treaties'>('states')
  const [states, setStates] = useState<DiplomaticState[]>([])
  const [treaties, setTreaties] = useState<DiplomaticTreaty[]>([])
  const [loading, setLoading] = useState(true)

  const [showStateModal, setShowStateModal] = useState(false)
  const [showEditStateModal, setShowEditStateModal] = useState(false)
  const [selectedState, setSelectedState] = useState<DiplomaticState | null>(null)
  const [stateForm, setStateForm] = useState<StateForm>(emptyStateForm())
  const [stateLoading, setStateLoading] = useState(false)
  const [stateError, setStateError] = useState<string | null>(null)

  const [showTreatyModal, setShowTreatyModal] = useState(false)
  const [treatyForm, setTreatyForm] = useState<TreatyForm>(emptyTreatyForm([]))
  const [treatyLoading, setTreatyLoading] = useState(false)
  const [treatyError, setTreatyError] = useState<string | null>(null)

  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'state' | 'treaty'; id: string; label: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { unlocked: deleteUnlocked, secondsLeft: deleteCountdown } = useTimedUnlock(Boolean(deleteTarget))

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, tRes] = await Promise.all([
        apiClient.get<DiplomaticState[]>('/diplomacy/states'),
        apiClient.get<DiplomaticTreaty[]>(`/diplomacy/treaties${search ? `?search=${encodeURIComponent(search)}` : ''}`),
      ])
      setStates(sRes.data)
      setTreaties(tRes.data)
    } catch {
      setStates([])
      setTreaties([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateState = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stateForm.name.trim()) { setStateError('Название обязательно'); return }
    setStateLoading(true); setStateError(null)
    try {
      await apiClient.post('/diplomacy/states', { name: stateForm.name, relation_status: stateForm.relation_status, description: stateForm.description || null })
      setShowStateModal(false)
      fetchData()
    } catch (err: unknown) {
      setStateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка')
    } finally {
      setStateLoading(false)
    }
  }

  const handleEditState = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedState) return
    setStateLoading(true); setStateError(null)
    try {
      await apiClient.put(`/diplomacy/states/${selectedState.id}`, { name: stateForm.name, relation_status: stateForm.relation_status, description: stateForm.description || null })
      setShowEditStateModal(false)
      fetchData()
    } catch (err: unknown) {
      setStateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка')
    } finally {
      setStateLoading(false)
    }
  }

  const handleCreateTreaty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!treatyForm.state_id || !treatyForm.body.trim()) { setTreatyError('Государство и текст обязательны'); return }
    setTreatyLoading(true); setTreatyError(null)
    try {
      await apiClient.post('/diplomacy/treaties', {
        state_id: treatyForm.state_id,
        type: treatyForm.type,
        body: treatyForm.body.trim(),
        signed_at: treatyForm.signed_at,
        auto_number: treatyForm.auto_number,
        ...(!treatyForm.auto_number ? { number: treatyForm.number } : {}),
      })
      setShowTreatyModal(false)
      fetchData()
    } catch (err: unknown) {
      setTreatyError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка')
    } finally {
      setTreatyLoading(false)
    }
  }

  const handleDownloadPdf = async (treaty: DiplomaticTreaty) => {
    setPdfLoadingId(treaty.id)
    try {
      await printPdfPost(`/api/diplomacy/treaties/${treaty.id}/pdf`)
    } catch { alert('Ошибка генерации PDF') }
    finally { setPdfLoadingId(null) }
  }

  const RELATION_COLOR: Record<string, string> = {
    ALLIANCE: '#16A34A',
    NEUTRAL: '#6B7280',
    TENSION: '#D97706',
    WAR: '#DC2626',
  }

  const RELATION_LABEL: Record<string, string> = {
    ALLIANCE: 'Союз',
    NEUTRAL: 'Нейтральные',
    TENSION: 'Напряжённость',
    WAR: 'Война',
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const url = deleteTarget.kind === 'state'
        ? `/diplomacy/states/${deleteTarget.id}`
        : `/diplomacy/treaties/${deleteTarget.id}`
      await apiClient.delete(url)
      setDeleteTarget(null)
      fetchData()
    } catch (err: unknown) {
      setDeleteError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка удаления')
    } finally {
      setDeleteLoading(false)
    }
  }

  const treatyColumns: TableColumn<DiplomaticTreaty>[] = [
    { key: 'number', header: 'Номер', width: '110px', render: (row) => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#26342E', fontWeight: 600 }}>{row.number}</span> },
    { key: 'registry_code', header: 'ШК', width: '210px', render: (row) => <RegistryMark code={row.registry_code} compact /> },
    { key: 'state', header: 'Государство', render: (row) => <span style={{ fontWeight: 500, color: '#18211D' }}>{row.state?.name ?? '—'}</span> },
    { key: 'type', header: 'Тип', width: '180px', render: (row) => <Badge status={row.type} /> },
    { key: 'signed_at', header: 'Подписан', width: '120px', render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{formatDate(row.signed_at)}</span> },
    { key: 'status', header: 'Статус', width: '110px', render: (row) => <Badge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      width: '105px',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="secondary" size="sm" loading={pdfLoadingId === row.id} onClick={(e) => { e.stopPropagation(); handleDownloadPdf(row) }} title="Сформировать договор">
            <IconPrinter size={14} /> Сформировать
          </Button>
          {canManage && (
            <ActionMenu items={[
              { label: 'Удалить договор', icon: <IconTrash size={15} />, danger: true, onClick: () => { setDeleteError(null); setDeleteTarget({ kind: 'treaty', id: row.id, label: row.number }) } },
            ]} />
          )}
        </div>
      ),
    },
  ]

  const StateFormContent = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleEditState : handleCreateState} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label="Название *" value={stateForm.name} onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })} />
      <Select label="Отношения" options={RELATION_OPTIONS} value={stateForm.relation_status} onChange={(e) => setStateForm({ ...stateForm, relation_status: e.target.value })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Описание</label>
        <textarea value={stateForm.description} onChange={(e) => setStateForm({ ...stateForm, description: e.target.value })} rows={3} style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }} />
      </div>
      {stateError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{stateError}</div>}
    </form>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#18211D', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>Дипломатия</h1>
        {canManage && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {tab === 'states' && (
              <Button variant="primary" size="sm" onClick={() => { setStateForm(emptyStateForm()); setStateError(null); setShowStateModal(true) }}>
                <IconPlus size={14} />Добавить государство
              </Button>
            )}
            {tab === 'treaties' && (
              <Button variant="primary" size="sm" onClick={() => { setTreatyForm(emptyTreatyForm(states)); setTreatyError(null); setShowTreatyModal(true) }}>
                <IconPlus size={14} />Создать договор
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="page-tabs" role="tablist">
        {(['states', 'treaties'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'states' ? 'Государства' : 'Договоры'}
          </button>
        ))}
      </div>

      {tab === 'treaties' && (
        <div style={{ position: 'relative', width: 'min(380px, 100%)', marginBottom: 16 }}>
          <IconSearch size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="registry-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Государство, номер, ШК или текст..." />
        </div>
      )}

      {tab === 'states' && (
        loading ? (
          <div className="load-state"><Spinner /><span>Загрузка…</span></div>
        ) : states.length === 0 ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
            <EmptyState title="Государства не найдены" description="Добавьте первое государство" action={canManage ? <Button variant="primary" size="sm" onClick={() => { setStateForm(emptyStateForm()); setShowStateModal(true) }}><IconPlus size={14} />Добавить</Button> : undefined} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {states.map((s) => (
              <div key={s.id} style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px', padding: '16px 20px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#18211D' }}>{s.name}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 500, background: (RELATION_COLOR[s.relation_status] ?? '#6B7280') + '1A', color: RELATION_COLOR[s.relation_status] ?? '#6B7280', border: `1px solid ${(RELATION_COLOR[s.relation_status] ?? '#6B7280')}33` }}>
                    {RELATION_LABEL[s.relation_status] ?? s.relation_status}
                  </span>
                </div>
                {s.description && <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px 0', lineHeight: '1.5' }}>{s.description}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {canManage && (
                    <Button variant="secondary" size="sm" onClick={() => { setSelectedState(s); setStateForm({ name: s.name, relation_status: s.relation_status, description: s.description ?? '' }); setStateError(null); setShowEditStateModal(true) }}>
                      Изменить
                    </Button>
                  )}
                  {canManage && (
                    <ActionMenu align="left" items={[
                      { label: 'Удалить государство', icon: <IconTrash size={15} />, danger: true, onClick: () => { setDeleteError(null); setDeleteTarget({ kind: 'state', id: s.id, label: s.name }) } },
                    ]} />
                  )}
                  <span style={{ fontSize: '12px', color: '#9CA3AF', alignSelf: 'center' }}>
                    {(s.treaties?.length ?? 0)} договоров
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'treaties' && (
        treaties.length === 0 && !loading ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
            <EmptyState title="Договоры не найдены" description="Создайте первый договор" action={canManage ? <Button variant="primary" size="sm" onClick={() => { setTreatyForm(emptyTreatyForm(states)); setShowTreatyModal(true) }}><IconPlus size={14} />Создать</Button> : undefined} />
          </div>
        ) : (
          <Table columns={treatyColumns} data={treaties} keyExtractor={(row) => row.id} loading={loading} />
        )
      )}

      <Modal open={showStateModal} onClose={() => setShowStateModal(false)} title="Добавить государство"
        footer={<><Button variant="secondary" onClick={() => setShowStateModal(false)}>Отмена</Button><Button variant="primary" loading={stateLoading} onClick={handleCreateState}>Создать</Button></>}
      >{StateFormContent(false)}</Modal>

      <Modal open={showEditStateModal} onClose={() => setShowEditStateModal(false)} title="Редактировать государство"
        footer={<><Button variant="secondary" onClick={() => setShowEditStateModal(false)}>Отмена</Button><Button variant="primary" loading={stateLoading} onClick={handleEditState}>Сохранить</Button></>}
      >{StateFormContent(true)}</Modal>

      <Modal open={showTreatyModal} onClose={() => setShowTreatyModal(false)} title="Создать международный договор" description="Документ будет зарегистрирован в едином реестре СОНАР" width={680}
        footer={<><Button variant="secondary" onClick={() => setShowTreatyModal(false)}>Отмена</Button><Button variant="primary" loading={treatyLoading} onClick={handleCreateTreaty}>Создать</Button></>}
      >
        <form onSubmit={handleCreateTreaty}>
          <section className="form-section">
            <div className="form-section-heading"><div><strong>Регистрация договора</strong><span>Автоматический номер защищает реестр от дубликатов</span></div></div>
            <div className="number-mode">
              <button type="button" className={treatyForm.auto_number ? 'is-active' : ''} onClick={() => setTreatyForm({ ...treatyForm, auto_number: true, number: '' })}>Автоматический номер</button>
              <button type="button" className={!treatyForm.auto_number ? 'is-active' : ''} onClick={() => setTreatyForm({ ...treatyForm, auto_number: false })}>Указать вручную</button>
            </div>
            {treatyForm.auto_number ? (
              <div className="document-preview">Формат номера: <strong>ДПЛ-{new Date(treatyForm.signed_at || Date.now()).getFullYear()}-0001</strong> · ШК будет создан автоматически</div>
            ) : (
              <div style={{ marginTop: 12 }}><Input label="Регистрационный номер *" value={treatyForm.number} onChange={(e) => setTreatyForm({ ...treatyForm, number: e.target.value })} placeholder="Например: ДПЛ-2026-0012" /></div>
            )}
          </section>
          <section className="form-section">
            <div className="form-section-heading"><div><strong>Стороны и реквизиты</strong><span>Партнёр, вид договора и дата подписания</span></div></div>
            <div className="form-grid">
              <Select label="Государство *" options={states.map((s) => ({ value: s.id, label: s.name }))} placeholder="— Выберите —" value={treatyForm.state_id} onChange={(e) => setTreatyForm({ ...treatyForm, state_id: e.target.value })} />
              <Select label="Тип договора *" options={TREATY_TYPE_OPTIONS} value={treatyForm.type} onChange={(e) => setTreatyForm({ ...treatyForm, type: e.target.value })} />
              <div className="span-2"><Input label="Дата подписания *" type="date" value={treatyForm.signed_at} onChange={(e) => setTreatyForm({ ...treatyForm, signed_at: e.target.value })} /></div>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-heading"><div><strong>Текст договора</strong><span>Полный текст согласованных обязательств</span></div></div>
            <textarea className="document-textarea" value={treatyForm.body} onChange={(e) => setTreatyForm({ ...treatyForm, body: e.target.value })} rows={9} placeholder="Введите текст договора..." />
          </section>
          {treatyError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{treatyError}</div>}
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Подтвердите удаление" description="Удалённая запись не сможет быть восстановлена"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="danger" disabled={!deleteUnlocked} loading={deleteLoading} onClick={handleDelete}>{deleteUnlocked ? 'Удалить' : `Подождите ${deleteCountdown}с`}</Button></>}
      >
        <div className="danger-confirm">Вы собираетесь удалить {deleteTarget?.kind === 'state' ? 'государство' : 'договор'} <strong>{deleteTarget?.label}</strong>. Государство со связанными договорами удалить нельзя.</div>
        {deleteError && <div className="form-error">{deleteError}</div>}
      </Modal>
    </div>
  )
}
