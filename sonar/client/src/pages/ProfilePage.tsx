import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IconBrandDiscord,
  IconUnlink,
  IconKey,
  IconId,
  IconEdit,
  IconCheck,
  IconX,
  IconShieldLock,
  IconPalette,
} from '@tabler/icons-react'
import { useAuthStore } from '../store/auth'
import api from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { formatDateTime } from '../utils/formatters'
import { ThemeToggle } from '../components/ui/ThemeToggle'

export function ProfilePage() {
  const { user, setUser, setTokens } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [discordStatus, setDiscordStatus] = useState<string | null>(null)

  const [editingLogin, setEditingLogin] = useState(false)
  const [loginValue, setLoginValue] = useState(user?.login ?? '')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    const discord = searchParams.get('discord')
    if (discord === 'success') {
      setDiscordStatus('Discord успешно привязан')
      // Обновляем данные пользователя, чтобы привязка сразу отобразилась
      api.get('/auth/me').then((r) => setUser(r.data)).catch(() => {})
    }
    if (discord === 'error') {
      const reasons: Record<string, string> = {
        discord_exchange: 'Не удалось завершить авторизацию Discord. Проверьте, что Client Secret в настройках указан верно.',
        discord_profile: 'Не удалось получить профиль Discord. Попробуйте ещё раз.',
        discord_state: 'Сессия привязки истекла. Нажмите «Привязать Discord» и попробуйте снова.',
      }
      const reason = searchParams.get('reason') ?? ''
      setDiscordStatus(reasons[reason] ?? 'Ошибка привязки Discord')
    }
  }, [searchParams, setUser])

  const handleUnlinkDiscord = async () => {
    try {
      await api.delete('/auth/discord')
      const profile = await api.get('/auth/me')
      setUser(profile.data)
      setDiscordStatus('Discord отвязан')
    } catch {
      setDiscordStatus('Ошибка при отвязке Discord')
    }
  }

  const startEditLogin = () => {
    setLoginValue(user?.login ?? '')
    setLoginError(null)
    setLoginSuccess(false)
    setEditingLogin(true)
  }

  const handleChangeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginSuccess(false)
    const value = loginValue.trim()
    if (value.length < 3) {
      setLoginError('Минимум 3 символа')
      return
    }
    if (value === user?.login) {
      setEditingLogin(false)
      return
    }
    setLoginLoading(true)
    try {
      const res = await api.post('/auth/change-login', { login: value })
      setTokens(res.data.accessToken, res.data.refreshToken, res.data.user)
      setEditingLogin(false)
      setLoginSuccess(true)
    } catch (err: any) {
      setLoginError(err.response?.data?.error ?? 'Не удалось изменить логин')
    } finally {
      setLoginLoading(false)
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
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
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

  const initials = user.login.slice(0, 2).toUpperCase()

  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Учётная запись</span>
          <h1>Профиль</h1>
          <p>Управление учётной записью, привязкой Discord и безопасностью.</p>
        </div>
      </div>

      {/* Шапка профиля */}
      <div className="profile-hero">
        <div className="profile-avatar">
          {user.discord_avatar
            ? <img src={user.discord_avatar} alt="" />
            : <span>{initials}</span>}
        </div>
        <div className="profile-hero-main">
          <strong>{user.login}</strong>
          <div className="profile-hero-meta">
            <Badge status={user.role.name} label={user.role.name} color={user.role.color} />
            {user.discord_username && (
              <span className="profile-chip"><IconBrandDiscord size={13} /> @{user.discord_username}</span>
            )}
          </div>
        </div>
        {user.last_login_at && (
          <div className="profile-hero-side">
            <span>Последний вход</span>
            <strong>{formatDateTime(user.last_login_at)}</strong>
          </div>
        )}
      </div>

      <div className="profile-grid">
        {/* Учётная запись / смена логина */}
        <section className="form-section">
          <div className="form-section-heading">
            <span><IconId size={15} /></span>
            <div><strong>Учётная запись</strong><small>Логин для входа в систему</small></div>
          </div>

          {!editingLogin ? (
            <div className="profile-row">
              <div>
                <div className="profile-row-label">Логин</div>
                <div className="profile-row-value">{user.login}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={startEditLogin}>
                <IconEdit size={14} /> Изменить
              </Button>
            </div>
          ) : (
            <form onSubmit={handleChangeLogin} className="profile-edit-form">
              <Input
                label="Новый логин"
                value={loginValue}
                autoFocus
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder="3–32 символа: буквы, цифры, . _ -"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" variant="primary" size="sm" loading={loginLoading}>
                  <IconCheck size={14} /> Сохранить
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditingLogin(false)}>
                  <IconX size={14} /> Отмена
                </Button>
              </div>
            </form>
          )}
          {loginError && <div className="form-error" style={{ marginTop: 12 }}>{loginError}</div>}
          {loginSuccess && <div className="form-success" style={{ marginTop: 12 }}>Логин изменён</div>}

          <div className="profile-row" style={{ marginTop: 6 }}>
            <div>
              <div className="profile-row-label">Роль</div>
              <div className="profile-row-value">{user.role.name}</div>
            </div>
          </div>
        </section>

        {/* Discord */}
        <section className="form-section">
          <div className="form-section-heading">
            <span style={{ color: '#5865F2', background: '#eaecfb', borderColor: '#cdd2f6' }}><IconBrandDiscord size={15} /></span>
            <div><strong>Discord</strong><small>Привязка отображает ваш username в реестре и паспорте</small></div>
          </div>

          {discordStatus && (
            <div className={discordStatus.includes('успешно') || discordStatus.includes('отвязан') ? 'form-success' : 'form-error'} style={{ marginBottom: 12 }}>
              {discordStatus}
            </div>
          )}

          {user.discord_username ? (
            <div className="profile-row">
              <div>
                <div className="profile-row-label">Привязан аккаунт</div>
                <div className="profile-row-value">@{user.discord_username}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={handleUnlinkDiscord}>
                <IconUnlink size={14} /> Отвязать
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="primary" size="sm" disabled title="Функция в доработке">
                <IconBrandDiscord size={14} /> Привязать Discord
              </Button>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--quiet)' }}>
                Привязка Discord временно недоступна — будет доступна позже.
              </div>
            </div>
          )}
        </section>

        {/* Смена пароля */}
        <section className="form-section">
          <div className="form-section-heading">
            <span><IconPalette size={15} /></span>
            <div><strong>Оформление</strong><small>Тема сохраняется на этом устройстве</small></div>
          </div>
          <div className="profile-row">
            <div>
              <div className="profile-row-label">Цветовая тема</div>
              <div className="profile-row-value">Светлая или тёмная схема СОНАР</div>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Смена пароля */}
        <section className="form-section profile-span-2">
          <div className="form-section-heading">
            <span><IconShieldLock size={15} /></span>
            <div><strong>Безопасность</strong><small>Смена пароля для входа</small></div>
          </div>

          <form onSubmit={handleChangePassword} className="profile-pw-grid">
            <Input label="Текущий пароль" type="password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} />
            <Input label="Новый пароль" type="password" value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} />
            <Input label="Подтвердите новый пароль" type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} />
            <div className="profile-pw-actions">
              <Button type="submit" variant="primary" size="sm" loading={pwLoading}>
                <IconKey size={14} /> Сменить пароль
              </Button>
            </div>
          </form>
          {pwError && <div className="form-error" style={{ marginTop: 12 }}>{pwError}</div>}
          {pwSuccess && <div className="form-success" style={{ marginTop: 12 }}>Пароль успешно изменён</div>}
        </section>
      </div>
    </div>
  )
}
