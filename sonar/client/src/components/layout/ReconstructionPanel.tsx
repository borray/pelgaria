import { useEffect, useState } from 'react'
import {
  IconArchive,
  IconArrowUpRight,
  IconBuildingCommunity,
  IconBulb,
  IconCheck,
  IconChecklist,
  IconFileCheck,
  IconLayersIntersect,
  IconLock,
  IconMessageCircle,
  IconNotebook,
  IconPrinter,
  IconUserCog,
  IconProgressCheck,
  IconRadar,
  IconId,
  IconScan,
  IconServer2,
  IconShieldCheck,
  IconSparkles,
  IconX,
} from '@tabler/icons-react'

type RenovationView = 'active' | 'next' | 'archive'

const CYCLE = 16

const activeSystems = [
  { title: 'Компактный вход', text: 'Страница авторизации очищена до одного окна ввода. Ненавязчивая анимация служебного поля работает только фоном и не отвлекает от доступа.', Icon: IconLock, tag: 'Готово' },
  { title: 'Печатный контур', text: 'Формирование PDF закреплено на встроенном Chromium, а при сбое система показывает понятное состояние и код ошибки вместо пустой страницы.', Icon: IconPrinter, tag: 'Стабилизирован' },
  { title: 'Проектные инициативы', text: 'Канцелярия Верховного Совета получила реестр проектов: регистрационный номер ПИ, контрольный ШК, рассмотрение, решения и печатная карточка.', Icon: IconBulb, tag: 'Готово' },
  { title: 'Пустые бланки', text: 'В центре печати для каждой формы доступен отдельный чистый бланк, рассчитанный на ручное заполнение и последующее прикрепление скана.', Icon: IconFileCheck, tag: 'Готово' },
  { title: 'Паспорт под ЧБ-печать', text: 'Внутренний паспорт переоформлен под чёткую чёрно-белую печать на лазерном принтере: штриховая графика, гильоши и микротекст в высоком контрасте, реперные метки и читаемый машинный код без потери качества.', Icon: IconId, tag: 'Готово' },
  { title: 'Зрелость системы', text: 'СОНАР получил техническую документацию, контейнеризацию и выверенное окружение. Запуск, обслуживание и восстановление описаны и воспроизводимы.', Icon: IconServer2, tag: 'Готово' },
  { title: 'Право суперадмина', text: 'Полномочия Председателя Верховного Совета закреплены отдельным правом доступа. Критические действия скрыты от тех, у кого его нет.', Icon: IconLock, tag: 'Готово' },
  { title: 'Знак СОНАР', text: 'Служебный контур получил собственный знак на основе символа Пельгарии. Модульную форму рассекает дуга радиолокационного сканирования с импульсной точкой.', Icon: IconRadar, tag: 'Готово' },
  { title: 'Типографика Пельгарии', text: 'Тизер получил отдельную выразительную шрифтовую систему: редакционное начертание для названия и строгий узкий гротеск для служебных сигналов.', Icon: IconSparkles, tag: 'Готово' },
  { title: 'Тизер мира', text: 'Публичная витрина пересобрана с нуля как единая анимированная композиция: световой сигнал, орбитальная графика, фирменный знак и минимум информации до открытия мира.', Icon: IconSparkles, tag: 'Готово' },
  { title: 'Знак Пельгарии', text: 'Мир получил собственный модульный символ из 13 равных элементов. Он встроен в публичную витрину, вкладку браузера и устанавливаемое приложение.', Icon: IconSparkles, tag: 'Готово' },
  { title: 'Комфорт на Full HD', text: 'Текст, подписи, кнопки, формы, таблицы и модальные окна получили новый минимум читаемости для масштаба 100%.', Icon: IconSparkles, tag: 'Готово' },
  { title: 'Облик PG-BRIDGE', text: 'Публичная страница стала полноценной витриной мира со статусом проекта, устройством игрового пространства и маршрутом подключения.', Icon: IconLayersIntersect, tag: 'Готово' },
  { title: 'Мост Пельгарии', text: 'Корень pg-bridge стал публичным порталом мира. СОНАР отделён от внешнего сайта и открывается через служебный вход.', Icon: IconLayersIntersect, tag: 'Готово' },
  { title: 'Архив · Контакт', text: 'Завершённые дела больше не превращаются в тупик: доступны полная карточка, история, материалы, продолжение многодневной работы и возобновление.', Icon: IconArchive, tag: 'Готово' },
  { title: 'СОНАР · Контакт', text: 'Прежний режим заменён обращениями игроков. Работа начинается без принтера, а заявки, документы и файлы собираются в едином рабочем пространстве.', Icon: IconNotebook, tag: 'Готово' },
  { title: 'Кабинет сотрудника', text: 'Профиль полностью пересобран: идентичность, полномочия, безопасность, Discord и оформление разделены по понятным рабочим зонам.', Icon: IconUserCog, tag: 'Готово' },
  { title: 'Демонстрация операций', text: 'Этап сверки подлинности показывается не менее 5 секунд, а анимация формирования PDF — не менее 7 секунд.', Icon: IconProgressCheck, tag: 'Готово' },
  { title: 'Служебная связь', text: 'Чат превращён в коммуникационный центр: поиск бесед, защищённые диалоги, участники, вложения и новая лента сообщений.', Icon: IconMessageCircle, tag: 'Готово' },
  { title: 'Контроль подлинности', text: 'Проверка документа стала пошаговой операцией с электронным заключением и локальной историей последних сверок.', Icon: IconShieldCheck, tag: 'Готово' },
  { title: 'Формирование PDF', text: 'Ожидание документа получило отдельный анимированный экран с этапами подготовки и понятным состоянием ошибки.', Icon: IconPrinter, tag: 'Работает' },
  { title: 'Государственные реестры', text: 'Общие таблицы получили служебный каркас, нумерацию строк и адаптивное карточное представление.', Icon: IconChecklist, tag: 'Готово' },
  { title: 'Карточки игроков', text: 'Игровой реестр отделён от гражданства: игрок становится гражданином после выдачи действующего паспорта.', Icon: IconProgressCheck, tag: 'Готово' },
]

const nextStages = [
  { title: 'Реестр организаций', text: 'Реквизиты, руководство, статусы, сотрудники, имущество и связанные документы.', Icon: IconBuildingCommunity },
  { title: 'Карточки дел и законов', text: 'Новая структура материалов, решений, редакций, связей и истории операций.', Icon: IconChecklist },
  { title: 'Умные печатные формы', text: 'Улучшение распознавания заполненных клеточных бланков и ручной сверки результата.', Icon: IconScan },
]

const archived = [
  { title: 'Территории', text: 'Раздел выведен из интерфейса. Таблицы и прежние записи сохранены.' },
  { title: 'Дипломатия', text: 'Рабочий модуль отключён. Архивные данные не уничтожены.' },
]

const releaseNotes = [
  ['Цикл 16', 'Компактный вход, устойчивый PDF-контур и реестр проектных инициатив'],
  ['Цикл 15', 'Паспорт под ЧБ-печать, техническая зрелость и право суперадмина'],
  ['Цикл 14', 'Родственный знак СОНАР и служебная иконка вкладки'],
  ['Цикл 13', 'Новая выразительная типографика публичного тизера'],
  ['Цикл 12', 'Новая анимированная витрина-тизер мира'],
  ['Цикл 11', 'Новый модульный знак Пельгарии во всех точках мира'],
  ['Цикл 10', 'Фирменный знак Пельгарии и единая иконка проекта'],
  ['Цикл 09', 'Большая витрина PG-BRIDGE и системная читаемость на Full HD'],
  ['Цикл 08', 'Публичный Мост Пельгарии и разделение игроков с гражданством'],
  ['Цикл 07', 'Полноценный архив дел, возобновление работы и быстрый доступ к связи'],
  ['Цикл 06', 'СОНАР · Контакт, кабинет сотрудника и демонстрация операций'],
  ['Цикл 05', 'Служебная связь, подлинность и операции формирования PDF'],
  ['Цикл 04', 'Реестры, формы и карточка гражданина'],
  ['Цикл 03', 'Новая навигация и операционная главная'],
  ['Цикл 02', 'Центр контакта и обращения'],
  ['Цикл 01', 'Новый вход, темы и визуальная основа'],
]

export function ReconstructionPanel() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<RenovationView>('active')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button className="renovation-launcher" type="button" onClick={() => setOpen(true)}>
        <span className="renovation-launcher-radar"><IconRadar size={18} /><i /></span>
        <span className="renovation-launcher-copy"><small>СОНАР развивается</small><strong>Развитие · цикл {CYCLE}</strong></span>
        <span className="renovation-launcher-progress"><i /></span>
        <IconArrowUpRight size={15} />
      </button>

      {open && (
        <div className="renovation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="renovation-center" role="dialog" aria-modal="true" aria-label="Развитие СОНАР">
            <header className="renovation-center-header">
              <div className="renovation-center-brand">
                <span><IconRadar size={20} /></span>
                <div><small>Программа развития</small><strong>Развитие СОНАР</strong></div>
              </div>
              <div className="renovation-center-state"><i /> Цикл {CYCLE} · активен</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><IconX size={20} /></button>
            </header>

            <div className="renovation-center-body">
              <section className="renovation-hero">
                <div className="renovation-hero-copy">
                  <span>Система организации надзора и администрирования реестра</span>
                  <h2>СОНАР растёт<br />вместе с Пельгарией.</h2>
                  <p>СОНАР — государственная информационная система Пельграда в мире Пельгария. Она обновляется поэтапно, циклами: отдельные экраны могут временно отличаться, но рабочие функции сохраняются, а старые части заменяются последовательно.</p>
                  <div className="renovation-hero-facts">
                    <span><IconCheck size={15} /> Данные сохраняются</span>
                    <span><IconCheck size={15} /> Система остаётся доступной</span>
                  </div>
                </div>
                <div className="renovation-progress-orbit">
                  <div><strong>{CYCLE}</strong><span>цикл</span><small>текущего этапа</small></div>
                  <i /><i /><i />
                </div>
              </section>

              <div className="renovation-dashboard">
                <main className="renovation-roadmap">
                  <nav>
                    <button className={view === 'active' ? 'is-active' : ''} onClick={() => setView('active')}><span>Сейчас</span><b>{activeSystems.length}</b></button>
                    <button className={view === 'next' ? 'is-active' : ''} onClick={() => setView('next')}><span>Дальше</span><b>{nextStages.length}</b></button>
                    <button className={view === 'archive' ? 'is-active' : ''} onClick={() => setView('archive')}><span>Архив</span><b>{archived.length}</b></button>
                  </nav>

                  {view === 'active' && (
                    <div className="renovation-module-grid">
                      {activeSystems.map(({ title, text, Icon, tag }, index) => (
                        <article key={title}>
                          <header><span><Icon size={18} /></span><small>{String(index + 1).padStart(2, '0')}</small></header>
                          <strong>{title}</strong>
                          <p>{text}</p>
                          <footer><i /> {tag}</footer>
                        </article>
                      ))}
                    </div>
                  )}
                  {view === 'next' && (
                    <div className="renovation-next-list">
                      {nextStages.map(({ title, text, Icon }, index) => (
                        <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><Icon size={19} /><div><strong>{title}</strong><p>{text}</p></div><IconArrowUpRight size={16} /></article>
                      ))}
                    </div>
                  )}
                  {view === 'archive' && (
                    <div className="renovation-archive-list">
                      {archived.map((item) => <article key={item.title}><IconArchive size={19} /><div><strong>{item.title}</strong><p>{item.text}</p></div><span>Сохранено</span></article>)}
                    </div>
                  )}
                </main>

                <aside className="renovation-release-log">
                  <header><span>Журнал циклов</span><strong>{releaseNotes.length} циклов</strong></header>
                  <div>
                    {releaseNotes.map(([cycle, title], index) => (
                      <article key={cycle} className={index === 0 ? 'is-current' : ''}>
                        <span>{cycle}</span><strong>{title}</strong><i />
                      </article>
                    ))}
                  </div>
                  <footer>
                    <IconProgressCheck size={20} />
                    <div><strong>Следующий цикл</strong><span>Реестр организаций и связи между реестрами</span></div>
                  </footer>
                </aside>
              </div>
            </div>

            <footer className="renovation-center-footer">
              <span>20 июня 2026 · мир Пельгария</span>
              <strong>СОНАР · Пельград</strong>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
