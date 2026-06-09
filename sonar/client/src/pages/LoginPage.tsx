import React, { useEffect, useRef, useState } from 'react'
import {
  IconBrandDiscord,
  IconInfoCircle,
  IconLock,
  IconUser,
  IconActivity,
  IconClock,
  IconCalendarEvent,
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
  const screenRef = useRef<HTMLElement>(null)

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

  const handleMove = (event: React.MouseEvent) => {
    const el = screenRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`)
    el.style.setProperty('--my', `${event.clientY - rect.top}px`)
    el.style.setProperty('--px', px.toFixed(3))
    el.style.setProperty('--py', py.toFixed(3))
  }

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
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="login-screen" ref={screenRef} onMouseMove={handleMove}>
      <div className="login-aurora" />

      <section className="login-story">
        <div className="login-radar" aria-hidden="true">
          <div className="login-radar-cross" />
          <span className="login-blip" style={{ top: '32%', left: '64%', animationDelay: '0s' }} />
          <span className="login-blip" style={{ top: '58%', left: '40%', animationDelay: '1.2s' }} />
          <span className="login-blip" style={{ top: '46%', left: '72%', animationDelay: '2.4s' }} />
          <span className="login-blip" style={{ top: '68%', left: '58%', animationDelay: '3.1s' }} />
        </div>

        <div className="login-story-content">
          <div className="login-emblem-tilt"><SonarBrand size="lg" light /></div>
          <div className="login-story-kicker">Служебная информационная система</div>
          <h1>Единое рабочее пространство <span className="accent-word">Пельгарии</span></h1>
          <p>
            Реестры, документы и рабочие процессы игрового государства собраны в одном сервисе.
          </p>

          <div className="login-chips">
            <span className="login-chip"><span className="dot" /> Система · в сети</span>
            <span className="login-chip"><IconClock size={14} /> <b>{timeStr}</b></span>
            <span className="login-chip"><IconCalendarEvent size={14} /> {dateStr}</span>
          </div>

          <div className="fiction-notice">
            <IconInfoCircle size={20} />
            <div>
              <strong>Это вымышленный проект</strong>
              <span>Пельгария является государством в ролевой игре Minecraft. Сервис не относится к реальным государственным органам и не оказывает настоящие государственные услуги.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-mobile-brand"><SonarBrand size="md" /></div>
          <div className="login-heading">
            <span><IconActivity size={11} style={{ verticalAlign: '-1px' }} /> Авторизация</span>
            <h2>Вход в СОНАР</h2>
            <p>Используйте служебную учётную запись</p>
          </div>

          <label className="login-field">
            <span>Логин</span>
            <div><IconUser size={18} /><input value={loginVal} onChange={(e) => setLoginVal(e.target.value)} autoComplete="username" autoFocus /></div>
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <div><IconLock size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" type="submit" disabled={isLoading}>
            {isLoading ? 'Проверка данных...' : 'Войти в систему'}
          </button>

          <div className="login-divider"><span>или</span></div>

          <button
            className="login-discord"
            type="button"
            disabled={discordReady !== true}
            onClick={() => { window.location.href = '/api/auth/discord/login' }}
          >
            <IconBrandDiscord size={19} />
            {discordReady === null ? 'Проверяем Discord...' : discordReady ? 'Войти через Discord' : 'Discord пока не подключён'}
          </button>
          {discordReady === false && <p className="login-discord-note">Администратору нужно добавить Client ID и Client Secret приложения Discord.</p>}

          <small className="login-security">Игровой государственный сервис · Minecraft RP</small>
        </form>
      </section>
    </main>
  )
}
