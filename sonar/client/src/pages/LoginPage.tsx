import React, { useEffect, useState } from 'react'
import {
  IconBrandDiscord,
  IconInfoCircle,
  IconLock,
  IconUser,
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
  const [discordReady, setDiscordReady] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const code = searchParams.get('error')
    const messages: Record<string, string> = {
      discord_not_linked: 'Этот Discord ещё не привязан к служебной учётной записи. Сначала войдите по паролю и привяжите Discord в профиле.',
      discord_unavailable: 'Вход через Discord пока не настроен администратором.',
      discord_cancelled: 'Авторизация Discord была отменена.',
      discord_exchange: 'Discord не подтвердил код авторизации. Повторите вход.',
      discord_profile: 'Не удалось получить профиль Discord.',
      discord_state: 'Сессия Discord устарела или недействительна. Начните вход заново.',
      discord: 'Не удалось завершить вход через Discord.',
    }
    if (code && messages[code]) setError(messages[code])
  }, [searchParams])

  useEffect(() => {
    fetch('/api/auth/discord/status')
      .then(async (response) => response.ok ? response.json() as Promise<{ configured: boolean }> : { configured: false })
      .then((data) => setDiscordReady(data.configured))
      .catch(() => setDiscordReady(false))
  }, [])

  useEffect(() => {
    if (!user) return
    navigate(user.must_change_password ? '/change-password' : '/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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

  const timeStr = now.toLocaleTimeString('ru-RU')
  const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <main className="auth">
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-seal" aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="94" fill="none" stroke="#34e0a1" strokeWidth="1" />
          <circle cx="100" cy="100" r="76" fill="none" stroke="#34e0a1" strokeWidth="0.6" />
          <g transform="translate(58 56) scale(2.4)" stroke="#34e0a1" fill="none">
            <path d="M10 24.5V11.8c0-1 .8-1.8 1.8-1.8H25" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M14.2 25.8V15.2c0-.55.45-1 1-1h10.6" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="23.5" cy="23.5" r="3.5" fill="#34e0a1" stroke="none" />
          </g>
        </svg>
      </div>

      <div className="auth-card">
        <div className="auth-accent" />
        <div className="auth-brand"><SonarBrand size="lg" light /></div>
        <div className="auth-clock"><b>{timeStr}</b> · {dateStr}</div>

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

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={isLoading}>
            {isLoading ? 'Проверка данных…' : 'Войти'}
          </button>

          <div className="auth-divider"><span>или</span></div>

          <button
            className="auth-discord"
            type="button"
            disabled={discordReady !== true}
            onClick={() => { window.location.href = '/api/auth/discord/login' }}
          >
            <IconBrandDiscord size={19} />
            {discordReady === null ? 'Проверяем Discord…' : discordReady ? 'Войти через Discord' : 'Discord пока не подключён'}
          </button>
          {discordReady === false && <p className="auth-discord-note">Администратору нужно добавить Client ID и Client Secret приложения Discord.</p>}
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
