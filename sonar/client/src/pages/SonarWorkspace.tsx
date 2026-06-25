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
  | 'search' | 'users' | 'scroll' | 'clock'
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

const institutionCards: Array<{ title: string; short: string; duty: string; records: string[]; tone: 'blue' | 'green' | 'amber' | 'red' }> = [
  {
    title: 'Верховный Совет',
    short: 'курс и решения',
    duty: 'утверждает структуру власти, принимает решения, назначает ответственных и держит систему управляемой.',
    records: ['решения ВС', 'назначения', 'структура ведомств', 'важные обращения'],
    tone: 'blue',
  },
  {
    title: 'Гражданская канцелярия',
    short: 'люди и документы',
    duty: 'оформляет гражданскую жизнь: игроков, паспорта, статусы, первичные обращения и базовые записи.',
    records: ['паспорта', 'статусы игроков', 'регистрация', 'гражданские заявления'],
    tone: 'green',
  },
  {
    title: 'Палата развития',
    short: 'город и ресурсы',
    duty: 'ведёт развитие Пельграда: участки, строительство, инфраструктуру, экономику и казну.',
    records: ['участки', 'строения', 'налоги', 'инфраструктурные заявки'],
    tone: 'amber',
  },
  {
    title: 'Внутренний Контур',
    short: 'порядок внутри',
    duty: 'разбирает жалобы, нарушения, конфликты, наказания и контроль действий госслужащих.',
    records: ['жалобы', 'дела', 'наказания', 'служебные проверки'],
    tone: 'red',
  },
  {
    title: 'Комитет Внешнего Сдерживания',
    short: 'границы и угрозы',
    duty: 'наблюдает за Внешними Землями и не даёт свободе превратиться в угрозу Пельграду.',
    records: ['внешние группы', 'инциденты', 'статусы угроз', 'операции'],
    tone: 'blue',
  },
]

const operatingStatuses = [
  ['Сессия', 'активна'],
  ['Публичная проверка', 'доступна'],
  ['Совет', 'журнал работает'],
  ['Реестр игроков', 'паспорта и QR'],
  ['Ведомства', 'структура заложена'],
]

const commandCards: Array<{ section: WorkspaceSection; icon: IconName; title: string; text: string; meta: string }> = [
  { section: 'council', icon: 'council', title: 'Открыть журнал решений', text: 'Принять черновик, найти постановление или оформить новый курс.', meta: 'Совет' },
  { section: 'registry', icon: 'passport', title: 'Работать с игроком', text: 'Найти запись, выдать паспорт, отозвать документ или обновить UUID.', meta: 'Реестр' },
  { section: 'institutions', icon: 'building', title: 'Проверить зону ответственности', text: 'Быстро понять, какое ведомство должно вести обращение.', meta: 'Ведомства' },
  { section: 'system', icon: 'settings', title: 'Проверить контур доступа', text: 'Состояние системы, безопасность учётной записи и правила работы.', meta: 'Система' },
]

const pulseItems = [
  ['Запись', 'каждое действие оставляет проверяемый след'],
  ['Документ', 'паспорт и решение имеют номер, автора и статус'],
  ['Доступ', 'служебные действия отделены от публичной проверки'],
]

const workflowSteps = [
  ['01', 'Принять сигнал', 'обращение, поручение, инцидент или решение попадает в рабочий контур'],
  ['02', 'Уточнить статус', 'оператор выбирает ведомство, ответственного и следующий шаг'],
  ['03', 'Зафиксировать', 'СОНАР сохраняет запись, документ, дату и служебный контекст'],
  ['04', 'Закрыть цикл', 'решение принято, паспорт выдан, дело переведено в проверяемое состояние'],
]

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
    case 'search': return <svg viewBox="0 0 24 24" {...common}><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
    case 'users': return <svg viewBox="0 0 24 24" {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19A5.5 5.5 0 0 1 14.5 19M16 6.2A3 3 0 0 1 16 11.8M20.5 19A5 5 0 0 0 17 14.4" /></svg>
    case 'scroll': return <svg viewBox="0 0 24 24" {...common}><path d="M7 4H17A2 2 0 0 1 19 6V18A2 2 0 0 0 21 20H8A2 2 0 0 1 6 18V6M6 6A2 2 0 0 0 3 7.5A1.5 1.5 0 0 0 6 9M10 9H15M10 13H15" /></svg>
    case 'clock': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12L15 14" /></svg>
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

function FoundersEgg({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  const stars = Array.from({ length: 34 }, (_, index) => ({
    left: (index * 53) % 100,
    top: (index * 29) % 62,
    size: 1 + (index % 3),
    delay: (index % 7) * 0.4,
    dur: 2.4 + (index % 5) * 0.5,
  }))
  return (
    <div className="egg-scrim" onMouseDown={onClose}>
      <div className="egg" role="dialog" aria-modal="true" aria-label="О создателях Пельгарии" onMouseDown={(event) => event.stopPropagation()}>
        <div className="egg-sky" aria-hidden="true">
          <span className="egg-orbit egg-orbit-a" />
          <span className="egg-orbit egg-orbit-b" />
          <span className="egg-glow" />
          {stars.map((star, index) => (
            <i key={index} className="egg-star" style={{ left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size, animationDelay: `${star.delay}s`, animationDuration: `${star.dur}s` }} />
          ))}
        </div>
        <button type="button" className="egg-close" onClick={onClose} aria-label="Закрыть"><WorkspaceIcon name="close" /></button>
        <div className="egg-body">
          <p className="egg-eyebrow">✦ Пасхалка · основание мира</p>
          <h2>Трое, с которых<br />началась Пельгария</h2>
          <div className="egg-stage" aria-hidden="true">
            <svg viewBox="0 0 360 210" className="egg-figures" role="img" aria-label="Три силуэта разного роста">
              <defs>
                <linearGradient id="eggFig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#bfe0ff" /><stop offset="1" stopColor="#5aa0ee" />
                </linearGradient>
                <radialGradient id="eggHorizon" cx="0.5" cy="1" r="0.9">
                  <stop offset="0" stopColor="rgba(125,196,255,.55)" /><stop offset="1" stopColor="rgba(125,196,255,0)" />
                </radialGradient>
                <filter id="eggSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" /></filter>
              </defs>
              <ellipse cx="180" cy="188" rx="150" ry="26" fill="url(#eggHorizon)" />
              <polyline points="92,96 180,70 268,108" fill="none" stroke="rgba(190,224,255,.5)" strokeWidth="1" strokeDasharray="2 5" strokeLinecap="round" />
              <g className="egg-fig egg-fig-a">
                <g fill="url(#eggFig)" opacity=".35" filter="url(#eggSoft)"><circle cx="92" cy="96" r="13" /><rect x="76" y="106" width="32" height="78" rx="16" /></g>
                <circle cx="92" cy="96" r="12" fill="url(#eggFig)" /><rect x="77" y="106" width="30" height="78" rx="15" fill="url(#eggFig)" />
              </g>
              <g className="egg-fig egg-fig-b">
                <g fill="url(#eggFig)" opacity=".35" filter="url(#eggSoft)"><circle cx="180" cy="68" r="15" /><rect x="162" y="80" width="36" height="104" rx="18" /></g>
                <circle cx="180" cy="68" r="14" fill="url(#eggFig)" /><rect x="163" y="80" width="34" height="104" rx="17" fill="url(#eggFig)" />
              </g>
              <g className="egg-fig egg-fig-c">
                <g fill="url(#eggFig)" opacity=".35" filter="url(#eggSoft)"><circle cx="268" cy="108" r="12" /><rect x="253" y="117" width="30" height="67" rx="15" /></g>
                <circle cx="268" cy="108" r="11" fill="url(#eggFig)" /><rect x="254" y="117" width="28" height="67" rx="14" fill="url(#eggFig)" />
              </g>
              <g className="egg-spark"><path d="M180 40 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2z" fill="#dff0ff" /></g>
            </svg>
          </div>
          <p className="egg-text">Эти трое друзей — разного роста, одного дела — создали <b>Пельменьград</b>, свой первый общий мир. Пельгария родилась из него: тот же дух дружбы, только размах больше.</p>
          <div className="egg-lineage" aria-label="Пельменьград — предок Пельгарии"><span>Пельменьград</span><i><WorkspaceIcon name="arrow" /></i><span className="is-now">Пельгария</span></div>
          <p className="egg-sign">потомок одного тёплого проекта</p>
        </div>
      </div>
    </div>
  )
}

function StatStrip({ items }: { items: Array<{ icon: IconName; label: string; value: number; tone?: 'accent' | 'ok' | 'warn' | 'muted' }> }) {
  return (
    <div className="s-stats">
      {items.map((item) => (
        <div className={`s-stat s-stat--${item.tone ?? 'accent'}`} key={item.label}>
          <span className="s-stat-icon"><WorkspaceIcon name={item.icon} /></span>
          <span className="s-stat-body"><b>{item.value}</b><small>{item.label}</small></span>
        </div>
      ))}
    </div>
  )
}

function FilterChips<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<{ id: T; label: string; count: number }> }) {
  return (
    <div className="s-chips" role="tablist">
      {options.map((option) => (
        <button type="button" key={option.id} role="tab" aria-selected={value === option.id} className={`s-chip ${value === option.id ? 'is-active' : ''}`} onClick={() => onChange(option.id)}>
          {option.label}<span>{option.count}</span>
        </button>
      ))}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="s-search">
      <WorkspaceIcon name="search" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" />
      {value && <button type="button" className="s-search-clear" onClick={() => onChange('')} aria-label="Очистить"><WorkspaceIcon name="close" /></button>}
    </div>
  )
}

export function SonarWorkspace({ account, onExit, onLogout }: { account: SonarAccount; onExit: () => void; onLogout: () => void }) {
  const isChairman = account.role === 'CHAIRMAN'
  const [section, setSection] = useState<WorkspaceSection>('overview')
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isEggOpen, setEggOpen] = useState(false)
  const [isFocusMode, setFocusMode] = useState(false)
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
  const [decisionQuery, setDecisionQuery] = useState('')
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'adopted' | 'draft'>('all')
  const [showDecisionForm, setShowDecisionForm] = useState(false)

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
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerFilter, setPlayerFilter] = useState<'all' | 'active' | 'revoked' | 'none'>('all')
  const [showPlayerForm, setShowPlayerForm] = useState(false)

  const [confirm, setConfirm] = useState<{ kind: 'decision' | 'player'; id: string; name: string } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const navigate = (next: WorkspaceSection) => { setSection(next); setMenuOpen(false) }
  const activeItem = navigation.find((item) => item.id === section)!

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
      setDraftTitle(''); setDraftBody(''); setShowDecisionForm(false)
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
      setNickname(''); setMinecraftUuid(''); setPlayerNote(''); setIssuePassport(true); setShowPlayerForm(false)
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

  const decisionAdopted = decisions.filter((item) => item.status === 'ADOPTED').length
  const decisionDrafts = decisions.length - decisionAdopted
  const decisionQ = decisionQuery.trim().toLowerCase()
  const visibleDecisions = decisions.filter((item) => {
    if (decisionFilter === 'adopted' && item.status !== 'ADOPTED') return false
    if (decisionFilter === 'draft' && item.status !== 'DRAFT') return false
    if (!decisionQ) return true
    return item.title.toLowerCase().includes(decisionQ) || item.body.toLowerCase().includes(decisionQ) || `вс-${String(item.number).padStart(4, '0')}`.includes(decisionQ)
  })

  const playersActive = players.filter((item) => item.passport?.status === 'ACTIVE').length
  const playersRevoked = players.filter((item) => item.passport?.status === 'REVOKED').length
  const playersNoPass = players.filter((item) => !item.passport).length
  const playerQ = playerQuery.trim().toLowerCase()
  const visiblePlayers = players.filter((item) => {
    if (playerFilter === 'active' && item.passport?.status !== 'ACTIVE') return false
    if (playerFilter === 'revoked' && item.passport?.status !== 'REVOKED') return false
    if (playerFilter === 'none' && item.passport) return false
    if (!playerQ) return true
    return item.nickname.toLowerCase().includes(playerQ) || (item.minecraft_uuid ?? '').toLowerCase().includes(playerQ) || (item.passport?.number ?? '').toLowerCase().includes(playerQ) || (item.note ?? '').toLowerCase().includes(playerQ)
  })

  return (
    <main className={`sonar-workspace ${isFocusMode ? 'is-focus-mode' : ''}`}>
      <aside className={`sonar-sidebar ${isMenuOpen ? 'sonar-sidebar-open' : ''}`}>
        <div className="sonar-sidebar-top">
          <div className="sonar-brand">
            <button className="sonar-brand-mark" type="button" onClick={() => setEggOpen(true)} aria-label="О создателях Пельгарии" title="✦"><SonarMark /></button>
            <button className="sonar-brand-name" type="button" onClick={() => navigate('overview')} aria-label="Открыть обзор СОНАР"><strong>СОНАР</strong><small>контур управления</small></button>
          </div>
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
          <div className="sonar-top-actions">
            <span className="sonar-online"><i /> Контур доступен</span>
            <span className="sonar-account"><b>{account.login}</b><small>{isChairman ? 'Председатель' : 'Оператор'}</small></span>
            <button className={`sonar-focus-toggle ${isFocusMode ? 'is-active' : ''}`} type="button" onClick={() => setFocusMode((value) => !value)}>{isFocusMode ? 'Обычный режим' : 'Фокус'}</button>
            <button className="sonar-logout" type="button" onClick={onLogout}>Выйти</button>
            <button className="sonar-back" type="button" onClick={onExit}>Пельгария <WorkspaceIcon name="arrow" /></button>
          </div>
        </header>

        {section === 'registry' ? (
          <section className="sonar-council-page sonar-registry-page">
            <div className="sonar-council-heading">
              <div><p>Гражданская канцелярия</p><h1>Реестр игроков</h1><span>Каждый игрок может получить единственный активный паспорт с подписанным QR-кодом. Номер паспорта не порядковый и не подбирается. Записи можно редактировать и отзывать.</span></div>
              <PelgariaMark />
            </div>

            {!isPlayersLoading && players.length > 0 && (
              <StatStrip items={[
                { icon: 'users', label: 'Всего игроков', value: players.length, tone: 'accent' },
                { icon: 'passport', label: 'Активные паспорта', value: playersActive, tone: 'ok' },
                { icon: 'revoke', label: 'Отозваны', value: playersRevoked, tone: 'warn' },
                { icon: 'archive', label: 'Без паспорта', value: playersNoPass, tone: 'muted' },
              ]} />
            )}

            {!isPlayersLoading && players.length > 0 && (
              <div className="s-toolbar">
                <SearchBox value={playerQuery} onChange={setPlayerQuery} placeholder="Поиск по нику, UUID, номеру паспорта или заметке" />
                <FilterChips value={playerFilter} onChange={setPlayerFilter} options={[
                  { id: 'all', label: 'Все', count: players.length },
                  { id: 'active', label: 'Активные', count: playersActive },
                  { id: 'revoked', label: 'Отозваны', count: playersRevoked },
                  { id: 'none', label: 'Без паспорта', count: playersNoPass },
                ]} />
                {isChairman && <button type="button" className={`s-btn ${showPlayerForm ? 's-btn--ghost' : 's-btn--accent'} s-toolbar-cta`} onClick={() => setShowPlayerForm((value) => !value)}><WorkspaceIcon name={showPlayerForm ? 'close' : 'plus'} /> {showPlayerForm ? 'Свернуть' : 'Новый игрок'}</button>}
              </div>
            )}

            {isChairman && (showPlayerForm || players.length === 0) && (
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
                <><div className="s-skeleton" /><div className="s-skeleton" /><div className="s-skeleton" /></>
              ) : players.length === 0 ? (
                <div className="s-empty"><WorkspaceIcon name="archive" /><b>Реестр пуст</b><span>Первый игрок получит первый паспорт нового Пельграда.</span></div>
              ) : visiblePlayers.length === 0 ? (
                <div className="s-empty"><WorkspaceIcon name="search" /><b>Ничего не найдено</b><span>Измените поисковый запрос или фильтр.</span></div>
              ) : visiblePlayers.map((player) => {
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

            {!isCouncilLoading && decisions.length > 0 && (
              <StatStrip items={[
                { icon: 'scroll', label: 'Всего решений', value: decisions.length, tone: 'accent' },
                { icon: 'check', label: 'Принято', value: decisionAdopted, tone: 'ok' },
                { icon: 'clock', label: 'Черновики', value: decisionDrafts, tone: 'muted' },
              ]} />
            )}

            {!isCouncilLoading && decisions.length > 0 && (
              <div className="s-toolbar">
                <SearchBox value={decisionQuery} onChange={setDecisionQuery} placeholder="Поиск по заголовку, тексту или номеру ВС" />
                <FilterChips value={decisionFilter} onChange={setDecisionFilter} options={[
                  { id: 'all', label: 'Все', count: decisions.length },
                  { id: 'adopted', label: 'Принятые', count: decisionAdopted },
                  { id: 'draft', label: 'Черновики', count: decisionDrafts },
                ]} />
                {isChairman && <button type="button" className={`s-btn ${showDecisionForm ? 's-btn--ghost' : 's-btn--accent'} s-toolbar-cta`} onClick={() => setShowDecisionForm((value) => !value)}><WorkspaceIcon name={showDecisionForm ? 'close' : 'plus'} /> {showDecisionForm ? 'Свернуть' : 'Новое решение'}</button>}
              </div>
            )}

            {isChairman && (showDecisionForm || decisions.length === 0) && (
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
                <><div className="s-skeleton" /><div className="s-skeleton" /><div className="s-skeleton" /></>
              ) : decisions.length === 0 ? (
                <div className="s-empty"><WorkspaceIcon name="council" /><b>Журнал пока чист</b><span>Первое решение станет точкой отсчёта нового Пельграда.</span></div>
              ) : visibleDecisions.length === 0 ? (
                <div className="s-empty"><WorkspaceIcon name="search" /><b>Ничего не найдено</b><span>Измените поисковый запрос или фильтр.</span></div>
              ) : visibleDecisions.map((decision) => (
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
        ) : section === 'institutions' ? (
          <section className="sonar-departments-page">
            <div className="sonar-workspace-heading">
              <div><p>Структура Пельграда</p><h1>Ведомственный контур</h1><span>Каждый орган получает ясную зону ответственности и типы записей, которые должны проходить через СОНАР.</span></div>
              <div className="sonar-heading-seal"><WorkspaceIcon name="building" /></div>
            </div>
            <div className="sonar-department-grid">
              {institutionCards.map((item) => (
                <article className={`sonar-department-card is-${item.tone}`} key={item.title}>
                  <div><span>{item.short}</span><h2>{item.title}</h2><p>{item.duty}</p></div>
                  <ul>{item.records.map((record) => <li key={record}>{record}</li>)}</ul>
                </article>
              ))}
            </div>
            <section className="sonar-procedure-board">
              <div><p>Базовая процедура</p><h2>Любое действие должно оставить след.</h2></div>
              <ol>
                <li><b>Принять</b><span>получить обращение, решение, инцидент или заявку</span></li>
                <li><b>Классифицировать</b><span>определить ведомство, статус и ответственного</span></li>
                <li><b>Зафиксировать</b><span>создать запись в СОНАР и связать документы</span></li>
                <li><b>Закрыть</b><span>оставить итог, дату, исполнителя и следующий шаг</span></li>
              </ol>
            </section>
          </section>
        ) : section === 'system' ? (
          <section className="sonar-system-page">
            <div className="sonar-workspace-heading">
              <div><p>Служебная устойчивость</p><h1>Состояние системы</h1><span>Здесь собраны базовые признаки готовности СОНАР и управление безопасностью текущей учётной записи.</span></div>
              <div className="sonar-heading-seal"><WorkspaceIcon name="settings" /></div>
            </div>
            <div className="sonar-system-grid">
              <section className="sonar-system-card">
                <p>Операционный статус</p>
                <div className="sonar-system-list">
                  {operatingStatuses.map(([label, value]) => <span key={label}><b>{label}</b><i>{value}</i></span>)}
                </div>
              </section>
              <section className="sonar-system-card sonar-system-card--dark">
                <p>Правило контура</p>
                <h2>СОНАР не заменяет RP, он делает его проверяемым.</h2>
                <span>Система должна фиксировать решения, документы, статусы и ответственность без превращения проекта в мёртвую бюрократию.</span>
              </section>
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
            </div>
          </section>
        ) : (
          <>
            <section className="sonar-command-hero">
              <div className="sonar-stars" aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} />)}</div>
              <div className="sonar-command-copy">
                <p>Система Организации Надзора и Администрирования Реестра</p>
                <h1>СОНАР держит Пельград в рабочем состоянии.</h1>
                <span>Командный контур для решений, паспортов, ведомств и служебной устойчивости. Минимум лишнего текста, максимум быстрых действий и проверяемых записей.</span>
                <div className="sonar-command-actions">
                  <button type="button" onClick={() => navigate('registry')}><WorkspaceIcon name="passport" /> Найти игрока</button>
                  <button type="button" onClick={() => navigate('council')}><WorkspaceIcon name="council" /> Открыть Совет</button>
                </div>
              </div>
              <div className="sonar-command-console" aria-label="Состояние контура">
                <div className="sonar-console-top"><span>PG-CORE</span><b>online</b></div>
                <div className="sonar-radar" aria-hidden="true"><span /><span /><span /><b><SonarMark /></b></div>
                {pulseItems.map(([label, text]) => <div className="sonar-pulse-row" key={label}><strong>{label}</strong><p>{text}</p></div>)}
              </div>
            </section>

            <section className="sonar-command-grid" aria-label="Быстрые действия">
              {commandCards.map((card) => (
                <button type="button" className="sonar-command-card" key={card.title} onClick={() => navigate(card.section)}>
                  <span className="sonar-command-icon"><WorkspaceIcon name={card.icon} /></span>
                  <span><small>{card.meta}</small><b>{card.title}</b><i>{card.text}</i></span>
                  <WorkspaceIcon name="arrow" />
                </button>
              ))}
            </section>

            <section className="sonar-workflow">
              <div className="sonar-section-head"><div><p>Рабочий цикл</p><h2>От события до проверяемой записи.</h2></div><span>04 / 04</span></div>
              <div className="sonar-workflow-grid">
                {workflowSteps.map(([index, title, text]) => <article key={index}><span>{index}</span><h3>{title}</h3><p>{text}</p></article>)}
              </div>
            </section>
          </>
        )}
        <footer className="sonar-footer"><span>СОНАР · Пельград</span><span>Вымышленная система Minecraft Role Play</span></footer>
      </section>

      {isEggOpen && <FoundersEgg onClose={() => setEggOpen(false)} />}
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
