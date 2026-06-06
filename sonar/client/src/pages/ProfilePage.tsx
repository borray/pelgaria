import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconBrandDiscord, IconUnlink, IconKey, IconUser } from '@tabler/icons-react'
import { useAuthStore } from '../store/auth'
import { api } from '../api/client'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

export function ProfilePage() {
  const { user, refresh } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [discordStatus, setDiscordStatus] = useState<string | null>(null)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    const discord = searchParams.get('discord')
    if (discord === 'success') setDiscordStatus('Discord успешно привязан')
    if (discord === 'error') setDiscordStatus('Ошибка привязки Discord')
  }, [searchParams])

  const handleLinkDiscord = () => {
    window.location.href = '/api/auth/discord'
  }

  const handleUnlinkDiscord = async () => {
    try {
      await api.delete('/auth/discord')
      await refresh()
      setDiscordStatus('Discord отвязан')
    } catch {
      setDiscordStatus('Ошибка при отвязке Discord')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    if (pwForm.next !== pwForm.confirm) {
      setPwError('Пароли не совпадают')
      return
    }
    if (pwForm.next.length < 6) {
      setPwError('Минимум 6 символов')
      return
    }

    setPwLoading(true)
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.next,
      })
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Ошибка смены пароля')
    } finally {
      setPwLoading(false)
    }
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Основные данные */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#1B3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {user.discord_avatar
              ? <img src={user.discord_avatar} style={{ width: 48, height: 48, borderRadius: '50%' }} alt="" />
              : <IconUser size={24} color="#fff" />
            }
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#0A1628' }}>{user.login}</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              <Badge color={user.role.color}>{user.role.name}</Badge>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
          <Row label="Логин" value={user.login} mono />
          <Row label="Роль" value={user.role.name} />
        </div>
      </Card>

      {/* Discord */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <IconBrandDiscord size={20} color="#5865F2" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Discord</span>
        </div>

        {discordStatus && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 4, fontSize: 13,
            background: discordStatus.includes('успешно') || discordStatus.includes('отвязан') ? '#F0FDF4' : '#FEF2F2',
            color: discordStatus.includes('успешно') || discordStatus.includes('отвязан') ? '#15803D' : '#DC2626',
            border: `1px solid ${discordStatus.includes('успешно') || discordStatus.includes('отвязан') ? '#BBF7D0' : '#FECACA'}`,
          }}>
            {discordStatus}
          </div>
        )}

        {user.discord_username ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>@{user.discord_username}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Аккаунт привязан</div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleUnlinkDiscord}>
              <IconUnlink size={14} style={{ marginRight: 4 }} />
              Отвязать
            </Button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
              Discord не привязан. Привязка позволяет отображать ваш username в реестре и паспорте.
            </div>
            <Button variant="primary" size="sm" onClick={handleLinkDiscord}>
              <IconBrandDiscord size={14} style={{ marginRight: 6 }} />
              Привязать Discord
            </Button>
          </div>
        )}
      </Card>

      {/* Смена пароля */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <IconKey size={20} color="#4A90D9" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Смена пароля</span>
        </div>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Текущий пароль"
            type="password"
            value={pwForm.current}
            onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
          />
          <Input
            label="Новый пароль"
            type="password"
            value={pwForm.next}
            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
          />
          <Input
            label="Подтвердить новый пароль"
            type="password"
            value={pwForm.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
          />

          {pwError && (
            <div style={{
              padding: '8px 12px', borderRadius: 4, fontSize: 13,
              background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
            }}>
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div style={{
              padding: '8px 12px', borderRadius: 4, fontSize: 13,
              background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0',
            }}>
              Пароль успешно изменён
            </div>
          )}

          <div>
            <Button type="submit" variant="primary" size="sm" loading={pwLoading}>
              Сменить пароль
            </Button>
          </div>
        </form>
      </Card>

    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: '#6B7280', minWidth: 100 }}>{label}:</span>
      <span style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}>{value}</span>
    </div>
  )
}
