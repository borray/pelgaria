import React, { useEffect, useState } from 'react'
import {
  IconBrandDiscord,
  IconInfoCircle,
  IconLock,
  IconUser,
  IconHelpCircle,
  IconArrowRight,
  IconTool,
  IconShieldCheck,
  IconForms,
  IconDatabase,
} from '@tabler/icons-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
    <main className="auth auth-renovated">
      <div className="auth-theme-toggle"><ThemeToggle compact /></div>
      <section className="auth-stage">
        <aside className="auth-brief">
          <div className="auth-brief-grid" aria-hidden="true" />
          <div className="auth-brief-head">
            <SonarBrand size="lg" light />
            <span className="auth-environment"><i /> Служебный контур</span>
          </div>
          <div className="auth-brief-copy">
            <span className="auth-eyebrow">Единая государственная система</span>
            <h1>Работа с государством<br />в одном контуре.</h1>
            <p>Реестры, обслуживание граждан, законодательство и печатные документы без перехода между разрозненными системами.</p>
          </div>
          <div className="auth-capabilities">
            <span><IconDatabase size={17} /><b>Единые реестры</b></span>
            <span><IconForms size={17} /><b>Документы и формы</b></span>
            <span><IconShieldCheck size={17} /><b>Контроль операций</b></span>
          </div>
          <div className="auth-brief-foot">
            <span>СОНАР / Пельгария</span>
            <span>Minecraft Role Play</span>
          </div>
        </aside>

        <div className="auth-panel">
          <div className="auth-panel-inner">
            <div className="auth-mobile-brand"><SonarBrand size="md" /></div>
            <div className="auth-renovation-notice">
              <span><IconTool size={18} /></span>
              <div>
                <strong>Идёт цикл реновации СОНАР</strong>
                <p>Интерфейс и внутренние модули обновляются поэтапно. До завершения работ отдельные функции могут временно работать нестабильно.</p>
              </div>
            </div>

            <header className="auth-panel-heading">
              <span>Авторизация сотрудника</span>
              <h2>Вход в СОНАР</h2>
              <p>Используйте служебную учётную запись</p>
            </header>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field">
                <span>Логин</span>
                <div><IconUser size={18} /><input value={loginVal} onChange={(e) => setLoginVal(e.target.value)} autoComplete="username" autoFocus placeholder="Введите логин" /></div>
              </label>
              <label className="auth-field">
                <span>Пароль</span>
                <div><IconLock size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Введите пароль" /></div>
              </label>

              <button type="button" className="auth-forgot" onClick={() => setShowForgot((value) => !value)}>
                Не помню пароль
              </button>

              {showForgot && (
                <div className="auth-hint">
                  <IconHelpCircle size={16} />
                  <span>Обратитесь к администратору системы: он назначит временный пароль для восстановления доступа.</span>
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              <button className="auth-submit" type="submit" disabled={isLoading}>
                <span>{isLoading ? 'Проверяем данные' : 'Продолжить'}</span>
                {!isLoading && <IconArrowRight size={18} />}
              </button>

              <div className="auth-divider"><span>Другой способ</span></div>

              <button className="auth-discord" type="button" disabled title="Функция в разработке">
                <IconBrandDiscord size={19} />
                Discord
                <small>Скоро</small>
              </button>
            </form>

            <div className="auth-fiction">
              <IconInfoCircle size={17} />
              <span><strong>Это вымышленный сервис.</strong> Пельгария является государством ролевой игры Minecraft. СОНАР не относится к реальным государственным органам и не оказывает настоящих услуг.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
