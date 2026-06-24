import React, { useEffect, useState } from 'react'
import {
  IconArrowRight,
  IconHelpCircle,
  IconInfoCircle,
  IconLock,
  IconUser,
} from '@tabler/icons-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SonarBrand } from '../components/brand/SonarBrand'
import { useAuthStore } from '../store/auth'
import { ThemeToggle } from '../components/ui/ThemeToggle'

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
    navigate(user.must_change_password ? '/change-password' : '/dashboard', { replace: true })
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
    <main className="auth auth-entry">
      <Link to="/" className="auth-bridge-return">← Пельгария</Link>
      <div className="auth-entry-theme"><ThemeToggle compact /></div>
      <div className="auth-entry-scene" aria-hidden="true">
        <span className="auth-entry-grid" />
        <span className="auth-entry-orbit auth-entry-orbit-a" />
        <span className="auth-entry-orbit auth-entry-orbit-b" />
        <span className="auth-entry-signal" />
        <span className="auth-entry-scan" />
      </div>

      <section className="auth-entry-card" aria-labelledby="auth-entry-title">
        <div className="auth-entry-brand"><SonarBrand size="md" /></div>
        <header className="auth-entry-heading">
          <span><i /> Служебный контур</span>
          <h1 id="auth-entry-title">Вход в СОНАР</h1>
        </header>

        <form onSubmit={handleSubmit} className="auth-form auth-entry-form">
          <label className="auth-field">
            <span>Логин</span>
            <div><IconUser size={18} /><input value={loginVal} onChange={(event) => setLoginVal(event.target.value)} autoComplete="username" autoFocus placeholder="Введите логин" /></div>
          </label>
          <label className="auth-field">
            <span>Пароль</span>
            <div><IconLock size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Введите пароль" /></div>
          </label>

          <button type="button" className="auth-forgot" onClick={() => setShowForgot((value) => !value)}>
            Не помню пароль
          </button>

          {showForgot && (
            <div className="auth-hint">
              <IconHelpCircle size={16} />
              <span>Обратитесь к администратору системы, чтобы получить временный пароль.</span>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={isLoading}>
            <span>{isLoading ? 'Проверяем данные' : 'Войти'}</span>
            {!isLoading && <IconArrowRight size={18} />}
          </button>
        </form>

        <footer className="auth-entry-foot">
          <IconInfoCircle size={15} />
          <span>Пельгария является вымышленным государством ролевой игры Minecraft.</span>
        </footer>
      </section>
    </main>
  )
}
