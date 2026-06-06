import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Case, User } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { formatDate } from '../utils/formatters'

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
  const [loading, setLoading] = useState(true)
  const [judges, setJudges] = useState<User[]>([])

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

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Загрузка...</div>
  }

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
    <div>
      <button
        onClick={() => navigate('/cases')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: 'Inter, sans-serif', marginBottom: '20px', padding: '4px 0' }}
      >
        <IconArrowLeft size={16} /> Судебные дела
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#1B3A6B' }}>{caseData.number}</span>
            <Badge status={caseData.status} />
            {caseData.outcome && <Badge status={caseData.outcome} />}
          </div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0A1628', fontFamily: 'Inter, sans-serif' }}>
            Дело против: {caseData.accused?.nickname ?? '—'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {canManage && caseData.status === 'OPENED' && (
            <Button variant="secondary" size="sm" onClick={handleSetInProgress}>
              В проц��ссе
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" size="sm" onClick={() => setShowJudgeModal(true)}>
              Назначить судью
            </Button>
          )}
          {canClose && caseData.status !== 'CLOSED' && (
            <Button variant="danger" size="sm" onClick={() => setShowCloseModal(true)}>
              Закрыть дело
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <Card style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Обвиняемый</div>
              {caseData.accused ? (
                <Link to={`/citizens/${caseData.accused.id}`} style={{ fontSize: '14px', color: '#4A90D9', fontWeight: 500, textDecoration: 'none' }}>
                  {caseData.accused.nickname}
                </Link>
              ) : <span style={{ fontSize: '14px', color: '#374151' }}>—</span>}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Статья</div>
              <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                {caseData.law ? `${caseData.law.number}: ${caseData.law.title}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Судья</div>
              <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{caseData.judge?.login ?? 'Не назначен'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Дата открытия</div>
              <div style={{ fontSize: '14px', color: '#374151' }}>{formatDate(caseData.opened_at)}</div>
            </div>
            {caseData.closed_at && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Дата закрытия</div>
                <div style={{ fontSize: '14px', color: '#374151' }}>{formatDate(caseData.closed_at)}</div>
              </div>
            )}
            {caseData.verdict_type && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Приговор</div>
                <div style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                  <Badge status={caseData.verdict_type} />
                  {caseData.verdict_amount && (
                    <span style={{ marginLeft: '8px', fontFamily: 'JetBrains Mono, monospace' }}>{caseData.verdict_amount} у.е.</span>
                  )}
                </div>
              </div>
            )}
          </div>
          {caseData.description && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Описание</div>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7', whiteSpace: 'pre-wrap', margin: 0 }}>{caseData.description}</p>
            </div>
          )}
          {caseData.verdict_note && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Примечание к приговору</div>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: 0 }}>{caseData.verdict_note}</p>
            </div>
          )}
        </Card>

        {caseData.punishments && caseData.punishments.length > 0 && (
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Связанные наказания ({caseData.punishments.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {caseData.punishments.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#F8F9FB', borderRadius: '4px', border: '0.5px solid #D0D7E3' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Судья</label>
            <select
              value={selectedJudgeId}
              onChange={(e) => setSelectedJudgeId(e.target.value)}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            >
              <option value="">— Не назначен —</option>
              {judges.map((j) => (
                <option key={j.id} value={j.id}>{j.login}</option>
              ))}
            </select>
          </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Исход *</label>
            <select
              value={closeForm.outcome}
              onChange={(e) => setCloseForm({ ...closeForm, outcome: e.target.value })}
              style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
            >
              <option value="ACQUITTED">Оправдан</option>
              <option value="CONVICTED">Осуждён</option>
            </select>
          </div>
          {closeForm.outcome === 'CONVICTED' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Тип приговора</label>
                <select
                  value={closeForm.verdict_type}
                  onChange={(e) => setCloseForm({ ...closeForm, verdict_type: e.target.value })}
                  style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
                >
                  <option value="">— Не указан —</option>
                  {VERDICT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {closeForm.verdict_type === 'FINE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Сумма штрафа (у.е.)</label>
                  <input
                    type="number"
                    min="0"
                    value={closeForm.verdict_amount}
                    onChange={(e) => setCloseForm({ ...closeForm, verdict_amount: e.target.value })}
                    style={{ height: '36px', padding: '0 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', background: '#FFFFFF', outline: 'none' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Примечание</label>
                <textarea
                  value={closeForm.verdict_note}
                  onChange={(e) => setCloseForm({ ...closeForm, verdict_note: e.target.value })}
                  rows={3}
                  style={{ padding: '8px 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', resize: 'vertical', outline: 'none' }}
                />
              </div>
            </>
          )}
          {closeError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{closeError}</div>}
        </form>
      </Modal>
    </div>
  )
}
