import {
  IconArrowDown,
  IconArrowRight,
  IconBrandDiscord,
  IconCloud,
  IconCompass,
  IconCube,
  IconShieldLock,
  IconSparkles,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'

export function BridgePage() {
  return (
    <main className="bridge-page">
      <nav className="bridge-nav">
        <Link to="/" className="bridge-wordmark" aria-label="Мост Пельгарии">
          <span>PG</span>
          <div><strong>МОСТ ПЕЛЬГАРИИ</strong><small>PG-BRIDGE</small></div>
        </Link>
        <div className="bridge-nav-links">
          <a href="#arrival">Как попасть</a>
          <a href="#world">О проекте</a>
          <Link to="/login" className="bridge-sonar-link"><IconShieldLock size={15} />СОНАР</Link>
        </div>
      </nav>

      <section className="bridge-hero">
        <div className="bridge-atmosphere" aria-hidden="true">
          <i className="bridge-star bridge-star-one" />
          <i className="bridge-star bridge-star-two" />
          <i className="bridge-star bridge-star-three" />
          <div className="bridge-moon" />
          <div className="bridge-horizon" />
          <div className="bridge-structure">
            <span className="bridge-tower bridge-tower-left" />
            <span className="bridge-tower bridge-tower-right" />
            <span className="bridge-deck" />
            <span className="bridge-arc bridge-arc-one" />
            <span className="bridge-arc bridge-arc-two" />
            <span className="bridge-path" />
          </div>
        </div>

        <div className="bridge-hero-copy">
          <span className="bridge-status"><i /> Мир находится в разработке</span>
          <p className="bridge-overline">Minecraft Java · Role Play</p>
          <h1>Там, где заканчивается<br />известная карта,<br /><em>начинается Пельгария.</em></h1>
          <p className="bridge-intro">Государство, которое строят сами игроки. Сервер с собственной сборкой модификаций, институтами, историей и последствиями каждого решения.</p>
          <div className="bridge-actions">
            <a href="#arrival" className="bridge-primary-action">Узнать о запуске<IconArrowDown size={17} /></a>
            <Link to="/login" className="bridge-secondary-action">Войти в СОНАР<IconArrowRight size={17} /></Link>
          </div>
        </div>

        <aside className="bridge-signal">
          <header><IconCloud size={18} /><span>Входящий сигнал</span><b>01</b></header>
          <div className="bridge-signal-code">42° <i /> PG</div>
          <p>Берег ещё скрыт туманом.<br />Но огни уже видны.</p>
          <footer><span>JAVA</span><span>MODDED</span><span>RP</span></footer>
        </aside>

        <a href="#world" className="bridge-scroll-cue"><span>Исследовать</span><i /><IconArrowDown size={14} /></a>
      </section>

      <section id="world" className="bridge-manifest">
        <header>
          <span>Не просто сервер</span>
          <h2>Живой мир за пределами<br />обычной игровой сессии</h2>
          <p>Пельгария создаётся как пространство для долгой ролевой игры, где государственные сервисы, экономика и законы существуют рядом с исследованием мира.</p>
        </header>
        <div className="bridge-principles">
          <article><span>01</span><IconCompass size={24} /><strong>Исследуйте</strong><p>Мир со своей географией, инфраструктурой и местами, которые ещё предстоит открыть.</p></article>
          <article><span>02</span><IconCube size={24} /><strong>Создавайте</strong><p>Сборка модификаций расширит строительство, производство и возможности игроков.</p></article>
          <article><span>03</span><IconSparkles size={24} /><strong>Влияйте</strong><p>Решения игроков становятся частью истории, а не исчезают после выхода с сервера.</p></article>
        </div>
      </section>

      <section id="arrival" className="bridge-arrival">
        <div>
          <span>Подготовка к открытию</span>
          <h2>Путь в Пельгарию<br />скоро будет открыт</h2>
          <p>Здесь появятся инструкция по установке сборки, правила подключения и актуальный статус сервера. Пока мы собираем мир и проверяем его системы.</p>
        </div>
        <ol>
          <li><b>01</b><span><strong>Minecraft Java Edition</strong><small>Основная платформа проекта</small></span></li>
          <li><b>02</b><span><strong>Собственная сборка</strong><small>Ссылка и установщик появятся перед запуском</small></span></li>
          <li><b>03</b><span><strong>Доступ сообщества</strong><small>Discord и заявки на участие откроются позднее</small></span></li>
        </ol>
        <div className="bridge-arrival-actions">
          <button type="button" disabled><IconBrandDiscord size={17} />Сообщество скоро</button>
          <Link to="/login"><IconShieldLock size={17} />Служебный вход СОНАР</Link>
        </div>
      </section>

      <footer className="bridge-footer">
        <div><strong>ПЕЛЬГАРИЯ</strong><span>Вымышленное государство в ролевой игре Minecraft</span></div>
        <span>PG-BRIDGE · 2026</span>
      </footer>
    </main>
  )
}
