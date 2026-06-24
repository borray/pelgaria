import { PelgariaMark } from '../components/brand/PelgariaMark'
import { SonarMark } from '../components/brand/SonarMark'

const institutions = [
  ['Внутренний Контур', 'Порядок, жалобы, расследования и защита граждан.'],
  ['Палата развития', 'Город, инфраструктура, строительство и экономика.'],
  ['Гражданская канцелярия', 'Гражданская жизнь, новые игроки и процедуры.'],
  ['Комитет Внешнего Сдерживания', 'Границы, Внешние Земли и защита от угроз.'],
]

const externalUnits = ['Гарнизон', 'Разведкорпус', 'Запретная Гвардия']

export function FoundationPage() {
  return (
    <main className="foundation-page">
      <div className="foundation-atmosphere" aria-hidden="true">
        <span className="foundation-orbit foundation-orbit-a" />
        <span className="foundation-orbit foundation-orbit-b" />
        <span className="foundation-orbit foundation-orbit-c" />
        <span className="foundation-signal" />
      </div>

      <header className="foundation-header">
        <a className="foundation-brand" href="#top" aria-label="Пельгария">
          <span><PelgariaMark /></span>
          <strong>ПЕЛЬГАРИЯ</strong>
        </a>
        <div className="foundation-status"><i /> Основание мира · 20.06.2026</div>
      </header>

      <section className="foundation-hero" id="top">
        <p className="foundation-kicker">Minecraft Java · Role Play</p>
        <h1>Мир, где порядок<br />не отменяет свободу.</h1>
        <p className="foundation-lead">
          Пельгария создаётся как живой мир. В нём Пельград даёт игрокам порядок и государственную жизнь,
          а Внешние Земли оставляют место для самостоятельных историй.
        </p>
        <div className="foundation-formula" aria-label="Основная формула Пельгарии">
          <span>Пельгария <b>мир</b></span>
          <i />
          <span>Пельград <b>порядок</b></span>
          <i />
          <span>Внешние Земли <b>свобода</b></span>
        </div>
      </section>

      <section className="foundation-map" aria-label="Устройство мира">
        <article className="foundation-zone foundation-zone-world">
          <span className="foundation-zone-index">01</span>
          <PelgariaMark />
          <div><small>Весь сеттинг</small><h2>Пельгария</h2><p>Игровой мир, в котором могут существовать города, свободные зоны, поселения и истории игроков.</p></div>
        </article>
        <article className="foundation-zone foundation-zone-state">
          <span className="foundation-zone-index">02</span>
          <div className="foundation-state-mark">ПГ</div>
          <div><small>Государственное ядро</small><h2>Пельград</h2><p>Административная RP-республика Верховного Совета, гражданской жизни и понятных правил.</p></div>
        </article>
        <article className="foundation-zone foundation-zone-outside">
          <span className="foundation-zone-index">03</span>
          <div className="foundation-outside-mark" />
          <div><small>Свободная зона</small><h2>Внешние Земли</h2><p>Пространство для независимой жизни без обычной юрисдикции Пельграда, пока нет угрозы миру.</p></div>
        </article>
      </section>

      <section className="foundation-governance">
        <div className="foundation-section-heading">
          <p>Пельград</p>
          <h2>Верховный Совет держит курс,<br />ведомства делают мир живым.</h2>
        </div>
        <div className="foundation-council">
          <div className="foundation-council-title"><span>ВС</span><div><small>Высший орган власти</small><strong>Верховный Совет Пельграда</strong></div></div>
          <p>Председатель Верховного Совета отвечает за устойчивость проекта. Совет утверждает направление развития, структуру власти и важные решения.</p>
        </div>
        <div className="foundation-institutions">
          {institutions.map(([name, description], index) => (
            <article key={name}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="foundation-sonar">
        <div className="foundation-sonar-mark"><SonarMark /></div>
        <div>
          <p>Будущая официальная система Пельграда</p>
          <h2>СОНАР</h2>
          <strong>Система Организации Надзора и Администрирования Реестра</strong>
          <span>Система начинается заново по этой концепции. Старые функции выведены из работы, чтобы новая государственная реальность не выросла из случайных компромиссов.</span>
        </div>
        <aside><i /> Чистый лист<br /><small>Новый цикл проектирования</small></aside>
      </section>

      <section className="foundation-boundary">
        <div><p>Внешний контур</p><h2>Свобода живёт рядом с ответственностью.</h2></div>
        <p>Внешние Земли не требуют участия в государственном RP. Но нападение на Пельград, саботаж и создание угрозы для игроков остаются поводом для вмешательства.</p>
        <div className="foundation-units">{externalUnits.map((unit) => <span key={unit}>{unit}</span>)}</div>
      </section>

      <footer className="foundation-footer">
        <span>Пельгария · Minecraft Role Play</span>
        <span>Это вымышленный игровой мир. Не является государственным сервисом.</span>
      </footer>
    </main>
  )
}
