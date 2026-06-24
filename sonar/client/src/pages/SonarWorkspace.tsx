import { useState } from 'react'
import { CouncilMark } from '../components/brand/CouncilMark'
import { PelgariaMark } from '../components/brand/PelgariaMark'
import { PelgradMark } from '../components/brand/PelgradMark'
import { SonarMark } from '../components/brand/SonarMark'
import type { SonarAccount } from './AuthPage'

type WorkspaceSection = 'overview' | 'council' | 'institutions' | 'registry' | 'system'
type IconName = 'grid' | 'council' | 'building' | 'archive' | 'settings' | 'arrow' | 'menu' | 'close' | 'bell' | 'check'

const navigation: Array<{ id: WorkspaceSection; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Обзор', icon: 'grid' },
  { id: 'council', label: 'Верховный Совет', icon: 'council' },
  { id: 'institutions', label: 'Ведомства', icon: 'building' },
  { id: 'registry', label: 'Реестр мира', icon: 'archive' },
  { id: 'system', label: 'Система', icon: 'settings' },
]

const sectionCopy: Record<Exclude<WorkspaceSection, 'overview'>, { eyebrow: string; title: string; description: string; next: string }> = {
  council: {
    eyebrow: 'Высший контур управления',
    title: 'Верховный Совет',
    description: 'Здесь будет собираться состав Совета, повестки и решения, которые задают курс Пельграда.',
    next: 'Следующим шагом появится состав Совета и журнал решений.',
  },
  institutions: {
    eyebrow: 'Структура Пельграда',
    title: 'Ведомства',
    description: 'Внутренний Контур, Палата развития, Гражданская канцелярия и Комитет Внешнего Сдерживания будут оформлены как самостоятельные рабочие пространства.',
    next: 'Сейчас формируется общая модель полномочий и ответственности.',
  },
  registry: {
    eyebrow: 'Память мира',
    title: 'Реестр мира',
    description: 'В этом месте появятся сущности, которые действительно существуют в Пельгарии: игроки, граждане, поселения, ведомства и решения.',
    next: 'Реестр начнётся только после утверждения единой модели данных.',
  },
  system: {
    eyebrow: 'Состояние контура',
    title: 'Система',
    description: 'СОНАР разворачивается заново. Здесь фиксируются границы текущего этапа, чтобы незавершённые идеи не выглядели готовыми функциями.',
    next: 'Старые модули не подключаются к новому контуру.',
  },
}

function WorkspaceIcon({ name }: { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  if (name === 'grid') return <svg viewBox="0 0 24 24" {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
  if (name === 'council') return <CouncilMark />
  if (name === 'building') return <svg viewBox="0 0 24 24" {...common}><path d="M4 20H20M6 20V8L12 4L18 8V20M9 20V13H15V20M9 10H9.01M15 10H15.01" /></svg>
  if (name === 'archive') return <svg viewBox="0 0 24 24" {...common}><path d="M4 7H20V20H4zM3 4H21V7H3zM9 11H15" /></svg>
  if (name === 'settings') return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15A1.7 1.7 0 0 0 19.74 16.88L19.8 16.94L17.94 18.8L17.88 18.74A1.7 1.7 0 0 0 16 18.4L15.4 18.65A1.7 1.7 0 0 0 14.35 20.2V20.3H9.65V20.2A1.7 1.7 0 0 0 8.6 18.65L8 18.4A1.7 1.7 0 0 0 6.12 18.74L6.06 18.8L4.2 16.94L4.26 16.88A1.7 1.7 0 0 0 4.6 15L4.35 14.4A1.7 1.7 0 0 0 2.8 13.35H2.7V8.65H2.8A1.7 1.7 0 0 0 4.35 7.6L4.6 7A1.7 1.7 0 0 0 4.26 5.12L4.2 5.06L6.06 3.2L6.12 3.26A1.7 1.7 0 0 0 8 3.6L8.6 3.35A1.7 1.7 0 0 0 9.65 1.8V1.7H14.35V1.8A1.7 1.7 0 0 0 15.4 3.35L16 3.6A1.7 1.7 0 0 0 17.88 3.26L17.94 3.2L19.8 5.06L19.74 5.12A1.7 1.7 0 0 0 19.4 7L19.65 7.6A1.7 1.7 0 0 0 21.2 8.65H21.3V13.35H21.2A1.7 1.7 0 0 0 19.65 14.4z" /></svg>
  if (name === 'arrow') return <svg viewBox="0 0 24 24" {...common}><path d="M5 12H19M13 6L19 12L13 18" /></svg>
  if (name === 'menu') return <svg viewBox="0 0 24 24" {...common}><path d="M4 7H20M4 12H20M4 17H20" /></svg>
  if (name === 'close') return <svg viewBox="0 0 24 24" {...common}><path d="M6 6L18 18M18 6L6 18" /></svg>
  if (name === 'bell') return <svg viewBox="0 0 24 24" {...common}><path d="M18 10A6 6 0 0 0 6 10C6 17 3.5 17 3.5 19H20.5C20.5 17 18 17 18 10M10 22H14" /></svg>
  return <svg viewBox="0 0 24 24" {...common}><path d="M5 12L10 17L19 7" /></svg>
}

function ModuleCard({ icon, title, description, status }: { icon: IconName; title: string; description: string; status: string }) {
  return (
    <article className="sonar-module-card">
      <div className="sonar-module-icon"><WorkspaceIcon name={icon} /></div>
      <div className="sonar-module-head"><h3>{title}</h3><span>{status}</span></div>
      <p>{description}</p>
      <div className="sonar-module-foot"><span>Планирование</span><WorkspaceIcon name="arrow" /></div>
    </article>
  )
}

export function SonarWorkspace({ account, onExit, onLogout }: { account: SonarAccount; onExit: () => void; onLogout: () => void }) {
  const [section, setSection] = useState<WorkspaceSection>('overview')
  const [isMenuOpen, setMenuOpen] = useState(false)

  const navigate = (next: WorkspaceSection) => {
    setSection(next)
    setMenuOpen(false)
  }

  const activeItem = navigation.find((item) => item.id === section)!
  const sectionDetails = section === 'overview' ? null : sectionCopy[section]

  return (
    <main className="sonar-workspace">
      <aside className={`sonar-sidebar ${isMenuOpen ? 'sonar-sidebar-open' : ''}`}>
        <div className="sonar-sidebar-top">
          <button className="sonar-wordmark" type="button" onClick={() => navigate('overview')} aria-label="Открыть обзор СОНАР">
            <span><SonarMark /></span><strong>СОНАР</strong>
          </button>
          <button className="sonar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню"><WorkspaceIcon name="close" /></button>
        </div>
        <div className="sonar-scope"><PelgradMark /><span><small>Государственный контур</small><b>Пельград</b></span></div>
        <nav className="sonar-nav" aria-label="Разделы СОНАР">
          <p>Рабочее пространство</p>
          {navigation.map((item) => (
            <button className={section === item.id ? 'is-active' : ''} key={item.id} type="button" onClick={() => navigate(item.id)}>
              <span><WorkspaceIcon name={item.icon} /></span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sonar-sidebar-bottom"><PelgariaMark /><span><small>Игровой мир</small><b>Пельгария</b></span></div>
      </aside>
      {isMenuOpen && <button className="sonar-sidebar-scrim" type="button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}

      <section className="sonar-content">
        <header className="sonar-topbar">
          <button className="sonar-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню"><WorkspaceIcon name="menu" /></button>
          <div className="sonar-breadcrumb"><span>СОНАР</span><i /> <b>{activeItem.label}</b></div>
          <div className="sonar-top-actions"><span className="sonar-online"><i /> Контур доступен</span><span className="sonar-account"><b>{account.login}</b><small>{account.role === 'CHAIRMAN' ? 'Председатель' : 'Оператор'}</small></span><button type="button" aria-label="Уведомления"><WorkspaceIcon name="bell" /></button><button className="sonar-logout" type="button" onClick={onLogout}>Выйти</button><button className="sonar-back" type="button" onClick={onExit}>Пельгария <WorkspaceIcon name="arrow" /></button></div>
        </header>

        {sectionDetails ? (
          <section className="sonar-stage">
            <div className="sonar-stage-icon"><WorkspaceIcon name={activeItem.icon} /></div>
            <p>{sectionDetails.eyebrow}</p>
            <h1>{sectionDetails.title}</h1>
            <div className="sonar-stage-copy"><span>Новый контур</span><p>{sectionDetails.description}</p></div>
            <div className="sonar-stage-next"><WorkspaceIcon name="check" /><span>{sectionDetails.next}</span></div>
          </section>
        ) : (
          <>
            <section className="sonar-hero">
              <div><p>Система Организации Надзора и Администрирования Реестра</p><h1>СОНАР<br /><em>нового цикла.</em></h1><span>Рабочая среда Пельграда создаётся заново: меньше показной бюрократии, больше ясности о том, что действительно существует и работает.</span></div>
              <div className="sonar-hero-signal" aria-hidden="true"><span /><span /><span /><b><SonarMark /></b></div>
            </section>
            <section className="sonar-readiness">
              <div><p>Этап 01</p><h2>Основание системы</h2><span>Структура определена. Операционные модули запускаются последовательно.</span></div>
              <div className="sonar-readiness-list"><p><i /><b>Мир и государство</b><span>Зафиксированы</span></p><p><i /><b>Структура ведомств</b><span>В проектировании</span></p><p><i /><b>Реестры и роли</b><span>Следующий этап</span></p></div>
            </section>
            <section className="sonar-modules">
              <div className="sonar-section-head"><div><p>Первые модули</p><h2>Система будет расти<br />по реальным потребностям.</h2></div><span>01 / 04</span></div>
              <div className="sonar-module-grid">
                <ModuleCard icon="council" title="Верховный Совет" status="Далее" description="Решения, состав и направление развития Пельграда." />
                <ModuleCard icon="building" title="Ведомства" status="Подготовка" description="Понятная структура полномочий и ответственности." />
                <ModuleCard icon="archive" title="Реестр мира" status="После модели" description="Только реальные сущности, без наследия старой системы." />
              </div>
            </section>
          </>
        )}
        <footer className="sonar-footer"><span>СОНАР · Пельград</span><span>Вымышленная система Minecraft Role Play</span></footer>
      </section>
    </main>
  )
}
