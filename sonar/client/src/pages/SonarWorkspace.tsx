import { useEffect, useState, type ReactNode } from 'react'
import { CouncilMark } from '../components/brand/CouncilMark'
import { PelgariaMark } from '../components/brand/PelgariaMark'
import { PelgradMark } from '../components/brand/PelgradMark'
import { SonarMark } from '../components/brand/SonarMark'
import type { SonarAccount } from './AuthPage'

type WorkspaceSection = 'overview' | 'council' | 'institutions' | 'registry' | 'system'
type IconName =
  | 'grid' | 'council' | 'building' | 'archive' | 'settings' | 'arrow' | 'menu' | 'close' | 'check'
  | 'edit' | 'trash' | 'print' | 'revoke' | 'restore' | 'plus' | 'passport' | 'spinner'
type PassportStatus = 'ACTIVE' | 'REVOKED'
type Passport = { id: string; number: string; status: PassportStatus; issued_at: string } | null
type CouncilDecision = { id: string; number: number; title: string; body: string; status: 'DRAFT' | 'ADOPTED'; created_at: string; adopted_at: string | null; author: { login: string } }
type RegistryPlayer = { id: string; nickname: string; minecraft_uuid: string | null; note: string | null; created_at: string; passport: Passport }

const navigation: Array<{ id: WorkspaceSection; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Обзор', icon: 'grid' },
  { id: 'council', label: 'Верховный Совет', icon: 'council' },
  { id: 'institutions', label: 'Ведомства', icon: 'building' },
  { id: 'registry', label: 'Игроки', icon: 'archive' },
  { id: 'system', label: 'Система', icon: 'settings' },
]

const sectionCopy: Record<Exclude<WorkspaceSection, 'overview' | 'council' | 'registry'>, { eyebrow: string; title: string; description: string; next: string }> = {
  institutions: {
    eyebrow: 'Структура Пельграда',
    title: 'Ведомства',
    description: 'Внутренний Контур, Палата развития, Гражданская канцелярия и Комитет Внешнего Сдерживания будут оформлены как самостоятельные рабочие пространства.',
    next: 'Сейчас формируется общая модель полномочий и ответственности.',
  },
  system: {
    eyebrow: 'Состояние контура',
    title: 'Система',
    description: 'СОНАР разворачивается заново. Здесь фиксируются границы текущего этапа, чтобы незавершённые идеи не выглядели готовыми функциями.',
    next: 'Старые модули не подключаются к новому контуру.',
  },
}

const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[1-5][0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$/i

function WorkspaceIcon({ name }: { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'grid': return <svg viewBox="0 0 24 24" {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
    case 'council': return <CouncilMark />
    case 'building': return <svg viewBox="0 0 24 24" {...common}><path d="M4 20H20M6 20V8L12 4L18 8V20M9 20V13H15V20M9 10H9.01M15 10H15.01" /></svg>
    case 'archive': return <svg viewBox="0 0 24 24" {...common}><path d="M4 7H20V20H4zM3 4H21V7H3zM9 11H15" /></svg>
    case 'settings': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15A1.7 1.7 0 0 0 19.74 16.88L19.8 16.94L17.94 18.8L17.88 18.74A1.7 1.7 0 0 0 16 18.4L15.4 18.65A1.7 1.7 0 0 0 14.35 20.2V20.3H9.65V20.2A1.7 1.7 0 0 0 8.6 18.65L8 18.4A1.7 1.7 0 0 0 6.12 18.74L6.06 18.8L4.2 16.94L4.26 16.88A1.7 1.7 0 0 0 4.6 15L4.35 14.4A1.7 1.7 0 0 0 2.8 13.35H2.7V8.65H2.8A1.7 1.7 0 0 0 4.35 7.6L4.6 7A1.7 1.7 0 0 0 4.26 5.12L4.2 5.06L6.06 3.2L6.12 3.26A1.7 1.7 0 0 0 8 3.6L8.6 3.35A1.7 1.7 0 0 0 9.65 1.8V1.7H14.35V1.8A1.7 1.7 0 0 0 15.4 3.35L16 3.6A1.7 1.7 0 0 0 17.88 3.26L17.94 3.2L19.8 5.06L19.74 5.12A1.7 1.7 0 0 0 19.4 7L19.65 7.6A1.7 1.7 0 0 0 21.2 8.65H21.3V13.35H21.2A1.7 1.7 0 0 0 19.65 14.4z" /></svg>
    case 'arrow': return <svg viewBox="0 0 24 24" {...common}><path d="M5 12H19M13 6L19 12L13 18" /></svg>
    case 'menu': return <svg viewBox="0 0 24 24" {...common}><path d="M4 7H20M4 12H20M4 17H20" /></svg>
    case 'close': return <svg viewBox="0 0 24 24" {...common}><path d="M6 6L18 18M18 6L6 18" /></svg>
    case 'check': return <svg viewBox="0 0 24 24" {...common}><path d="M5 12L10 17L19 7" /></svg>
    case 'edit': return <svg viewBox="0 0 24 24" {...common}><path d="M4 20H8L18.5 9.5A2.12 2.12 0 0 0 15.5 6.5L5 17V20z" /><path d="M13.5 8.5L16 11" /></svg>
    case 'trash': return <svg viewBox="0 0 24 24" {...common}><path d="M4 7H20M9 7V5A1 1 0 0 1 10 4H14A1 1 0 0 1 15 5V7M6 7L7 20A1 1 0 0 0 8 21H16A1 1 0 0 0 17 20L18 7M10 11V17M14 11V17" /></svg>
    case 'print': return <svg viewBox="0 0 24 24" {...common}><path d="M7 8V3H17V8M7 18H5A2 2 0 0 1 3 16V11A2 2 0 0 1 5 9H19A2 2 0 0 1 21 11V16A2 2 0 0 1 19 18H17M7 14H17V21H7z" /></svg>
    case 'revoke': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="8.5" /><path d="M6 6L18 18" /></svg>
    case 'restore': return <svg viewBox="0 0 24 24" {...common}><path d="M4 12A8 8 0 1 1 6.3 17.7M4 12V8M4 12H8" /></svg>
    case 'plus': return <svg viewBox="0 0 24 24" {...common}><path d="M12 5V19M5 12H19" /></svg>
    case 'passport': return <svg viewBox="0 0 24 24" {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M9 15.5H15" /></svg>
    case 'spinner': return <svg viewBox="0 0 24 24" {...common} className="s-spin"><path d="M12 3A9 9 0 1 0 21 12" /></svg>
  }
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" className={`s-toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span className="s-toggle-track"><span className="s-toggle-knob" /></span>
      <span className="s-toggle-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </button>
  )
}

function Modal({ title, eyebrow, onClose, children, footer }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="s-modal-scrim" onMouseDown={onClose}>
      <div className="s-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="s-modal-head">
          <div>{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>
          <button type="button" className="s-iconbtn" onClick={onClose} aria-label="Закрыть"><WorkspaceIcon name="close" /></button>
        </div>
        <div className="s-modal-body">{children}</div>
        <div className="s-modal-foot">{footer}</div>
      </div>
    </div>
  )
}

function IconButton({ icon, label, onClick, tone = 'neutral', busy }: { icon: IconName; label: string; onClick: () => void; tone?: 'neutral' | 'danger' | 'accent'; busy?: boolean }) {
  return (
    <button type="button" className={`s-iconbtn s-iconbtn--${tone}`} onClick={onClick} disabled={busy} title={label} aria-label={label}>
      <WorkspaceIcon name={busy ? 'spinner' : icon} />
    </button>
  )
}

export function SonarWorkspace({ account, onExit, onLogout }: { account: SonarAccount; onExit: () => void; onLogout: () => void }) {
  const isChairman = account.role === 'CHAIRMAN'
  const [section, setSection] = useState<WorkspaceSection>('overview')
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordState, setPasswordState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState('')

  const [decisions, setDecisions] = useState<CouncilDecision[]>([])
  const [isCouncilLoading, setCouncilLoading] = useState(false)
  const [councilError, setCouncilError] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [isSubmittingDecision, setSubmittingDecision] = useState(false)
  const [editingDecision, setEditingDecision] = useState<CouncilDecision | null>(null)

  const [players, setPlayers] = useState<RegistryPlayer[]>([])
  const [isPlayersLoading, setPlayersLoading] = useState(false)
  const [playersError, setPlayersError] = useState('')
  const [nickname, setNickname] = useState('')
  const [minecraftUuid, setMinecraftUuid] = useState('')
  const [playerNote, setPlayerNote] = useState('')
  const [issuePassport, setIssuePassport] = useState(true)
  const [isSubmittingPlayer, setSubmittingPlayer] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<RegistryPlayer | null>(null)
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<{ kind: 'decision' | 'player'; id: string; name: string } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const navigate = (next: WorkspaceSection) => { setSection(next); setMenuOpen(false) }
  const activeItem = navigation.find((item) => item.id === section)!
  const sectionDetails = section === 'institutions' || section === 'system' ? sectionCopy[section] : null

  useEffect(() => {
    if (section !== 'council') return
    setCouncilLoading(true); setCouncilError('')
    fetch('/api/council/decisions', { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { decisions?: CouncilDecision[]; error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Не удалось получить журнал решений.')
        setDecisions(body.decisions ?? [])
      })
      .catch((reason) => setCouncilError(reason instanceof Error ? reason.message : 'Не удалось получить журнал решений.'))
      .finally(() => setCouncilLoading(false))
  }, [section])

  useEffect(() => {
    if (section !== 'registry') return
    setPlayersLoading(true); setPlayersError('')
    fetch('/api/players', { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { players?: RegistryPlayer[]; error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Не удалось получить реестр игроков.')
        setPlayers(body.players ?? [])
      })
      .catch((reason) => setPlayersError(reason instanceof Error ? reason.message : 'Не удалось получить реестр игроков.'))
      .finally(() => setPlayersLoading(false))
  }, [section])

  const createDecision = async () => {
    if (isSubmittingDecision) return
    setSubmittingDecision(true); setCouncilError('')
    try {
      const response = await fetch('/api/council/decisions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draftTitle, body: draftBody }) })
      const payload = await response.json().catch(() => ({})) as { decision?: CouncilDecision; error?: string }
      if (!response.ok || !payload.decision) throw new Error(payload.error ?? 'Не удалось создать решение.')
      setDecisions((current) => [payload.decision!, ...current])
      setDraftTitle(''); setDraftBody('')
    } catch (reason) { setCouncilError(reason instanceof Error ? reason.message : 'Не удалось создать решение.') } finally { setSubmittingDecision(false) }
  }

  const saveDecisionEdit = async (id: string, title: string, body: string) => {
    const response = await fetch(`/api/council/decisions/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) })
    const payload = await response.json().catch(() => ({})) as { decision?: CouncilDecision; error?: string }
    if (!response.ok || !payload.decision) throw new Error(payload.error ?? 'Не удалось сохранить решение.')
    setDecisions((current) => current.map((item) => item.id === id ? payload.decision! : item))
    setEditingDecision(null)
  }

  const adoptDecision = async (id: string) => {
    setCouncilError('')
    try {
      const response = await fetch(`/api/council/decisions/${id}/adopt`, { method: 'POST', credentials: 'include' })
      const payload = await response.json().catch(() => ({})) as { decision?: CouncilDecision; error?: string }
      if (!response.ok || !payload.decision) throw new Error(payload.error ?? 'Не удалось принять решение.')
      setDecisions((current) => current.map((decision) => decision.id === id ? payload.decision! : decision))
    } catch (reason) { setCouncilError(reason instanceof Error ? reason.message : 'Не удалось принять решение.') }
  }

  const createPlayer = async () => {
    if (isSubmittingPlayer) return
    setSubmittingPlayer(true); setPlayersError('')
    try {
      const response = await fetch('/api/players', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, minecraftUuid, note: playerNote, issuePassport }) })
      const payload = await response.json().catch(() => ({})) as { player?: RegistryPlayer; error?: string }
      if (!response.ok || !payload.player) throw new Error(payload.error ?? 'Не удалось зарегистрировать игрока.')
      setPlayers((current) => [payload.player!, ...current])
      setNickname(''); setMinecraftUuid(''); setPlayerNote(''); setIssuePassport(true)
    } catch (reason) { setPlayersError(reason instanceof Error ? reason.message : 'Не удалось зарегистрировать игрока.') } finally { setSubmittingPlayer(false) }
  }

  const savePlayerEdit = async (id: string, data: { nickname: string; minecraftUuid: string; note: string }) => {
    const response = await fetch(`/api/players/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const payload = await response.json().catch(() => ({})) as { player?: RegistryPlayer; error?: string }
    if (!response.ok || !payload.player) throw new Error(payload.error ?? 'Не удалось сохранить игрока.')
    setPlayers((current) => current.map((item) => item.id === id ? payload.player! : item))
    setEditingPlayer(null)
  }

  const mutatePlayer = async (id: string, path: string, body?: unknown) => {
    setBusyPlayerId(id); setPlayersError('')
    try {
      const response = await fetch(`/api/players/${id}${path}`, { method: 'POST', credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      const payload = await response.json().catch(() => ({})) as { player?: RegistryPlayer; error?: string }
      if (!response.ok || !payload.player) throw new Error(payload.error ?? 'Операция не выполнена.')
      setPlayers((current) => current.map((item) => item.id === id ? payload.player! : item))
    } catch (reason) { setPlayersError(reason instanceof Error ? reason.message : 'Операция не выполнена.') } finally { setBusyPlayerId(null) }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      if (confirm.kind === 'decision') {
        const response = await fetch(`/api/council/decisions/${confirm.id}`, { method: 'DELETE', credentials: 'include' })
        if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? 'Не удалось удалить решение.') }
        setDecisions((current) => current.filter((item) => item.id !== confirm.id))
      } else {
        const response = await fetch(`/api/players/${confirm.id}`, { method: 'DELETE', credentials: 'include' })
        if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? 'Не удалось удалить игрока.') }
        setPlayers((current) => current.filter((item) => item.id !== confirm.id))
      }
      setConfirm(null)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Операция не выполнена.'
      if (confirm.kind === 'decision') setCouncilError(message); else setPlayersError(message)
      setConfirm(null)
    } finally { setConfirmBusy(false) }
  }

  const changePassword = async () => {
    if (passwordState === 'saving') return
    setPasswordState('saving'); setPasswordError('')
    try {
      const response = await fetch('/api/auth/change-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Не удалось обновить пароль.')
      setCurrentPassword(''); setNewPassword(''); setPasswordState('saved')
    } catch (reason) { setPasswordState('error'); setPasswordError(reason instanceof Error ? reason.message : 'Не удалось обновить пароль.') }
  }

  return (
    <main className="sonar-workspace">
      <aside className={`sonar-sidebar ${isMenuOpen ? 'sonar-sidebar-open' : ''}`}>
        <div className="sonar-sidebar-top">
          <button className="sonar-wordmark" type="button" onClick={() => navigate('overview')} aria-label="Открыть обзор СОНАР"><span><SonarMark /></span><strong>СОНАР</strong></button>
          <button className="sonar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню"><WorkspaceIcon name="close" /></button>
        </div>
        <div className="sonar-scope"><PelgradMark /><span><small>Государственный контур</small><b>Пельград</b></span></div>
        <nav className="sonar-nav" aria-label="Разделы СОНАР">
          <p>Рабочее пространство</p>
          {navigation.map((item) => (
            <button className={section === item.id ? 'is-active' : ''} key={item.id} type="button" onClick={() => navigate(item.id)}><span><WorkspaceIcon name={item.icon} /></span>{item.label}</button>
          ))}
        </nav>
        <div className="sonar-sidebar-bottom"><PelgariaMark /><span><small>Игровой мир</small><b>Пельгария</b></span></div>
      </aside>
      {isMenuOpen && <button className="sonar-sidebar-scrim" type="button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}

      <section className="sonar-content">
        <header className="sonar-topbar">
          <button className="sonar-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню"><WorkspaceIcon name="menu" /></button>
          <div className="sonar-breadcrumb"><span>СОНАР</span><i /> <b>{activeItem.label}</b></div>
          <div className="sonar-top-actions"><span className="sonar-online"><i /> Контур доступен</span><span className="sonar-account"><b>{account.login}</b><small>{isChairman ? 'Председатель' : 'Оператор'}</small></span><button className="sonar-logout" type="button" onClick={onLogout}>Выйти</button><button className="sonar-back" type="button" onClick={onExit}>Пельгария <WorkspaceIcon name="arrow" /></button></div>
        </header>

        {section === 'registry' ? (
          <section className="sonar-council-page sonar-registry-page">
            <div className="sonar-council-heading">
              <div><p>Гражданская канцелярия</p><h1>Реестр игроков</h1><span>Каждый игрок может получить единственный активный паспорт с подписанным QR-кодом. Номер паспорта не порядковый и не подбирается. Записи можно редактировать и отзывать.</span></div>
              <PelgariaMark />
            </div>

            {isChairman && (
              <section className="s-card s-create">
                <div className="s-create-head"><p>Новая запись</p><h2>Зарегистрировать игрока</h2></div>
                <div className="s-form-grid">
                  <label className="s-field"><span>Minecraft-ник<i>обязательно</i></span><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={16} placeholder="Например, PelgariaPlayer" /><small className="s-field-hint">3–16 символов: латиница, цифры, _</small></label>
                  <label className="s-field"><span>UUID<i>необязательно</i></span><input value={minecraftUuid} onChange={(event) => setMinecraftUuid(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />{minecraftUuid.trim() && !UUID_PATTERN.test(minecraftUuid.trim()) && <small className="s-field-hint is-error">Неверный формат UUID</small>}</label>
                  <label className="s-field s-field--wide"><span>Служебная заметка<i>не в паспорте</i></span><textarea value={playerNote} onChange={(event) => setPlayerNote(event.target.value)} maxLength={500} placeholder="Видна только в СОНАР" /></label>
                </div>
                <div className="s-create-foot">
                  <Toggle checked={issuePassport} onChange={setIssuePassport} label="Сразу выдать паспорт" hint={issuePassport ? 'Будет создан паспорт с QR' : 'Паспорт можно выдать позже'} />
                  <button type="button" className="s-btn s-btn--accent" disabled={nickname.trim().length < 3 || (minecraftUuid.trim().length > 0 && !UUID_PATTERN.test(minecraftUuid.trim())) || isSubmittingPlayer} onClick={createPlayer}>{isSubmittingPlayer ? <><WorkspaceIcon name="spinner" /> Регистрируем…</> : <><WorkspaceIcon name="plus" /> Создать запись</>}</button>
                </div>
              </section>
            )}

            {playersError && <p className="s-banner s-banner--error">{playersError}</p>}

            <div className="s-list">
              {isPlayersLoading ? (
                <div className="s-empty">Загружаем реестр игроков…</div>
              ) : players.length === 0 ? (
                <div className="s-empty"><WorkspaceIcon name="archive" /><b>Реестр пуст</b><span>Первый игрок получит первый паспорт нового Пельграда.</span></div>
              ) : players.map((player) => {
                const status = player.passport?.status
                return (
                  <article className="s-record s-record--player" key={player.id}>
                    <div className="s-avatar">{player.nickname.slice(0, 1).toUpperCase()}</div>
                    <div className="s-record-main">
                      <div className="s-record-title"><h3>{player.nickname}</h3>{status === 'ACTIVE' ? <span className="s-badge s-badge--ok"><i />Паспорт активен</span> : status === 'REVOKED' ? <span className="s-badge s-badge--warn"><i />Паспорт отозван</span> : <span className="s-badge s-badge--muted"><i />Без паспорта</span>}</div>
                      <div className="s-meta">
                        <span className="s-mono">{player.passport?.number ?? 'паспорт не выдан'}</span>
                        <span className="s-meta-dot" />
                        <span className="s-mono s-dim">{player.minecraft_uuid ?? 'UUID не указан'}</span>
                      </div>
                      {player.note && <p className="s-note">{player.note}</p>}
                    </div>
                    {isChairman && (
                      <div className="s-actions">
                        {player.passport ? (
                          <>
                            <button type="button" className="s-btn s-btn--ghost" onClick={() => window.open(`/api/players/${player.id}/passport.pdf`, '_blank', 'noopener,noreferrer')}><WorkspaceIcon name="print" /> Паспорт</button>
                            {status === 'ACTIVE'
                              ? <IconButton icon="revoke" tone="danger" label="Отозвать паспорт" busy={busyPlayerId === player.id} onClick={() => mutatePlayer(player.id, '/passport/status', { status: 'REVOKED' })} />
                              : <IconButton icon="restore" tone="accent" label="Восстановить паспорт" busy={busyPlayerId === player.id} onClick={() => mutatePlayer(player.id, '/passport/status', { status: 'ACTIVE' })} />}
                          </>
                        ) : (
                          <button type="button" className="s-btn s-btn--accent" disabled={busyPlayerId === player.id} onClick={() => mutatePlayer(player.id, '/passport')}><WorkspaceIcon name={busyPlayerId === player.id ? 'spinner' : 'passport'} /> Выдать паспорт</button>
                        )}
                        <IconButton icon="edit" label="Изменить" onClick={() => setEditingPlayer(player)} />
                        <IconButton icon="trash" tone="danger" label="Удалить игрока" onClick={() => setConfirm({ kind: 'player', id: player.id, name: player.nickname })} />
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        ) : section === 'council' ? (
          <section className="sonar-council-page">
            <div className="sonar-council-heading">
              <div><p>Высший контур управления</p><h1>Журнал решений</h1><span>Решения Верховного Совета формируют курс Пельграда. Черновик становится действующим только после принятия Председателем.</span></div>
              <CouncilMark />
            </div>

            {isChairman && (
              <section className="s-card s-create">
                <div className="s-create-head"><p>Новое решение</p><h2>Зафиксировать курс</h2></div>
                <div className="s-form-grid">
                  <label className="s-field s-field--wide"><span>Заголовок<i>3–160 символов</i></span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} maxLength={160} placeholder="Краткое название решения" /></label>
                  <label className="s-field s-field--wide"><span>Содержание<i>что решено и почему</i></span><textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} maxLength={12000} placeholder="Развёрнутая формулировка решения" /></label>
                </div>
                <div className="s-create-foot s-create-foot--end">
                  <button type="button" className="s-btn s-btn--accent" disabled={draftTitle.trim().length < 3 || draftBody.trim().length < 10 || isSubmittingDecision} onClick={createDecision}>{isSubmittingDecision ? <><WorkspaceIcon name="spinner" /> Сохраняем…</> : <><WorkspaceIcon name="plus" /> Создать черновик</>}</button>
                </div>
              </section>
            )}

            {councilError && <p className="s-banner s-banner--error">{councilError}</p>}

            <div className="s-list" aria-live="polite">
              {isCouncilLoading ? (
                <div className="s-empty">Загружаем журнал решений…</div>
              ) : decisions.length === 0 ? (
                <div className="s-empty"><WorkspaceIcon name="council" /><b>Журнал пока чист</b><span>Первое решение станет точкой отсчёта нового Пельграда.</span></div>
              ) : decisions.map((decision) => (
                <article className={`s-record s-record--decision ${decision.status === 'ADOPTED' ? 'is-adopted' : ''}`} key={decision.id}>
                  <div className="s-decision-side">
                    <span className="s-decision-no">ВС-{String(decision.number).padStart(4, '0')}</span>
                    {decision.status === 'ADOPTED' ? <span className="s-badge s-badge--ok"><i />Принято</span> : <span className="s-badge s-badge--muted"><i />Черновик</span>}
                  </div>
                  <div className="s-record-main">
                    <h3>{decision.title}</h3>
                    <p className="s-decision-body">{decision.body}</p>
                    <div className="s-record-foot"><span>Подготовил: <b>{decision.author.login}</b></span><span className="s-meta-dot" /><time>{new Date(decision.created_at).toLocaleDateString('ru-RU')}</time></div>
                  </div>
                  {isChairman && (
                    <div className="s-actions s-actions--top">
                      {decision.status === 'DRAFT' && <button type="button" className="s-btn s-btn--accent" onClick={() => adoptDecision(decision.id)}><WorkspaceIcon name="check" /> Принять</button>}
                      <IconButton icon="edit" label="Изменить" onClick={() => setEditingDecision(decision)} />
                      <IconButton icon="trash" tone="danger" label="Удалить решение" onClick={() => setConfirm({ kind: 'decision', id: decision.id, name: `ВС-${String(decision.number).padStart(4, '0')}` })} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : sectionDetails ? (
          <section className="sonar-stage">
            <div className="sonar-stage-icon"><WorkspaceIcon name={activeItem.icon} /></div>
            <p>{sectionDetails.eyebrow}</p>
            <h1>{sectionDetails.title}</h1>
            <div className="sonar-stage-copy"><span>Новый контур</span><p>{sectionDetails.description}</p></div>
            <div className="sonar-stage-next"><WorkspaceIcon name="check" /><span>{sectionDetails.next}</span></div>
            {section === 'system' && (
              <section className="sonar-password-panel" aria-label="Безопасность учётной записи">
                <div><p>Учётная запись</p><h2>Сменить пароль</h2><span>Используйте новый пароль длиной не менее 12 символов. Остальные сеансы будут завершены.</span></div>
                <div className="sonar-password-fields">
                  <label>Текущий пароль<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  <label>Новый пароль<input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <button type="button" onClick={changePassword} disabled={!currentPassword || newPassword.length < 12 || passwordState === 'saving'}>{passwordState === 'saving' ? 'Обновляем...' : 'Обновить пароль'}</button>
                  {passwordState === 'saved' && <p className="sonar-password-success">Пароль обновлён.</p>}
                  {passwordState === 'error' && <p className="sonar-password-error">{passwordError}</p>}
                </div>
              </section>
            )}
          </section>
        ) : (
          <>
            <section className="sonar-hero">
              <div><p>Система Организации Надзора и Администрирования Реестра</p><h1>СОНАР<br /><em>нового цикла.</em></h1><span>Рабочая среда Пельграда создаётся заново: меньше показной бюрократии, больше ясности о том, что действительно существует и работает.</span></div>
              <div className="sonar-hero-signal" aria-hidden="true"><span /><span /><span /><b><SonarMark /></b></div>
            </section>
            <section className="sonar-readiness">
              <div><p>Этап 01</p><h2>Основание системы</h2><span>Структура определена. Операционные модули запускаются последовательно.</span></div>
              <div className="sonar-readiness-list"><p><i /><b>Мир и государство</b><span>Зафиксированы</span></p><p><i /><b>Верховный Совет</b><span>В работе</span></p><p><i /><b>Реестр игроков</b><span>В работе</span></p></div>
            </section>
            <section className="sonar-modules">
              <div className="sonar-section-head"><div><p>Первые модули</p><h2>Система растёт<br />по реальным потребностям.</h2></div><span>01 / 04</span></div>
              <div className="sonar-module-grid">
                <button type="button" className="sonar-module-card s-module-link" onClick={() => navigate('council')}>
                  <div className="sonar-module-icon"><WorkspaceIcon name="council" /></div>
                  <div className="sonar-module-head"><h3>Верховный Совет</h3><span>Открыто</span></div>
                  <p>Решения, состав и направление развития Пельграда.</p>
                  <div className="sonar-module-foot"><span>Перейти</span><WorkspaceIcon name="arrow" /></div>
                </button>
                <button type="button" className="sonar-module-card s-module-link" onClick={() => navigate('registry')}>
                  <div className="sonar-module-icon"><WorkspaceIcon name="archive" /></div>
                  <div className="sonar-module-head"><h3>Реестр игроков</h3><span>Открыто</span></div>
                  <p>Игроки, паспорта и подписанные QR-документы.</p>
                  <div className="sonar-module-foot"><span>Перейти</span><WorkspaceIcon name="arrow" /></div>
                </button>
                <article className="sonar-module-card">
                  <div className="sonar-module-icon"><WorkspaceIcon name="building" /></div>
                  <div className="sonar-module-head"><h3>Ведомства</h3><span>Подготовка</span></div>
                  <p>Понятная структура полномочий и ответственности.</p>
                  <div className="sonar-module-foot"><span>Планирование</span><WorkspaceIcon name="arrow" /></div>
                </article>
              </div>
            </section>
          </>
        )}
        <footer className="sonar-footer"><span>СОНАР · Пельград</span><span>Вымышленная система Minecraft Role Play</span></footer>
      </section>

      {editingDecision && <DecisionEditor decision={editingDecision} onClose={() => setEditingDecision(null)} onSave={saveDecisionEdit} />}
      {editingPlayer && <PlayerEditor player={editingPlayer} onClose={() => setEditingPlayer(null)} onSave={savePlayerEdit} />}
      {confirm && (
        <Modal title={confirm.kind === 'decision' ? 'Удалить решение?' : 'Удалить игрока?'} eyebrow="Действие необратимо" onClose={() => !confirmBusy && setConfirm(null)}
          footer={<><button type="button" className="s-btn s-btn--ghost" disabled={confirmBusy} onClick={() => setConfirm(null)}>Отмена</button><button type="button" className="s-btn s-btn--danger" disabled={confirmBusy} onClick={runConfirm}>{confirmBusy ? <><WorkspaceIcon name="spinner" /> Удаляем…</> : <><WorkspaceIcon name="trash" /> Удалить</>}</button></>}>
          <p className="s-confirm-text">{confirm.kind === 'decision' ? <>Решение <b>{confirm.name}</b> будет удалено без возможности восстановления.</> : <>Запись игрока <b>{confirm.name}</b> и связанный паспорт будут удалены без возможности восстановления.</>}</p>
        </Modal>
      )}
    </main>
  )
}

function DecisionEditor({ decision, onClose, onSave }: { decision: CouncilDecision; onClose: () => void; onSave: (id: string, title: string, body: string) => Promise<void> }) {
  const [title, setTitle] = useState(decision.title)
  const [body, setBody] = useState(decision.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setBusy(true); setError('')
    try { await onSave(decision.id, title, body) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить.'); setBusy(false) }
  }
  return (
    <Modal title={`Решение ВС-${String(decision.number).padStart(4, '0')}`} eyebrow="Редактирование" onClose={() => !busy && onClose()}
      footer={<><button type="button" className="s-btn s-btn--ghost" disabled={busy} onClick={onClose}>Отмена</button><button type="button" className="s-btn s-btn--accent" disabled={title.trim().length < 3 || body.trim().length < 10 || busy} onClick={submit}>{busy ? <><WorkspaceIcon name="spinner" /> Сохраняем…</> : <><WorkspaceIcon name="check" /> Сохранить</>}</button></>}>
      <label className="s-field"><span>Заголовок</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></label>
      <label className="s-field"><span>Содержание</span><textarea className="s-textarea-tall" value={body} onChange={(event) => setBody(event.target.value)} maxLength={12000} /></label>
      {error && <p className="s-banner s-banner--error">{error}</p>}
    </Modal>
  )
}

function PlayerEditor({ player, onClose, onSave }: { player: RegistryPlayer; onClose: () => void; onSave: (id: string, data: { nickname: string; minecraftUuid: string; note: string }) => Promise<void> }) {
  const [nickname, setNickname] = useState(player.nickname)
  const [minecraftUuid, setMinecraftUuid] = useState(player.minecraft_uuid ?? '')
  const [note, setNote] = useState(player.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const uuidInvalid = minecraftUuid.trim().length > 0 && !UUID_PATTERN.test(minecraftUuid.trim())
  const submit = async () => {
    setBusy(true); setError('')
    try { await onSave(player.id, { nickname, minecraftUuid, note }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить.'); setBusy(false) }
  }
  return (
    <Modal title={player.nickname} eyebrow="Редактирование игрока" onClose={() => !busy && onClose()}
      footer={<><button type="button" className="s-btn s-btn--ghost" disabled={busy} onClick={onClose}>Отмена</button><button type="button" className="s-btn s-btn--accent" disabled={nickname.trim().length < 3 || uuidInvalid || busy} onClick={submit}>{busy ? <><WorkspaceIcon name="spinner" /> Сохраняем…</> : <><WorkspaceIcon name="check" /> Сохранить</>}</button></>}>
      <label className="s-field"><span>Minecraft-ник</span><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={16} /><small className="s-field-hint">Изменение ника не меняет номер паспорта и его QR-код.</small></label>
      <label className="s-field"><span>UUID</span><input value={minecraftUuid} onChange={(event) => setMinecraftUuid(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />{uuidInvalid && <small className="s-field-hint is-error">Неверный формат UUID</small>}</label>
      <label className="s-field"><span>Служебная заметка</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label>
      {error && <p className="s-banner s-banner--error">{error}</p>}
    </Modal>
  )
}
