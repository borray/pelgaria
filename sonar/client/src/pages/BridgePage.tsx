import { IconArrowUpRight, IconLock } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { PelgariaMark } from '../components/brand/PelgariaMark'

export function BridgePage() {
  return (
    <main
      className="pelgaria-teaser"
      onPointerMove={(event) => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2
        const y = (event.clientY / window.innerHeight - 0.5) * 2
        event.currentTarget.style.setProperty('--pointer-x', `${x}`)
        event.currentTarget.style.setProperty('--pointer-y', `${y}`)
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty('--pointer-x', '0')
        event.currentTarget.style.setProperty('--pointer-y', '0')
      }}
    >
      <div className="pelgaria-scene" aria-hidden="true">
        <div className="pelgaria-aurora pelgaria-aurora-one" />
        <div className="pelgaria-aurora pelgaria-aurora-two" />
        <div className="pelgaria-stars">
          {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
        </div>
        <div className="pelgaria-signal-line" />
        <div className="pelgaria-orbit">
          <div className="pelgaria-orbit-ring pelgaria-orbit-ring-outer" />
          <div className="pelgaria-orbit-ring pelgaria-orbit-ring-middle" />
          <div className="pelgaria-orbit-ring pelgaria-orbit-ring-inner" />
          <span className="pelgaria-orbit-fragment fragment-one" />
          <span className="pelgaria-orbit-fragment fragment-two" />
          <span className="pelgaria-orbit-fragment fragment-three" />
          <div className="pelgaria-core">
            <div className="pelgaria-core-glow" />
            <PelgariaMark />
          </div>
        </div>
        <div className="pelgaria-horizon">
          <i />
          <i />
          <i />
        </div>
        <div className="pelgaria-grain" />
      </div>

      <header className="pelgaria-header">
        <Link to="/" className="pelgaria-brand" aria-label="Пельгария">
          <span><PelgariaMark /></span>
          <div>
            <strong>ПЕЛЬГАРИЯ</strong>
            <small>PG-BRIDGE</small>
          </div>
        </Link>

        <Link to="/login" className="pelgaria-sonar">
          <IconLock size={16} stroke={1.7} />
          <span>СОНАР</span>
          <IconArrowUpRight size={16} stroke={1.7} />
        </Link>
      </header>

      <section className="pelgaria-message">
        <div className="pelgaria-signal-status">
          <i />
          <span>Сигнал обнаружен</span>
        </div>
        <p className="pelgaria-kicker">Minecraft Java · Role Play</p>
        <h1>Пельгария</h1>
        <p className="pelgaria-tagline">Мир, которого ещё нет на карте.</p>
        <div className="pelgaria-message-footer">
          <span>Проект находится в разработке</span>
        </div>
      </section>

      <footer className="pelgaria-footer">
        <span>PG / 2026</span>
        <div className="pelgaria-wave" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => <i key={index} />)}
        </div>
        <span>Канал открыт</span>
      </footer>
    </main>
  )
}
