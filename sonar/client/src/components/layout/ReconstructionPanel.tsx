import { useEffect, useState } from 'react'
import {
  IconArchive,
  IconArrowUpRight,
  IconBuildingCommunity,
  IconCheck,
  IconChecklist,
  IconFileCheck,
  IconLayersIntersect,
  IconPrinter,
  IconProgressCheck,
  IconRadar,
  IconScan,
  IconSparkles,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react'

type RenovationView = 'active' | 'next' | 'archive'

const activeSystems = [
  { title: 'Новая архитектура', text: 'Сайдбар удалён. Рабочие пространства доступны через верхний контур и навигационный центр.', Icon: IconLayersIntersect, tag: 'Готово' },
  { title: 'Государственные реестры', text: 'Общие таблицы получили служебный каркас, нумерацию строк и адаптивное карточное представление.', Icon: IconChecklist, tag: 'Готово' },
  { title: 'Электронные формы', text: 'Модальные окна пересобраны в единую систему с контекстной панелью и контролем подтверждения.', Icon: IconFileCheck, tag: 'Готово' },
  { title: 'Центр обслуживания', text: 'Сессии, обращения, документы, сканы и персональная станция печати объединены в одном месте.', Icon: IconUserCheck, tag: 'Работает' },
  { title: 'Печатный контур', text: 'Проверка станции, облегчённые ЧБ-макеты, ШК, QR и формирование документов.', Icon: IconPrinter, tag: 'Работает' },
  { title: 'Карточки записей', text: 'Началась полная замена старых детальных страниц. Первой пересобрана карточка гражданина.', Icon: IconProgressCheck, tag: 'В работе' },
]

const nextStages = [
  { title: 'Карточки дел и законов', text: 'Новая структура материалов, решений, редакций, связей и истории операций.', Icon: IconFileCheck },
  { title: 'Реестр организаций', text: 'Реквизиты, руководство, статусы, сотрудники, имущество и связанные документы.', Icon: IconBuildingCommunity },
  { title: 'Умные печатные формы', text: 'Улучшение распознавания заполненных клеточных бланков и ручной сверки результата.', Icon: IconScan },
]

const archived = [
  { title: 'Территории', text: 'Раздел выведен из интерфейса. Таблицы и прежние записи сохранены.' },
  { title: 'Дипломатия', text: 'Рабочий модуль отключён. Архивные данные не уничтожены.' },
]

const releaseNotes = [
  ['Цикл 04', 'Реестры, формы и карточка гражданина'],
  ['Цикл 03', 'Новая навигация и операционная главная'],
  ['Цикл 02', 'Центр обслуживания и рабочие сессии'],
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
        <span className="renovation-launcher-copy"><small>СОНАР развивается</small><strong>Реновация · цикл 04</strong></span>
        <span className="renovation-launcher-progress"><i /></span>
        <IconArrowUpRight size={15} />
      </button>

      {open && (
        <div className="renovation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="renovation-center" role="dialog" aria-modal="true" aria-label="Центр реновации СОНАР">
            <header className="renovation-center-header">
              <div className="renovation-center-brand">
                <span><IconSparkles size={20} /></span>
                <div><small>Программа развития</small><strong>Реновация СОНАР</strong></div>
              </div>
              <div className="renovation-center-state"><i /> Активный цикл</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><IconX size={20} /></button>
            </header>

            <div className="renovation-center-body">
              <section className="renovation-hero">
                <div className="renovation-hero-copy">
                  <span>Технические работы без остановки сервиса</span>
                  <h2>Меняем не оболочку.<br />Пересобираем систему.</h2>
                  <p>СОНАР обновляется поэтапно, поэтому отдельные экраны могут временно отличаться. Мы сохраняем рабочие функции и заменяем старые части последовательно.</p>
                  <div className="renovation-hero-facts">
                    <span><IconCheck size={15} /> Данные сохраняются</span>
                    <span><IconCheck size={15} /> Сервис остаётся доступен</span>
                  </div>
                </div>
                <div className="renovation-progress-orbit">
                  <div><strong>68</strong><span>%</span><small>текущего этапа</small></div>
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
                  <header><span>Журнал обновлений</span><strong>4 цикла</strong></header>
                  <div>
                    {releaseNotes.map(([cycle, title], index) => (
                      <article key={cycle} className={index === 0 ? 'is-current' : ''}>
                        <span>{cycle}</span><strong>{title}</strong><i />
                      </article>
                    ))}
                  </div>
                  <footer>
                    <IconProgressCheck size={20} />
                    <div><strong>Следующее обновление</strong><span>Карточки дел, законов и объектов</span></div>
                  </footer>
                </aside>
              </div>
            </div>

            <footer className="renovation-center-footer">
              <span>14 июня 2026 · Minecraft Role Play</span>
              <strong>СОНАР / Пельгария</strong>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
