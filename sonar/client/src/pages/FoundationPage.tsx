import { useState } from 'react'
import { CouncilMark } from '../components/brand/CouncilMark'
import { PelgariaMark } from '../components/brand/PelgariaMark'
import { PelgradMark } from '../components/brand/PelgradMark'
import { SonarMark } from '../components/brand/SonarMark'

type FoundationPageProps = {
  onOpenSonar: () => void
  onOpenVerify: () => void
}

type RouteId = 'newcomer' | 'citizen' | 'service' | 'outer'
type WorldId = 'pelgaria' | 'pelgrad' | 'outer'

const worldModel: Record<WorldId, { title: string; label: string; text: string; principle: string }> = {
  pelgaria: {
    title: 'Пельгария',
    label: 'Весь мир',
    text: 'Сеттинг Minecraft RP: города, внешние поселения, дороги, свободные зоны, будущие территории и истории игроков.',
    principle: 'Мир шире государства.',
  },
  pelgrad: {
    title: 'Пельград',
    label: 'Государственное ядро',
    text: 'Административная RP-республика Верховного Совета: гражданство, паспорта, ведомства, обращения, участки и решения.',
    principle: 'Порядок должен быть понятным.',
  },
  outer: {
    title: 'Внешние Земли',
    label: 'Свободная территория',
    text: 'Зона для тех, кто не хочет жить по городским процедурам, пока свобода не становится угрозой Пельграду.',
    principle: 'Свобода рядом с ответственностью.',
  },
}

const routes: Record<RouteId, { title: string; forWhom: string; steps: string[] }> = {
  newcomer: {
    title: 'Войти в мир',
    forWhom: 'для нового игрока',
    steps: ['понять устройство мира', 'выбрать Пельград или Внешние Земли', 'получить первый статус', 'зайти в RP без лишней стены'],
  },
  citizen: {
    title: 'Стать жителем Пельграда',
    forWhom: 'для городской жизни',
    steps: ['подать обращение', 'оформить паспорт', 'получить участок или роль', 'участвовать в решениях'],
  },
  service: {
    title: 'Пойти на госслужбу',
    forWhom: 'для сотрудников',
    steps: ['выбрать ведомство', 'получить назначение', 'вести записи в СОНАР', 'закрывать дела и поручения'],
  },
  outer: {
    title: 'Жить вне города',
    forWhom: 'для Внешних Земель',
    steps: ['уйти за обычную юрисдикцию', 'строить свободнее', 'не создавать угрозу', 'оставаться видимым при инцидентах'],
  },
}

const departments = [
  ['Верховный Совет', 'курс, решения, структура власти', 'council'],
  ['Гражданская канцелярия', 'паспорта, обращения, статусы игроков', 'civil'],
  ['Палата развития', 'строительство, участки, экономика', 'build'],
  ['Внутренний Контур', 'жалобы, расследования, наказания', 'order'],
  ['Комитет Внешнего Сдерживания', 'границы, Внешние Земли, угрозы', 'outer'],
]

const sonarRecords = ['решения', 'паспорта', 'обращения', 'статусы', 'наказания', 'внешние инциденты']

export function FoundationPage({ onOpenSonar, onOpenVerify }: FoundationPageProps) {
  const [activeWorld, setActiveWorld] = useState<WorldId>('pelgrad')
  const [activeRoute, setActiveRoute] = useState<RouteId>('newcomer')
  const world = worldModel[activeWorld]
  const route = routes[activeRoute]

  return (
    <main className="foundation-page">
      <div className="foundation-sky" aria-hidden="true">
        {Array.from({ length: 34 }, (_, index) => <i key={index} />)}
        <span className="foundation-orbit foundation-orbit-a" />
        <span className="foundation-orbit foundation-orbit-b" />
      </div>

      <header className="foundation-header">
        <a className="foundation-brand" href="#top" aria-label="Пельгария">
          <span><PelgariaMark /></span>
          <strong>Пельгария</strong>
        </a>
        <nav className="foundation-nav" aria-label="Навигация">
          <a href="#world">Мир</a>
          <a href="#routes">Маршруты</a>
          <a href="#state">Пельград</a>
          <a href="#sonar">СОНАР</a>
        </nav>
        <div className="foundation-actions">
          <button type="button" onClick={onOpenVerify}>Проверить документ</button>
          <button type="button" className="is-primary" onClick={onOpenSonar}>Войти в СОНАР</button>
        </div>
      </header>

      <section className="foundation-hero" id="top">
        <div className="foundation-hero-copy">
          <p>Minecraft Java · Role Play · 20.06.2026</p>
          <h1>Пельгария</h1>
          <span>Живой мир, где Пельград создаёт порядок, Внешние Земли сохраняют свободу, а СОНАР фиксирует государственную реальность без мёртвой бюрократии.</span>
          <div className="foundation-hero-actions">
            <a href="#routes">Выбрать путь</a>
            <button type="button" onClick={onOpenSonar}>Открыть СОНАР</button>
          </div>
        </div>
        <aside className="foundation-hero-panel" aria-label="Формула проекта">
          <div><b>Пельгария</b><span>мир</span></div>
          <div><b>Пельград</b><span>порядок</span></div>
          <div><b>Внешние Земли</b><span>свобода</span></div>
          <div><b>Угроза</b><span>сдерживание</span></div>
        </aside>
      </section>

      <section className="foundation-world" id="world">
        <div className="foundation-section-title">
          <p>Устройство мира</p>
          <h2>Три слоя, которые не надо смешивать.</h2>
        </div>
        <div className="foundation-world-layout">
          <div className="foundation-world-tabs" role="tablist" aria-label="Слои мира">
            {Object.entries(worldModel).map(([id, item]) => (
              <button key={id} type="button" role="tab" aria-selected={activeWorld === id} className={activeWorld === id ? 'is-active' : ''} onClick={() => setActiveWorld(id as WorldId)}>
                <b>{item.title}</b>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <article className={`foundation-world-card is-${activeWorld}`}>
            <div className="foundation-world-mark">
              {activeWorld === 'pelgaria' ? <PelgariaMark /> : activeWorld === 'pelgrad' ? <PelgradMark /> : <span />}
            </div>
            <p>{world.label}</p>
            <h3>{world.title}</h3>
            <strong>{world.text}</strong>
            <span>{world.principle}</span>
          </article>
        </div>
      </section>

      <section className="foundation-routes" id="routes">
        <div className="foundation-section-title">
          <p>Маршруты</p>
          <h2>Сайт сразу говорит игроку, что делать дальше.</h2>
        </div>
        <div className="foundation-route-grid">
          <div className="foundation-route-menu">
            {Object.entries(routes).map(([id, item]) => (
              <button key={id} type="button" className={activeRoute === id ? 'is-active' : ''} onClick={() => setActiveRoute(id as RouteId)}>
                <span>{item.forWhom}</span>
                <b>{item.title}</b>
              </button>
            ))}
          </div>
          <article className="foundation-route-card">
            <p>{route.forWhom}</p>
            <h3>{route.title}</h3>
            <ol>{route.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          </article>
        </div>
      </section>

      <section className="foundation-state" id="state">
        <div className="foundation-section-title">
          <p>Пельград</p>
          <h2>Государство как рабочая система, а не декорация.</h2>
        </div>
        <div className="foundation-council">
          <span><CouncilMark /></span>
          <div>
            <p>Высший контур</p>
            <h3>Верховный Совет Пельграда</h3>
            <strong>Принимает ключевые решения, утверждает ведомства и удерживает проект управляемым, чтобы участие игроков не превращалось в хаос.</strong>
          </div>
        </div>
        <div className="foundation-departments">
          {departments.map(([name, text, tone]) => (
            <article className={`is-${tone}`} key={name}>
              <h3>{name}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="foundation-sonar" id="sonar">
        <div className="foundation-sonar-title">
          <span><SonarMark /></span>
          <div>
            <p>Официальная информационная система</p>
            <h2>СОНАР</h2>
            <strong>Система Организации Надзора и Администрирования Реестра</strong>
          </div>
        </div>
        <div className="foundation-records">
          {sonarRecords.map((record) => <span key={record}>{record}</span>)}
        </div>
        <div className="foundation-sonar-actions">
          <button type="button" onClick={onOpenSonar}>Войти в систему</button>
          <button type="button" onClick={onOpenVerify}>Проверить документ</button>
        </div>
      </section>

      <footer className="foundation-footer">
        <span>Пельгария · Minecraft Role Play</span>
        <span>Вымышленный игровой проект. Не является государственным сервисом.</span>
      </footer>
    </main>
  )
}
