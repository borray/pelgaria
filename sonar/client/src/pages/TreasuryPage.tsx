import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconMinus } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Treasury, TreasuryTransaction } from '../types'
import { Button } from '../components/ui/Button'
import { Table, type TableColumn } from '../components/ui/Table'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatDateTime } from '../utils/formatters'

export function TreasuryPage() {
  const canEdit = usePermission('treasury.edit')

  const [treasury, setTreasury] = useState<Treasury | null>(null)
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'add' | 'subtract'>('add')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [opLoading, setOpLoading] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)

  const fetchTreasury = useCallback(async () => {
    try {
      const res = await apiClient.get<Treasury>('/treasury')
      setTreasury(res.data)
    } catch { setTreasury(null) }
  }, [])

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const res = await apiClient.get<{ transactions: TreasuryTransaction[]; total: number }>(
        `/treasury/transactions?limit=${limit}&offset=${offset}`
      )
      setTransactions(res.data.transactions)
      setTotal(res.data.total)
    } catch {
      setTransactions([])
    } finally {
      setTxLoading(false)
    }
  }, [offset])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchTreasury(), fetchTransactions()]).finally(() => setLoading(false))
  }, [fetchTreasury, fetchTransactions])

  const openModal = (type: 'add' | 'subtract') => {
    setModalType(type)
    setAmount('')
    setDescription('')
    setOpError(null)
    setShowModal(true)
  }

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setOpError('Введите корректную сумму')
      return
    }
    if (!description.trim()) {
      setOpError('Описание обязательно')
      return
    }
    setOpLoading(true)
    setOpError(null)
    try {
      const finalAmount = modalType === 'subtract' ? -numAmount : numAmount
      await apiClient.post('/treasury/transactions', {
        amount: finalAmount,
        description: description.trim(),
      })
      setShowModal(false)
      fetchTreasury()
      fetchTransactions()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка операции'
      setOpError(msg)
    } finally {
      setOpLoading(false)
    }
  }

  const columns: TableColumn<TreasuryTransaction>[] = [
    {
      key: 'created_at',
      header: 'Дата',
      width: '160px',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'description',
      header: 'Описание',
      render: (row) => <span style={{ fontSize: '14px', color: '#374151' }}>{row.description}</span>,
    },
    {
      key: 'performed_by',
      header: 'Кто провёл',
      width: '140px',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.performed_by?.login ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Сумма',
      width: '140px',
      render: (row) => (
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '14px',
            fontWeight: 700,
            color: row.amount >= 0 ? '#16A34A' : '#DC2626',
          }}
        >
          {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString('ru-RU')} у.е.
        </span>
      ),
    },
  ]

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Загрузка...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0A1628', fontFamily: 'Inter, sans-serif' }}>Казна</h1>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => openModal('subtract')}>
              <IconMinus size={16} />
              Списать
            </Button>
            <Button variant="primary" onClick={() => openModal('add')}>
              <IconPlus size={16} />
              Пополнить
            </Button>
          </div>
        )}
      </div>

      <div style={{ background: '#0A1628', borderRadius: '8px', padding: '32px 36px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Текущий баланс
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '40px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.02em' }}>
            {(treasury?.balance ?? 0).toLocaleString('ru-RU')} <span style={{ fontSize: '20px', opacity: 0.6 }}>у.е.</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Транзакций
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            {total}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0A1628', fontFamily: 'Inter, sans-serif', margin: '0 0 12px 0' }}>
          История транзакций
        </h2>
        <Table
          columns={columns}
          data={transactions}
          keyExtractor={(row) => row.id}
          loading={txLoading}
        />
        {total > limit && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Назад
            </Button>
            <span style={{ fontSize: '13px', color: '#6B7280', alignSelf: 'center', fontFamily: 'Inter, sans-serif' }}>
              {offset + 1}–{Math.min(offset + limit, total)} из {total}
            </span>
            <Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
              Вперёд
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={modalType === 'add' ? 'Пополнить казну' : 'Списать из казны'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Отмена</Button>
            <Button variant={modalType === 'add' ? 'primary' : 'danger'} loading={opLoading} onClick={handleTransaction}>
              {modalType === 'add' ? 'Пополнить' : 'Списать'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Сумма (у.е.) *"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <Input
            label="Описание *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {opError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{opError}</div>}
        </form>
      </Modal>
    </div>
  )
}
