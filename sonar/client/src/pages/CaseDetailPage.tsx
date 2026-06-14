import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { IconArrowLeft, IconGavel, IconPrinter, IconScale, IconTrash, IconUser } from '@tabler/icons-react'
import { ActionMenu } from '../components/ui/ActionMenu'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Case, User } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { useTimedUnlock } from '../hooks/useTimedUnlock'
import { useTypeConfirm } from '../hooks/useTypeConfirm'
import { formatDate } from '../utils/formatters'
import { printPdfPost } from '../utils/pdf'

const VERDICT_TYPE_OPTIONS = [
  { value: 'WARNING', label: 'Предупреждение' },
  { value: 'FINE', label: 'Штраф' },
  { value: 'EXILE', label: 'Изгнание' },
  { value: 'OTHER', label: 'Иное' },
]

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canManage = usePermission('cases.manage')
  const canClose = usePermission('cases.close')

  const [caseData, setCaseData] = useState<Case | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { unlocked: deleteUnlocked, secondsLeft: deleteCountdown } = useTimedUnlock(showDeleteModal, 6)
  const deleteConfirm = useTypeConfirm(caseData?.number ?? '', showDeleteModal)
  const [loading, setLoading] = useState(true)
  const [judges, setJudges] = useState<User[]>([])

  const [pdfLoading, setPdfLoading] = useState(false)

  const handleDownloadPdf = async () => {
    if (!id) return
    setPdfLoading(true)
    try {
      await printPdfPost(`/api/cases/${id}/pdf`)
    } catch {
      alert('Ошибка генерации PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const [showJudgeModal, setShowJudgeModal] = useState(false)
  const [selectedJudgeId, setSelectedJudgeId] = useState('')
  const [judgeLoading, setJudgeLoading] = useState(false)

  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeForm, setCloseForm] = useState({
    outcome: 'ACQUITTED',
    verdict_type: '',
    verdict_amount: '',
    verdict_note: '',
  })
  const [closeLoading, setCloseLoading] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiClient.get<Case>(`/cases/${id}`)
      .then((r) => {
        setCaseData(r.data)
        setSelectedJudgeId(r.data.judge_id ?? '')
      })
      .catch(() => setCaseData(null))
      .finally(() => setLoading(false))

    apiClient.get<User[]>('/accounts')
      .then((r) => setJudges(r.data))
      .catch(() => setJudges([]))
  }, [id])

  const handleAssignJudge = async (e: React.FormEvent) => {
    e.preventDefault()
    setJudgeLoading(true)
    try {
      const res = await apiClient.put<Case>(`/cases/${id}`, { judge_id: selectedJudgeId || null })
      setCaseData(res.data)
      setShowJudgeModal(false)
    } catch {
      alert('Ошибка назначения судьи')
    } finally {
      setJudgeLoading(false)
    }
  }

  const handleSetInProgress = async () => {
    try {
      const res = await apiClient.put<Case>(`/cases/${id}`, { status: 'IN_PROGRESS' })
      setCaseData(res.data)
    } catch {
      alert('Ошибка изменения статуса')
    }
  }

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault()
    setCloseLoading(true)
    setCloseError(null)
    try {
      const res = await apiClient.post<Case>(`/cases/${id}/close`, {
        outcome: closeForm.outcome,
        verdict_type: closeForm.verdict_type || null,
        verdict_amount: closeForm.verdict_amount ? Number(closeForm.verdict_amount) : null,
        verdict_note: closeForm.verdict_note || null,
      })
      setCaseData(res.data)
      setShowCloseModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка закрытия'
      setCloseError(msg)
    } finally {
      setCloseLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!caseData) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/cases/${caseData.id}`)
      navigate('/cases')
    } catch (err: unknown) {
      setDeleteError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка удаления')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner /></div>

  if (!caseData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Дело не найдено</p>
        <Button variant="secondary" onClick={() => navigate('/cases')} style={{ marginTop: '16px' }}>
          <IconArrowLeft size={16} /> Назад
        </Button>
      </div>
    )
  }

  return (
    <div className="case-record-page">
      <header className="record-commandbar">
        <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}>
          <IconArrowLeft size={14} /> К реестру дел
        </Button>
        <div className="record-commandbar-context"><span>Судебное производство</span><i /></div>
        <div className="record-commandbar-actions">
          {canManage && caseData.status === 'OPENED' && (
            <Button variant="secondary" size="sm" onClick={handleSetInProgress}>
              Начать производство
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" size="sm" onClick={() => setShowJudgeModal(true)}>
              Назначить судью
            </Button>
          )}
          {caseData.status === 'CLOSED' && (
            <Button variant="secondary" size="sm" loading={pdfLoading} onClick={handleDownloadPdf}>
              <IconPrinter size={16} />
              Сформировать приговор
            </Button>
          )}
          {canClose && caseData.status !== 'CLOSED' && (
            <Button variant="danger" size="sm" onClick={() => setShowCloseModal(true)}>
              Закрыть дело
            </Button>
          )}
          {canManage && (
            <ActionMenu items={[
              { label: 'Стереть дело навсегда', icon: <IconTrash size={15} />, danger: true, onClick: () => { setDeleteError(null); setShowDeleteModal(true) } },
            ]} />
          )}
        </div>
      </header>

      <section className="case-identity">
        <div className="case-identity-symbol"><IconGavel size={32} /></div>
        <div className="case-identity-copy">
          <span>Судебное дело · {caseData.number}</span>
          <h1>Государство против {caseData.accused?.nickname ?? 'неустановленного лица'}</h1>
          <div><Badge status={caseData.status} />{caseData.outcome && <Badge status={caseData.outcome} />}</div>
        </div>
        <div className="case-identity-number"><small>Номер производства</small><strong>{caseData.number}</strong><span>СОНАР / Правосудие</span></div>
      </section>

      <div className="case-record-layout">
        <section className="case-material">
          <header><span>Материалы производства</span><h2>Содержание дела</h2></header>
          <div className="case-description">
            <span>Описание обстоятельств</span>
            <p>{caseData.description || 'Описание обстоятельств не указано.'}</p>
          </div>
          {caseData.verdict_note && (
            <div className="case-verdict-note">
              <span>Резолютивная часть</span>
              <p>{caseData.verdict_note}</p>
            </div>
          )}
        </section>

        <aside className="case-facts-panel">
          <header><span>Реквизиты дела</span><IconScale size={18} /></header>
          <div>
            <article><IconUser size={16} /><span>Обвиняемый</span>{caseData.accused ? <Link to={`/citizens/${caseData.accused.id}`}>{caseData.accused.nickname}</Link> : <strong>Не указан</strong>}</article>
            <article><IconScale size={16} /><span>Правовое основание</span><strong>{caseData.law ? `${caseData.law.number}: ${caseData.law.title}` : 'Не указано'}</strong></article>
            <article><IconGavel size={16} /><span>Судья</span><strong>{caseData.judge?.login ?? 'Не назначен'}</strong></article>
            <article><span className="case-fact-index">01</span><span>Открыто</span><strong>{formatDate(caseData.opened_at)}</strong></article>
            {caseData.closed_at && <article><span className="case-fact-index">02</span><span>Закрыто</span><strong>{formatDate(caseData.closed_at)}</strong></article>}
            {caseData.verdict_type && <article><IconGavel size={16} /><span>Приговор</span><strong><Badge status={caseData.verdict_type} />{caseData.verdict_amount ? ` · ${caseData.verdict_amount} у.е.` : ''}</strong></article>}
          </div>
        </aside>
      </div>

      <div className="case-related">
        {caseData.punishments && caseData.punishments.length > 0 && (
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Связанные наказания ({caseData.punishments.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {caseData.punishments.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#F8F9FB', borderRadius: '4px', border: '0.5px solid #CDD5D1' }}>
                  <Badge status={p.type} />
                  <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>{p.reason}</span>
                  <Badge status={p.status} />
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{formatDate(p.issued_at)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={showJudgeModal}
        onClose={() => setShowJudgeModal(false)}
        title="Назначить судью"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowJudgeModal(false)}>Отмена</Button>
            <Button variant="primary" loading={judgeLoading} onClick={handleAssignJudge}>Назначить</Button>
          </>
        }
      >
        <form onSubmit={handleAssignJudge} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Select
            label="Судья"
            options={judges.map((j) => ({ value: j.id, label: j.login }))}
            placeholder="— Не назначен —"
            value={selectedJudgeId}
            onChange={(e) => setSelectedJudgeId(e.target.value)}
            searchable
          />
        </form>
      </Modal>

      <Modal
        open={showCloseModal}
        onClose={() => { setShowCloseModal(false); setCloseError(null) }}
        title="Закрыть дело"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCloseModal(false)}>Отмена</Button>
            <Button variant="primary" loading={closeLoading} onClick={handleClose}>Закрыть</Button>
          </>
        }
      >
        <form onSubmit={handleClose} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Исход *"
            options={[
              { value: 'ACQUITTED', label: 'Оправдан' },
              { value: 'CONVICTED', label: 'Осуждён' },
            ]}
            value={closeForm.outcome}
            onChange={(e) => setCloseForm({ ...closeForm, outcome: e.target.value })}
          />
          {closeForm.outcome === 'CONVICTED' && (
            <>
              <Select
                label="Тип приговора"
                options={VERDICT_TYPE_OPTIONS}
                placeholder="— Не указан —"
                value={closeForm.verdict_type}
                onChange={(e) => setCloseForm({ ...closeForm, verdict_type: e.target.value })}
              />
              {closeForm.verdict_type === 'FINE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Сумма штрафа (у.е.)</label>
                  <input
                    type="number"
                    min="0"
                    value={closeForm.verdict_amount}
                    onChange={(e) => setCloseForm({ ...closeForm, verdict_amount: e.target.value })}
                    style={{ height: '36px', padding: '0 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Примечание</label>
                <textarea
                  value={closeForm.verdict_note}
                  onChange={(e) => setCloseForm({ ...closeForm, verdict_note: e.target.value })}
                  rows={3}
                  style={{ padding: '8px 10px', border: '1px solid #CDD5D1', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
                />
              </div>
            </>
          )}
          {closeError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{closeError}</div>}
        </form>
      </Modal>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Удалить судебное дело"
        description="Дело, наказания и все связанные записи будут стёрты без возможности восстановления."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={!deleteUnlocked || !deleteConfirm.confirmed}
              loading={deleteLoading}
              onClick={handleDelete}
            >
              {!deleteUnlocked ? `Подождите ${deleteCountdown}с` : 'Стереть навсегда'}
            </Button>
          </>
        }
      >
        <div className="danger-confirm" style={{ marginBottom: '14px' }}>
          Дело <strong>{caseData?.number}</strong> против <strong>{caseData?.accused?.nickname}</strong> будет уничтожено навсегда. Это действие невозможно отменить.
        </div>
        <Input
          label={`Введите номер дела «${caseData?.number}» для подтверждения`}
          value={deleteConfirm.value}
          onChange={deleteConfirm.onChange}
          placeholder={caseData?.number}
        />
        {deleteError && <div className="form-error" style={{ marginTop: '10px' }}>{deleteError}</div>}
      </Modal>
    </div>
  )
}
