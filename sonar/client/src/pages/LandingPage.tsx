import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const prev = document.title
    document.title = 'Пельгария · pg-bridge'
    return () => { document.title = prev }
  }, [])

  const enterSonar = () => navigate(user ? '/dashboard' : '/login')

  return (
    <main className="lp">
      {/* загадочная бело-синяя композиция */}
      <div className="lp-sky" aria-hidden="true">
        <span className="lp-orb o1" />
        <span className="lp-orb o2" />
        <span className="lp-orb o3" />
        <div className="lp-stars">
          {Array.from({ length: 26 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 9) * 0.7}s`, animationDuration: `${6 + (i % 5)}s` }} />
          ))}
        </div>
        <svg className="lp-bridge" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="lpCable" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2f6bff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#2f6bff" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          {/* несущие тросы */}
          <path d="M0,150 C150,40 360,40 420,150 C480,260 200,300 0,300 Z" fill="none" />
          <path d="M120,360 Q420,120 720,360" fill="none" stroke="url(#lpCable)" strokeWidth="2.5" />
          <path d="M480,360 Q780,120 1080,360" fill="none" stroke="url(#lpCable)" strokeWidth="2.5" />
          {/* пилоны */}
          <line x1="420" y1="60" x2="420" y2="420" stroke="#1d3f9e" strokeWidth="6" />
          <line x1="780" y1="60" x2="780" y2="420" stroke="#1d3f9e" strokeWidth="6" />
          {/* вертикальные подвесы */}
          {Array.from({ length: 22 }).map((_, i) => {
            const x = 130 + i * 44
            return <line key={i} x1={x} y1="360" x2={x} y2={String(360 - Math.max(8, 230 - Math.abs(x - 600) * 0.62))} stroke="#3a6bff" strokeWidth="1" strokeOpacity="0.5" />
          })}
          {/* настил */}
          <line x1="0" y1="360" x2="1200" y2="360" stroke="#13286e" strokeWidth="4" />
          <line x1="0" y1="368" x2="1200" y2="368" stroke="#2f6bff" strokeWidth="1.5" strokeOpacity="0.6" />
        </svg>
      </div>

      <header className="lp-top">
        <div className="lp-mark">
          <span className="lp-flag"><i /><i /></span>
          <div>
            <strong>ПЕЛЬГАРИЯ</strong>
            <small>pg-bridge · мост между мирами</small>
          </div>
        </div>
        <button className="lp-enter-mini" onClick={enterSonar}>Войти в СОНАР →</button>
      </header>

      <section className="lp-hero">
        <span className="lp-eyebrow">Скоро открытие</span>
        <h1>Государство,<br />которого ещё нет на карте.</h1>
        <p>
          Пельгария — игровое государство на сервере <b>Minecraft Java</b> с собственной сборкой
          модификаций. Реестры, право, экономика и документы — уже работают. Двери для игроков
          открываются совсем скоро.
        </p>
        <div className="lp-actions">
          <button className="lp-enter" onClick={enterSonar}>
            Войти в систему СОНАР
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="lp-soon">Как присоединиться — расскажем при запуске</span>
        </div>
      </section>

      <footer className="lp-foot">
        <span>Пельгария · вымышленное государство ролевой игры Minecraft</span>
        <span>© pg-bridge</span>
      </footer>
    </main>
  )
}
