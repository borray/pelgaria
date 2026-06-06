import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Routes, Route } from 'react-router-dom'
import { IconPlus, IconArrowLeft } from '@tabler/icons-react'
import apiClient from '../api/client'
import { usePermission } from '../hooks/usePermission'
import type { Role, Permission } from '../types'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'

const ALL_PERMISSIONS: { group: string; items: { key: Permission; label: string }[] }[] = [
  {
    group: 'Граждане',
    items: [
      { key: 'citizens.view', label: 'Просматривать' },
      { key: 'citizens.create', label: 'Создавать' },
      { key: 'citizens.edit', label: 'Редактировать' },
      { key: 'citizens.delete', label: 'Удалять' },
    ],
  },
  {
    group: 'Паспорта',
    items: [
      { key: 'passports.view', label: 'Просматривать' },
      { key: 'passports.issue', label: 'Выдавать' },
      { key: 'passports.reissue', label: 'Перевыдавать' },
    ],
  },
  {
    group: 'Законодательство',
    items: [
      { key: 'laws.view', label: 'Просматривать' },
      { key: 'laws.create', label: 'Создавать' },
      { key: 'laws.edit', label: 'Редактировать' },
      { key: 'laws.repeal', label: 'Отменять' },
    ],
  },
  {
    group: 'Судебные дела',
    items: [
      { key: 'cases.view', label: 'Просматривать' },
      { key: 'cases.create', label: 'Возбуждать' },
      { key: 'cases.manage', label: 'Управлять' },
      { key: 'cases.close', label: 'Закрывать' },
    ],
  },
  {
    group: 'Наказания',
    items: [
      { key: 'punishments.view', label: 'Просматривать' },
      { key: 'punishments.issue', label: 'Выдавать' },
      { key: 'punishments.revoke', label: 'Отзывать' },
    ],
  },
  {
    group: 'Налоги',
    items: [
      { key: 'taxes.view', label: 'Просматривать' },
      { key: 'taxes.charge', label: 'Начислять' },
      { key: 'taxes.mark_paid', label: 'Отмечать оплату' },
    ],
  },
  {
    group: 'Казна',
    items: [
      { key: 'treasury.view', label: 'Просматривать' },
      { key: 'treasury.edit', label: 'Редактировать' },
    ],
  },
  {
    group: 'РЕЛИКТ (строения)',
    items: [
      { key: 'relict.view', label: 'Просматривать' },
      { key: 'relict.create', label: 'Создавать' },
      { key: 'relict.edit', label: 'Редактировать' },
      { key: 'relict.delete', label: 'Удалять' },
    ],
  },
  {
    group: 'Территории',
    items: [
      { key: 'territories.view', label: 'Просматривать' },
      { key: 'territories.manage', label: 'Управлять' },
    ],
  },
  {
    group: 'Дипломатия',
    items: [
      { key: 'diplomacy.view', label: 'Просматривать' },
      { key: 'diplomacy.manage', label: 'Управлять' },
    ],
  },
  {
    group: 'Система',
    items: [
      { key: 'accounts.manage', label: 'Управлять аккаунтами' },
      { key: 'roles.manage', label: 'Управлять ролями' },
      { key: 'chat.send', label: 'Писать в чат' },
    ],
  },
]

function RolesList() {
  const navigate = useNavigate()
  const canManage = usePermission('roles.manage')
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', color: '#6B7280' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<Role[]>('/roles')
      setRoles(res.data)
    } catch { setRoles([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim()) { setCreateError('Название обязательно'); return }
    setCreateLoading(true); setCreateError(null)
    try {
      const res = await apiClient.post<Role>('/roles', { name: createForm.name.trim(), color: createForm.color })
      setShowCreateModal(false)
      setCreateForm({ name: '', color: '#6B7280' })
      navigate(`/roles/${res.data.id}`)
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка')
    } finally {
      setCreateLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Загрузка...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#0A1628', fontFamily: 'Inter, sans-serif' }}>Роли</h1>
        {canManage && (
          <Button variant="primary" onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '', color: '#6B7280' }) }}>
            <IconPlus size={16} />Создать роль
          </Button>
        )}
      </div>

      {roles.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '0.5px solid #D0D7E3', borderRadius: '4px' }}>
          <EmptyState title="Роли не найдены" description="Создайте первую роль" action={canManage ? <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}><IconPlus size={14} />Создать</Button> : undefined} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => navigate(`/roles/${role.id}`)}
              style={{ background: '#FFFFFF', border: '0.5px solid #D0D7E3', borderRadius: '4px', padding: '16px 20px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.1s', borderLeft: `4px solid ${role.color}` }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = role.color }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#D0D7E3'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = role.color }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#0A1628' }}>{role.name}</span>
                {role.is_system && <span style={{ fontSize: '11px', padding: '1px 6px', background: '#F3F4F6', borderRadius: '3px', color: '#6B7280' }}>Системная</span>}
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {role._count?.users ?? 0} пользователей · {Object.values(role.permissions).filter(Boolean).length} прав
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Создать роль"
        footer={<><Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button><Button variant="primary" loading={createLoading} onClick={handleCreate}>Создать</Button></>}
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Название *" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} autoFocus />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Цвет</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="color" value={createForm.color} onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })} style={{ width: '40px', height: '36px', border: '1px solid #D0D7E3', borderRadius: '4px', cursor: 'pointer', padding: '2px' }} />
              <Input value={createForm.color} onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })} style={{ flex: 1 }} />
            </div>
          </div>
          {createError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px' }}>{createError}</div>}
        </form>
      </Modal>
    </div>
  )
}

function RoleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6B7280')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiClient.get<Role>(`/roles/${id}`)
      .then((r) => {
        setRole(r.data)
        setPermissions(r.data.permissions)
        setName(r.data.name)
        setColor(r.data.color)
      })
      .catch(() => setRole(null))
      .finally(() => setLoading(false))
  }, [id])

  const togglePerm = (key: string) => {
    if (role?.is_system) return
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    if (!role) return
    setSaveLoading(true)
    setSaveError(null)
    setSaved(false)
    try {
      await apiClient.put(`/roles/${id}`, {
        name: role.is_system ? undefined : name,
        color,
        permissions,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setSaveError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка')
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Загрузка...</div>
  if (!role) return <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Роль не найдена</div>

  return (
    <div>
      <button onClick={() => navigate('/roles')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: 'Inter, sans-serif', marginBottom: '20px', padding: '4px 0' }}>
        <IconArrowLeft size={16} />Роли
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
          {role.is_system ? (
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0A1628', fontFamily: 'Inter, sans-serif' }}>{role.name}</h1>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: '20px', fontWeight: 700, color: '#0A1628', fontFamily: 'Inter, sans-serif', border: 'none', outline: 'none', background: 'transparent', borderBottom: '2px solid #E5E7EB', paddingBottom: '2px' }}
            />
          )}
          {role.is_system && <span style={{ fontSize: '12px', padding: '2px 8px', background: '#F3F4F6', borderRadius: '3px', color: '#6B7280' }}>Системная</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!role.is_system && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Цвет:</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '36px', height: '30px', border: '1px solid #D0D7E3', borderRadius: '4px', cursor: 'pointer', padding: '2px' }} />
            </div>
          )}
          {!role.is_system && (
            <Button variant="primary" loading={saveLoading} onClick={handleSave}>
              {saved ? '✓ Сохранено' : 'Сохранить'}
            </Button>
          )}
        </div>
      </div>

      {saveError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#DC2626', fontSize: '13px', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>{saveError}</div>}

      {role.is_system && (
        <div style={{ padding: '12px 16px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: '4px', color: '#92400E', fontSize: '13px', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
          Системная роль — редактирование прав недоступно.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {ALL_PERMISSIONS.map((group) => (
          <div key={group.group} style={{ background: '#FFFFFF', border: '0.5px solid #D0D7E3', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#F8F9FB', borderBottom: '1px solid #D0D7E3', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              {group.group}
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {group.items.map((item) => {
                const enabled = permissions[item.key] === true
                return (
                  <label
                    key={item.key}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: role.is_system ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#374151', userSelect: 'none' }}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => togglePerm(item.key)}
                      disabled={role.is_system}
                      style={{ width: '16px', height: '16px', cursor: role.is_system ? 'default' : 'pointer', accentColor: '#4A90D9' }}
                    />
                    {item.label}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RolesPage() {
  return (
    <Routes>
      <Route index element={<RolesList />} />
      <Route path=":id" element={<RoleDetail />} />
    </Routes>
  )
}
