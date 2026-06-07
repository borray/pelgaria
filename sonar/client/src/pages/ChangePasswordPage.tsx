import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import apiClient from '../api/client'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, refresh } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Заполните все поля')
      return
    }

    if (newPassword.length < 6) {
      setError('Новый пароль должен быть не менее 6 символов')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword })
      await refresh()
      setDone(true)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Ошибка смены пароля'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F2F4F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <Card style={{ maxWidth: 400, width: '100%' }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0A1628', marginBottom: '8px' }}>
              Пароль успешно изменён
            </div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
              Вы можете привязать Discord-аккаунт в настройках профиля.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => navigate('/')}>
                Пропустить
              </Button>
              <Button variant="primary" onClick={() => navigate('/')}>
                Перейти в систему
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F2F4F7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '0.5px solid #D0D7E3',
          borderRadius: '4px',
          padding: '40px',
          width: '100%',
          maxWidth: '380px',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              fontSize: '20px',
              color: '#0A1628',
              marginBottom: '4px',
            }}
          >
            СОНАР
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1B3A6B' }}>
            Смена пароля
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            {user?.login
              ? `Аккаунт: ${user.login}. Требуется сменить временный пароль.`
              : 'Требуется сменить временный пароль.'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Текущий пароль"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          <Input
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Подтверждение пароля"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '4px',
                color: '#DC2626',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Сменить пароль
          </Button>
        </form>
      </div>
    </div>
  )
}
