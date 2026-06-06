import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, user, isLoading } = useAuthStore()
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      if (user.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!loginVal.trim() || !password) {
      setError('Введите логин и пароль')
      return
    }

    try {
      await login(loginVal.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    }
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              fontSize: '28px',
              color: '#0A1628',
              letterSpacing: '0.05em',
              marginBottom: '6px',
            }}
          >
            СОНАР
          </div>
          <div
            style={{
              fontSize: '13px',
              color: '#6B7280',
              letterSpacing: '0.02em',
            }}
          >
            Государство Пельагрия
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Логин"
            type="text"
            value={loginVal}
            onChange={(e) => setLoginVal(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
            loading={isLoading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
          >
            Войти
          </Button>
        </form>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '0.5px solid #D0D7E3',
            textAlign: 'center',
            fontSize: '12px',
            color: '#9CA3AF',
          }}
        >
          Государственная информационная система
        </div>
      </div>
    </div>
  )
}
