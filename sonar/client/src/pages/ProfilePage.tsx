import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  IconBrandDiscord,
  IconCheck,
  IconChevronRight,
  IconDeviceDesktop,
  IconEdit,
  IconFingerprint,
  IconId,
  IconKey,
  IconLock,
  IconPalette,
  IconShieldCheck,
  IconUnlink,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import { useAuthStore } from '../store/auth'
import api from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { formatDateTime } from '../utils/formatters'

type ProfileSection = 'overview' | 'identity' | 'security' | 'connections' | 'appearance'

export function ProfilePage() {
  const { user, setUser, setTokens } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<ProfileSection>('overview')
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
      api.get('/auth/me').then((response) => setUser(response.data)).catch(() => {})
    }
    if (discord === 'error') {
      const reasons: Record<string, string> = {
        discord_exchange: 'Discord не подтвердил авторизацию.',
        discord_profile: 'Не удалось получить профиль Discord.',
        discord_state: 'Сессия привязки истекла.',
      }
      setDiscordStatus(reasons[searchParams.get('reason') ?? ''] ?? 'Ошибка привязки Discord')
    }
  }, [searchParams, setUser])

  const permissions = useMemo(() => Object.entries(user?.permissions ?? {}).filter(([, allowed]) => allowed).map(([permission]) => permission), [user?.permissions])

  if (!user) return null

  const initials = user.login.slice(0, 2).toUpperCase()

  const handleUnlinkDiscord = async () => {
    try {
      await api.delete('/auth/discord')
      const profile = await api.get('/auth/me')
      setUser(profile.data)
      setDiscordStatus('Discord отвязан')
    } catch {
      setDiscordStatus('Не удалось отвязать Discord')
    }
  }

  const handleChangeLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoginError(null)
    setLoginSuccess(false)
    const value = loginValue.trim()
    if (value.length < 3) {
      setLoginError('Минимум 3 символа')
      return
    }
    if (value === user.login) {
      setEditingLogin(false)
      return
    }
    setLoginLoading(true)
    try {
      const response = await api.post('/auth/change-login', { login: value })
      setTokens(response.data.accessToken, response.data.refreshToken, response.data.user)
      setEditingLogin(false)
      setLoginSuccess(true)
    } catch (requestError: unknown) {
      setLoginError((requestError as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось изменить логин')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
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
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next })
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (requestError: unknown) {
      setPwError((requestError as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось сменить пароль')
    } finally {
      setPwLoading(false)
    }
  }

  const sections: Array<{ value: ProfileSection; label: string; icon: typeof IconUser }> = [
    { value: 'overview', label: 'Обзор', icon: IconUser },
    { value: 'identity', label: 'Учётная запись', icon: IconId },
    { value: 'security', label: 'Безопасность', icon: IconLock },
    { value: 'connections', label: 'Связи', icon: IconBrandDiscord },
    { value: 'appearance', label: 'Оформление', icon: IconPalette },
  ]

  return (
    <div className="employee-profile">
      <header className="employee-profile-hero">
        <div className="employee-profile-avatar">
          {user.discord_avatar ? <img src={user.discord_avatar} alt="" /> : <span>{initials}</span>}
          <i />
        </div>
        <div className="employee-profile-title">
          <span>Персональный кабинет СОНАР</span>
          <h1>{user.login}</h1>
          <p>{user.role.name} · служебная учётная запись</p>
        </div>
        <div className="employee-profile-trust"><IconShieldCheck size={22} /><span><strong>Доступ подтверждён</strong><small>{permissions.length} активных полномочий</small></span></div>
      </header>

      <div className="employee-profile-layout">
        <aside className="employee-profile-nav">
          <header><small>Учётная запись</small><strong>{user.login}</strong></header>
          <nav>
            {sections.map(({ value, label, icon: SectionIcon }) => (
              <button key={value} className={section === value ? 'is-active' : ''} onClick={() => setSection(value)}>
                <SectionIcon size={16} /><span>{label}</span><IconChevronRight size={14} />
              </button>
            ))}
          </nav>
          <footer><IconFingerprint size={18} /><span><strong>ID сотрудника</strong><small>{user.id.slice(0, 12).toUpperCase()}</small></span></footer>
        </aside>

        <main className="employee-profile-content">
          {section === 'overview' && (
            <div className="employee-profile-overview">
              <section className="employee-profile-welcome">
                <span>Рабочий профиль</span><h2>Всё в порядке, {user.login}</h2><p>Учётная запись активна и готова к работе во внутренних модулях СОНАР.</p>
                <div><article><IconShieldCheck size={20} /><span><small>Роль</small><strong>{user.role.name}</strong></span></article><article><IconKey size={20} /><span><small>Полномочия</small><strong>{permissions.length}</strong></span></article><article><IconDeviceDesktop size={20} /><span><small>Последний вход</small><strong>{user.last_login_at ? formatDateTime(user.last_login_at) : 'Первый сеанс'}</strong></span></article></div>
              </section>
              <div className="employee-profile-cards">
                <button onClick={() => setSection('identity')}><span><IconId size={20} /></span><div><strong>Учётная запись</strong><small>Логин и игровая карточка</small></div><IconChevronRight size={16} /></button>
                <button onClick={() => setSection('security')}><span><IconLock size={20} /></span><div><strong>Безопасность</strong><small>Пароль и состояние доступа</small></div><IconChevronRight size={16} /></button>
                <button onClick={() => setSection('connections')}><span><IconBrandDiscord size={20} /></span><div><strong>Discord</strong><small>{user.discord_username ? `@${user.discord_username}` : 'Не подключён'}</small></div><IconChevronRight size={16} /></button>
                <button onClick={() => setSection('appearance')}><span><IconPalette size={20} /></span><div><strong>Оформление</strong><small>Светлая и тёмная темы</small></div><IconChevronRight size={16} /></button>
              </div>
              <section className="employee-profile-authority">
                <header><div><span>Матрица доступа</span><h2>Активные полномочия</h2></div><strong>{permissions.length}</strong></header>
                <div>{permissions.slice(0, 18).map((permission) => <span key={permission}><IconCheck size={13} />{permission}</span>)}</div>
              </section>
            </div>
          )}

          {section === 'identity' && (
            <section className="employee-settings-panel">
              <header><span><IconId size={21} /></span><div><small>Идентичность</small><h2>Учётная запись</h2><p>Логин сотрудника и привязка к игровой карточке.</p></div></header>
              <div className="employee-setting-row">
                <div><small>Логин для входа</small><strong>{user.login}</strong><span>Используется для авторизации и записывается в журнал операций.</span></div>
                {!editingLogin && <Button variant="secondary" onClick={() => { setLoginValue(user.login); setEditingLogin(true) }}><IconEdit size={14} />Изменить</Button>}
              </div>
              {editingLogin && <form className="employee-inline-form" onSubmit={handleChangeLogin}><Input label="Новый логин" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} autoFocus /><div><Button type="submit" variant="primary" loading={loginLoading}>Сохранить</Button><Button type="button" variant="secondary" onClick={() => setEditingLogin(false)}><IconX size={14} />Отмена</Button></div></form>}
              {loginError && <div className="form-error">{loginError}</div>}
              {loginSuccess && <div className="form-success">Логин изменён</div>}
              <div className="employee-setting-row"><div><small>Служебная роль</small><strong>{user.role.name}</strong><span>Роль определяет набор доступных реестров и операций.</span></div><i style={{ background: user.role.color }} /></div>
              <div className="employee-setting-row"><div><small>Игровая карточка</small><strong>{user.citizen?.nickname ?? 'Не привязана'}</strong><span>{user.citizen?.reg_number ?? 'Администратор может связать учётную запись с игроком.'}</span></div>{user.citizen && <Link to={`/citizens/${user.citizen.id}`}>Открыть</Link>}</div>
            </section>
          )}

          {section === 'security' && (
            <section className="employee-settings-panel">
              <header><span><IconLock size={21} /></span><div><small>Защита доступа</small><h2>Безопасность</h2><p>Обновите пароль служебной учётной записи.</p></div></header>
              <div className="employee-security-state"><IconShieldCheck size={24} /><div><strong>Учётная запись активна</strong><span>Обязательная смена пароля не требуется.</span></div><b>Норма</b></div>
              <form className="employee-password-form" onSubmit={handleChangePassword}>
                <Input label="Текущий пароль" type="password" value={pwForm.current} onChange={(event) => setPwForm((current) => ({ ...current, current: event.target.value }))} />
                <Input label="Новый пароль" type="password" value={pwForm.next} onChange={(event) => setPwForm((current) => ({ ...current, next: event.target.value }))} />
                <Input label="Повторите пароль" type="password" value={pwForm.confirm} onChange={(event) => setPwForm((current) => ({ ...current, confirm: event.target.value }))} />
                <Button type="submit" variant="primary" loading={pwLoading}><IconKey size={15} />Обновить пароль</Button>
              </form>
              {pwError && <div className="form-error">{pwError}</div>}
              {pwSuccess && <div className="form-success">Пароль успешно обновлён</div>}
            </section>
          )}

          {section === 'connections' && (
            <section className="employee-settings-panel">
              <header><span className="is-discord"><IconBrandDiscord size={21} /></span><div><small>Внешние связи</small><h2>Discord</h2><p>Игровой профиль для отображения имени и аватара.</p></div></header>
              {discordStatus && <div className={discordStatus.includes('успешно') || discordStatus.includes('отвязан') ? 'form-success' : 'form-error'}>{discordStatus}</div>}
              <div className="employee-connection-card">
                <div className="employee-connection-avatar">{user.discord_avatar ? <img src={user.discord_avatar} alt="" /> : <IconBrandDiscord size={25} />}</div>
                <div><small>Discord-аккаунт</small><strong>{user.discord_username ? `@${user.discord_username}` : 'Не подключён'}</strong><span>{user.discord_username ? 'Связь активна и отображается в СОНАР.' : 'Подключение будет доступно после завершения настройки OAuth.'}</span></div>
                {user.discord_username ? <Button variant="secondary" onClick={handleUnlinkDiscord}><IconUnlink size={15} />Отвязать</Button> : <Button variant="secondary" disabled>Подключить</Button>}
              </div>
            </section>
          )}

          {section === 'appearance' && (
            <section className="employee-settings-panel">
              <header><span><IconPalette size={21} /></span><div><small>Персонализация</small><h2>Оформление</h2><p>Настройки сохраняются только на этом устройстве.</p></div></header>
              <div className="employee-theme-card"><div><IconDeviceDesktop size={24} /><span><small>Интерфейс СОНАР</small><strong>Цветовая тема</strong><p>Выберите светлую или тёмную схему. Структура и доступность функций не изменятся.</p></span></div><ThemeToggle /></div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
