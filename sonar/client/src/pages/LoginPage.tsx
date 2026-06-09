import React, { useEffect, useState } from 'react'
import { IconBrandDiscord, IconInfoCircle, IconLock, IconUser } from '@tabler/icons-react'
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
    <main className="login-screen">
      <section className="login-story">
        <div className="login-story-content">
          <SonarBrand size="lg" />
          <div className="login-story-kicker">Служебная информационная система</div>
          <h1>Единое рабочее пространство Пельагрии</h1>
          <p>
            Реестры, документы и рабочие процессы игрового государства собраны в одном сервисе.
          </p>
          <div className="fiction-notice">
            <IconInfoCircle size={20} />
            <div>
              <strong>Это вымышленный проект</strong>
              <span>Пельагрия является государством в ролевой игре Minecraft. Сервис не относится к реальным государственным органам и не оказывает настоящие государственные услуги.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-mobile-brand"><SonarBrand size="md" /></div>
          <div className="login-heading">
            <span>Авторизация</span>
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
