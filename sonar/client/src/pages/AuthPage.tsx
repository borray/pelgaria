import { FormEvent, useState } from 'react'
import { PelgradMark } from '../components/brand/PelgradMark'
import { SonarMark } from '../components/brand/SonarMark'

export type SonarAccount = {
  id: string
  login: string
  role: 'CHAIRMAN' | 'OPERATOR'
  lastLoginAt: string | null
}

type AuthPageProps = {
  onAuthenticated: (account: SonarAccount) => void
  onExit: () => void
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7A4 4 0 0 1 16 7V10M12 14V16" /></svg>
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20C6.2 16.75 8.3 15 12 15C15.7 15 17.8 16.75 18.5 20" /></svg>
}

export function AuthPage({ onAuthenticated, onExit }: AuthPageProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [isVisible, setVisible] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      const body = await response.json().catch(() => ({})) as { account?: SonarAccount; error?: string }
      if (!response.ok || !body.account) throw new Error(body.error ?? 'Не удалось начать сессию.')
      onAuthenticated(body.account)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось начать сессию.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-ambient" aria-hidden="true"><span /><span /><span /><i /></div>
      <header className="auth-header">
        <button type="button" className="auth-world-link" onClick={onExit}><span><PelgradMark /></span><b>Пельград</b></button>
        <p>Служебный портал</p>
      </header>
      <section className="auth-layout">
        <div className="auth-intro"><p>СОНАР · Пельград</p><h1>Спокойная работа<br />начинается <em>с доступа.</em></h1><span>Система Организации Надзора и Администрирования Реестра.</span></div>
        <div className="auth-card-wrap">
          <form className="auth-card" onSubmit={submit}>
            <div className="auth-card-brand"><span><SonarMark /></span><div><strong>СОНАР</strong><small>Внутренний контур</small></div></div>
            <div className="auth-card-heading"><h2>Вход в систему</h2><p>Введите данные служебной учётной записи.</p></div>
            <label className="auth-field"><span>Логин</span><div><UserIcon /><input autoComplete="username" autoCapitalize="none" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Ваш логин" required /></div></label>
            <label className="auth-field"><span>Пароль</span><div><LockIcon /><input autoComplete="current-password" type={isVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ваш пароль" required /><button type="button" onClick={() => setVisible(!isVisible)} aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}>{isVisible ? 'Скрыть' : 'Показать'}</button></div></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Проверяем доступ...' : 'Войти в СОНАР'}<span aria-hidden="true">→</span></button>
            <p className="auth-note"><i /> Учётные записи создаются внутри СОНАР. Если у вас нет доступа, обратитесь к Председателю Верховного Совета.</p>
          </form>
        </div>
      </section>
      <footer className="auth-footer"><span>Пельград · Minecraft Role Play</span><span>Вымышленный игровой мир</span></footer>
    </main>
  )
}
