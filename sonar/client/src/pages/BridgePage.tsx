import {
  IconActivity,
  IconArrowDown,
  IconArrowRight,
  IconBrandDiscord,
  IconCloud,
  IconCompass,
  IconCube,
  IconDatabase,
  IconFileDescription,
  IconShieldLock,
  IconSparkles,
  IconUsers,
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
          <a href="#world">О проекте</a>
          <a href="#systems">Возможности</a>
          <a href="#arrival">Как попасть</a>
          <Link to="/login" className="bridge-sonar-link"><IconShieldLock size={15} />СОНАР</Link>
        </div>
      </nav>

      <section className="bridge-hero">
        <div className="bridge-coordinate-strip" aria-hidden="true">
          <span>СЕВЕРНЫЙ КОНТУР · 42°</span>
          <span>КАНАЛ PG-BRIDGE / 01</span>
          <span>СИГНАЛ УСТОЙЧИВ</span>
        </div>
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
          <h1>За пределами<br />известной карты<br /><em>строят Пельгарию.</em></h1>
          <p className="bridge-intro">Государство, которое строят сами игроки. Сервер с собственной сборкой модификаций, институтами, историей и последствиями каждого решения.</p>
          <div className="bridge-actions">
            <a href="#arrival" className="bridge-primary-action">Узнать о запуске<IconArrowDown size={17} /></a>
            <Link to="/login" className="bridge-secondary-action">Войти в СОНАР<IconArrowRight size={17} /></Link>
          </div>
        </div>

        <aside className="bridge-signal">
          <header><IconCloud size={19} /><span>Входящий сигнал</span><b>01</b></header>
          <div className="bridge-signal-code">42° <i /> PG</div>
          <p>Берег ещё скрыт туманом.<br />Но огни уже видны.</p>
          <footer><span>JAVA</span><span>MODDED</span><span>RP</span></footer>
        </aside>

        <a href="#world" className="bridge-scroll-cue"><span>Исследовать</span><i /><IconArrowDown size={14} /></a>
      </section>

      <section className="bridge-dispatch" aria-label="Статус проекта">
        <div className="bridge-dispatch-title">
          <span><IconActivity size={19} /></span>
          <div><small>Сводка проекта</small><strong>Пельгария формируется</strong></div>
        </div>
        <dl>
          <div><dt>Платформа</dt><dd>Minecraft Java</dd></div>
          <div><dt>Формат</dt><dd>Модифицированный RP</dd></div>
          <div><dt>Доступ</dt><dd><i /> Подготовка к открытию</dd></div>
        </dl>
      </section>

      <section id="world" className="bridge-manifest">
        <header>
          <span>01 / Замысел</span>
          <h2>Живой мир за пределами<br />обычной игровой сессии</h2>
          <p>Пельгария создаётся как пространство для долгой ролевой игры, где государственные сервисы, экономика и законы существуют рядом с исследованием мира.</p>
        </header>
        <div className="bridge-principles">
          <article><span>01</span><IconCompass size={24} /><strong>Исследуйте</strong><p>Мир со своей географией, инфраструктурой и местами, которые ещё предстоит открыть.</p></article>
          <article><span>02</span><IconCube size={24} /><strong>Создавайте</strong><p>Сборка модификаций расширит строительство, производство и возможности игроков.</p></article>
          <article><span>03</span><IconSparkles size={24} /><strong>Влияйте</strong><p>Решения игроков становятся частью истории, а не исчезают после выхода с сервера.</p></article>
        </div>
      </section>

      <section id="systems" className="bridge-systems">
        <header>
          <div>
            <span>02 / Устройство мира</span>
            <h2>Игра продолжается<br />после выхода с сервера</h2>
          </div>
          <p>PG-BRIDGE соединит игровой мир, сообщество и цифровые службы Пельгарии. У каждого действия будет место в общей истории.</p>
        </header>
        <div className="bridge-system-grid">
          <article>
            <span>МИР</span>
            <IconCompass size={27} />
            <strong>Территория для исследования</strong>
            <p>Поселения, дороги, ресурсы и инфраструктура развиваются усилиями игроков.</p>
            <small>Живая география</small>
          </article>
          <article>
            <span>ОБЩЕСТВО</span>
            <IconUsers size={27} />
            <strong>Роли с реальным влиянием</strong>
            <p>Граждане, предприниматели и госслужащие меняют устройство государства.</p>
            <small>История сообщества</small>
          </article>
          <article>
            <span>СИСТЕМЫ</span>
            <IconDatabase size={27} />
            <strong>Цифровой контур СОНАР</strong>
            <p>Паспорта, законы, дела и обращения существуют как части единой системы.</p>
            <small>Собственная платформа</small>
          </article>
          <article>
            <span>ПРАВИЛА</span>
            <IconFileDescription size={27} />
            <strong>Последствия вместо декораций</strong>
            <p>Документы, решения и договорённости сохраняются и влияют на следующие события.</p>
            <small>Долгая ролевая игра</small>
          </article>
        </div>
        <blockquote>
          <span>PG / 2026</span>
          <p>Пельгария не выдаёт готовую историю. Она даёт место, где история появляется между игроками.</p>
        </blockquote>
      </section>

      <section id="arrival" className="bridge-arrival">
        <div>
          <span>03 / Подключение</span>
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
        <div className="bridge-footer-signal"><i /><span>PG-BRIDGE · 2026 · КАНАЛ ОТКРЫТ</span></div>
      </footer>
    </main>
  )
}
