import React, { useState, useEffect, useCallback } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { ActionMenu } from '../components/ui/ActionMenu'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { useTimedUnlock } from '../hooks/useTimedUnlock'
import { useTypeConfirm } from '../hooks/useTypeConfirm'
import type { User, Role, Citizen } from '../types'
import { Button } from '../components/ui/Button'
import { Table, type TableColumn } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDateTime } from '../utils/formatters'
import { PageHeader } from '../components/ui/PageHeader'

interface CreateForm {
  login: string
  password: string
  role_id: string
  citizen_id: string
}

interface EditForm {
  role_id: string
  citizen_id: string
}

export function AccountsPage() {
  const canManage = usePermission('accounts.manage')

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [citizens, setCitizens] = useState<Citizen[]>([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>({ login: '', password: '', role_id: '', citizen_id: '' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ role_id: '', citizen_id: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [showResetModal, setShowResetModal] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const [blockLoadingId, setBlockLoadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { unlocked: deleteUnlocked, secondsLeft: deleteCountdown } = useTimedUnlock(Boolean(deleteTarget), 7)
  const deleteConfirm = useTypeConfirm(deleteTarget?.login ?? '', Boolean(deleteTarget))

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/accounts/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchUsers()
    } catch (err: unknown) {
      setDeleteError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка удаления')
    } finally {
      setDeleteLoading(false)
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<User[]>('/accounts')
      setUsers(res.data)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    apiClient.get<Role[]>('/roles').then((r) => setRoles(r.data)).catch(() => {})
    apiClient.get<Citizen[]>('/citizens').then((r) => setCitizens(r.data)).catch(() => {})
  }, [fetchUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.login.trim() || !createForm.password || !createForm.role_id) {
      setCreateError('Логин, пароль и роль обязательны')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      await apiClient.post('/accounts', {
        login: createForm.login.trim(),
        password: createForm.password,
        role_id: createForm.role_id,
        citizen_id: createForm.citizen_id || null,
      })
      setShowCreateModal(false)
      setCreateForm({ login: '', password: '', role_id: '', citizen_id: '' })
      fetchUsers()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setCreateError(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const openEditModal = (u: User) => {
    setSelectedUser(u)
    setEditForm({ role_id: u.role_id, citizen_id: u.citizen_id ?? '' })
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setEditLoading(true)
    setEditError(null)
    try {
      await apiClient.put(`/accounts/${selectedUser.id}`, {
        role_id: editForm.role_id,
        citizen_id: editForm.citizen_id || null,
      })
      setShowEditModal(false)
      fetchUsers()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setEditError(msg)
    } finally {
      setEditLoading(false)
    }
  }

  const handleBlock = async (u: User) => {
    setBlockLoadingId(u.id)
    try {
      await apiClient.post(`/accounts/${u.id}/block`, {})
      fetchUsers()
    } catch {
      alert('Ошибка')
    } finally {
      setBlockLoadingId(null)
    }
  }

  const openResetModal = (u: User) => {
    setSelectedUser(u)
    setResetPassword('')
    setResetError(null)
    setShowResetModal(true)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Пароль должен быть не менее 6 символов')
      return
    }
    setResetLoading(true)
    setResetError(null)
    try {
      await apiClient.post(`/accounts/${selectedUser.id}/reset-password`, { newPassword: resetPassword })
      setShowResetModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка'
      setResetError(msg)
    } finally {
      setResetLoading(false)
    }
  }

  const columns: TableColumn<User>[] = [
    {
      key: 'login',
      header: 'Логин',
      render: (row) => <span style={{ fontWeight: 500, color: '#18211D', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>{row.login}</span>,
    },
    {
      key: 'role',
      header: 'Роль',
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.role.color, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#374151' }}>{row.role.name}</span>
        </span>
      ),
    },
    {
      key: 'citizen',
      header: 'Игровая карточка',
      render: (row) => (
        <span style={{ fontSize: '13px', color: '#6B7280' }}>
          {row.citizen ? `${row.citizen.nickname} (${row.citizen.reg_number})` : '—'}
        </span>
      ),
    },
    {
      key: 'last_login_at',
      header: 'Последний вход',
      render: (row) => <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.last_login_at ? formatDateTime(row.last_login_at) : '—'}</span>,
    },
    {
      key: 'is_active',
      header: 'Статус',
      width: '100px',
      render: (row) => <Badge status={row.is_active ? 'ACTIVE' : 'BANNED'} label={row.is_active ? 'Активен' : 'Заблокирован'} />,
    },
    {
      key: 'actions',
      header: '',
      width: '200px',
      render: (row) => (
        canManage ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); openEditModal(row) }}>
              Изменить
            </Button>
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); openResetModal(row) }}>
              Пароль
            </Button>
            <Button
              variant={row.is_active ? 'danger' : 'secondary'}
              size="sm"
              loading={blockLoadingId === row.id}
              onClick={(e) => { e.stopPropagation(); handleBlock(row) }}
            >
              {row.is_active ? 'Блок' : 'Разблок'}
            </Button>
            <ActionMenu items={[
              { label: 'Удалить аккаунт навсегда', icon: <IconTrash size={15} />, danger: true, onClick: () => { setDeleteError(null); setDeleteTarget(row) } },
            ]} />
          </div>
        ) : null
      ),
    },
  ]

  return (
    <div className="registry-page">
      <PageHeader
        eyebrow="Администрирование"
        title="Учётные записи"
        description="Доступ сотрудников, роли, связь с игровыми карточками и контроль состояния аккаунтов."
        actions={canManage ? (
          <Button variant="primary" onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ login: '', password: '', role_id: roles[0]?.id ?? '', citizen_id: '' }) }}>
            <IconPlus size={16} />Создать аккаунт
          </Button>
        ) : undefined}
      />

      {!loading && users.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #DFE4E1', borderRadius: '12px' }}>
          <EmptyState title="Аккаунты не найдены" description="Создайте первый аккаунт" action={canManage ? <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}><IconPlus size={14} />Создать</Button> : undefined} />
        </div>
      ) : (
        <Table columns={columns} data={users} keyExtractor={(row) => row.id} loading={loading} />
      )}

      {!loading && <div className="registry-footer"><span>Системные аккаунты</span><span>Всего: {users.length}</span></div>}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Создать аккаунт"
        footer={<><Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button><Button variant="primary" loading={createLoading} onClick={handleCreate}>Создать</Button></>}
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Логин *" value={createForm.login} onChange={(e) => setCreateForm({ ...createForm, login: e.target.value })} autoFocus />
          <Input label="Пароль *" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
          <Select
            label="Роль *"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="— Выберите роль —"
            value={createForm.role_id}
            onChange={(e) => setCreateForm({ ...createForm, role_id: e.target.value })}
          />
          <Select
            label="Игрок"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            placeholder="— Не привязан —"
            value={createForm.citizen_id}
            onChange={(e) => setCreateForm({ ...createForm, citizen_id: e.target.value })}
            searchable
          />
          {createError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{createError}</div>}
        </form>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title={`Изменить: ${selectedUser?.login ?? ''}`}
        footer={<><Button variant="secondary" onClick={() => setShowEditModal(false)}>Отмена</Button><Button variant="primary" loading={editLoading} onClick={handleEdit}>Сохранить</Button></>}
      >
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Роль"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            value={editForm.role_id}
            onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
          />
          <Select
            label="Игрок"
            options={citizens.map((c) => ({ value: c.id, label: `${c.nickname} (${c.reg_number})` }))}
            placeholder="— Не привязан —"
            value={editForm.citizen_id}
            onChange={(e) => setEditForm({ ...editForm, citizen_id: e.target.value })}
            searchable
          />
          {editError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{editError}</div>}
        </form>
      </Modal>

      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title={`Сброс пароля: ${selectedUser?.login ?? ''}`}
        footer={<><Button variant="secondary" onClick={() => setShowResetModal(false)}>Отмена</Button><Button variant="primary" loading={resetLoading} onClick={handleResetPassword}>Сбросить</Button></>}
      >
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Новый пароль (мин. 6 символов) *" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoFocus />
          {resetError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{resetError}</div>}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить аккаунт"
        description="Аккаунт и все сессии будут уничтожены. Игровая карточка и реестровые данные не затрагиваются."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={!deleteUnlocked || !deleteConfirm.confirmed}
              loading={deleteLoading}
              onClick={handleDeleteAccount}
            >
              {!deleteUnlocked ? `Подождите ${deleteCountdown}с` : 'Удалить аккаунт'}
            </Button>
          </>
        }
      >
        <div className="danger-confirm" style={{ marginBottom: '14px' }}>
          Аккаунт <strong>{deleteTarget?.login}</strong> будет удалён навсегда. Это действие нельзя отменить.
        </div>
        <Input
          label={`Введите логин «${deleteTarget?.login ?? ''}» для подтверждения`}
          value={deleteConfirm.value}
          onChange={deleteConfirm.onChange}
          placeholder={deleteTarget?.login ?? ''}
          autoFocus
        />
        {deleteError && <div className="form-error" style={{ marginTop: '10px' }}>{deleteError}</div>}
      </Modal>
    </div>
  )
}
