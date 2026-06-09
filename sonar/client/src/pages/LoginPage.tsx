import React, { useEffect, useState } from 'react'
import {
  IconBrandDiscord,
  IconInfoCircle,
  IconLock,
  IconUser,
  IconHelpCircle,
} from '@tabler/icons-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SonarBrand } from '../components/brand/SonarBrand'
import { useAuthStore } from '../store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, user, isLoading } = useAuthStore()
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showForgot, setShowForgot] = useState(false)

  useEffect(() => {
    const code = searchParams.get('error')
    const messages: Record<string, string> = {
      discord_not_linked: 'Этот Discord ещё не привязан к служебной учётной записи.',
      discord_unavailable: 'Вход через Discord пока не настроен.',
      discord_cancelled: 'Авторизация Discord была отменена.',
      discord_exchange: 'Discord не подтвердил код авторизации. Повторите вход.',
      discord_profile: 'Не удалось получить профиль Discord.',
      discord_state: 'Сессия Discord устарела. Начните вход заново.',
      discord: 'Не удалось завершить вход через Discord.',
    }
    if (code && messages[code]) setError(messages[code])
  }, [searchParams])

  useEffect(() => {
    if (!user) return
    navigate(user.must_change_password ? '/change-password' : '/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
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
    <main className="auth">
      <div className="auth-blobs" aria-hidden="true">
        <span className="auth-blob b1" />
        <span className="auth-blob b2" />
        <span className="auth-blob b3" />
        <span className="auth-blob b4" />
      </div>

      <div className="auth-card">
        <div className="auth-brand"><SonarBrand size="lg" /></div>

        <h1>Вход в систему</h1>
        <p className="auth-sub">Служебная учётная запись · СОНАР Пельгарии</p>

        <form onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Логин</span>
            <div><IconUser size={18} /><input value={loginVal} onChange={(e) => setLoginVal(e.target.value)} autoComplete="username" autoFocus placeholder="Ваш логин" /></div>
          </label>
          <label className="auth-field">
            <span>Пароль</span>
            <div><IconLock size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></div>
          </label>

          <button type="button" className="auth-forgot" onClick={() => setShowForgot((v) => !v)}>
            Не помню пароль
          </button>

          {showForgot && (
            <div className="auth-hint">
              <IconHelpCircle size={16} />
              <span>Самостоятельный сброс пароля недоступен. Обратитесь к администратору системы — он назначит новый пароль.</span>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={isLoading}>
            {isLoading ? 'Проверка данных…' : 'Войти'}
          </button>

          <div className="auth-divider"><span>или</span></div>

          <button className="auth-discord" type="button" disabled title="Функция в доработке">
            <IconBrandDiscord size={19} />
            Войти через Discord
          </button>
          <p className="auth-discord-note">Вход через Discord будет доступен позже.</p>
        </form>

        <div className="auth-fiction">
          <IconInfoCircle size={16} style={{ flexShrink: 0 }} />
          <span>Пельгария — вымышленное государство в ролевой игре Minecraft. Сервис не относится к реальным госорганам и не оказывает настоящих услуг.</span>
        </div>
      </div>

      <footer className="auth-foot">Государство Пельгария · Minecraft RP</footer>
    </main>
  )
}
