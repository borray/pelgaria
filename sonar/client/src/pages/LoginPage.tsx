import React, { useEffect, useState } from 'react'
import { IconBrandDiscord, IconInfoCircle, IconLock, IconUser } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { SonarBrand } from '../components/brand/SonarBrand'
import { useAuthStore } from '../store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, user, isLoading } = useAuthStore()
  const [loginVal, setLoginVal] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

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

          <button className="login-discord" type="button" onClick={() => { window.location.href = '/api/auth/discord/login' }}>
            <IconBrandDiscord size={19} />
            Войти через Discord
          </button>

          <small className="login-security">Игровой государственный сервис · Minecraft RP</small>
        </form>
      </section>
    </main>
  )
}
