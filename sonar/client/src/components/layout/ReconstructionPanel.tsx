import { useEffect, useState } from 'react'
import {
  IconArchive,
  IconBuildingCommunity,
  IconChecklist,
  IconFileCheck,
  IconPrinter,
  IconProgressCheck,
  IconScan,
  IconUserCheck,
  IconTool,
  IconX,
} from '@tabler/icons-react'

const activeSystems = [
  { title: 'Законодательство 2.0', text: 'Конституция, редакции, связи актов, архив и управляемое удаление.', Icon: IconFileCheck },
  { title: 'Центр обслуживания', text: 'Онлайн-, офлайн- и внутренние сессии объединяют обращения, документы и заявителя.', Icon: IconUserCheck },
  { title: 'Станция печати', text: 'Суточная проверка по скану с оценкой разрешения, контраста и экспозиции.', Icon: IconPrinter },
  { title: 'Сканы и распознавание', text: 'Загрузка приложений, OCR, показатель уверенности и ручная сверка результата.', Icon: IconScan },
  { title: 'Единый реестр', text: 'Поиск по документам, обращениям, ШК, приложениям и распознанному тексту.', Icon: IconChecklist },
  { title: 'Рабочие сессии', text: 'Каждая сессия открывается отдельной страницей с функциями своего режима обслуживания.', Icon: IconProgressCheck },
  { title: 'Навигационный центр', text: 'Постоянная боковая панель заменена верхним контуром и единым каталогом рабочих пространств.', Icon: IconChecklist },
]

const nextStages = [
  { title: 'Реестр организаций', text: 'Подробные карточки, руководство, статус, реквизиты и связанные документы.', Icon: IconBuildingCommunity },
  { title: 'Обучение распознавания', text: 'Улучшение разбора рукописных клеточных форм на подтверждённых сотрудником примерах.', Icon: IconScan },
  { title: 'Реновация карточек', text: 'Последовательная замена старых детальных страниц и встроенных стилей новой системой.', Icon: IconProgressCheck },
]

const archived = [
  'Территории выведены из интерфейса; таблицы и старые записи сохранены.',
  'Дипломатия выведена из рабочего контура; архивные данные не уничтожены.',
]

export function ReconstructionPanel() {
  const [open, setOpen] = useState(false)
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
      <button className="reconstruction-launcher" type="button" onClick={() => setOpen(true)}>
        <IconTool size={17} />
        <span>Реконструкция</span>
      </button>
      {open && (
        <div className="reconstruction-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <aside className="reconstruction-panel" aria-label="Статус реконструкции">
            <header>
              <span><IconTool size={18} /></span>
              <div><strong>Развитие СОНАР</strong><small>Состояние системы и очередь обновлений</small></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><IconX size={18} /></button>
            </header>
            <div className="reconstruction-release">
              <div>
                <span>Текущий этап</span>
                <strong>Полная реновация интерфейса и рабочих разделов</strong>
                <p>Четвёртый цикл · 14 июня 2026 года</p>
              </div>
              <IconProgressCheck size={24} />
            </div>
            <section className="reconstruction-section">
              <div className="reconstruction-section-title"><span>Работает сейчас</span><b>{activeSystems.length}</b></div>
              <div className="reconstruction-cards">
                {activeSystems.map(({ title, text, Icon }) => (
                  <article key={title}>
                    <span><Icon size={17} /></span>
                    <div><strong>{title}</strong><p>{text}</p></div>
                  </article>
                ))}
              </div>
            </section>
            <section className="reconstruction-section">
              <div className="reconstruction-section-title"><span>Следующий этап</span><b>{nextStages.length}</b></div>
              <div className="reconstruction-cards is-next">
                {nextStages.map(({ title, text, Icon }) => (
                  <article key={title}>
                    <span><Icon size={17} /></span>
                    <div><strong>{title}</strong><p>{text}</p></div>
                  </article>
                ))}
              </div>
            </section>
            <section className="reconstruction-archive">
              <div className="reconstruction-section-title"><span>Выведено из рабочего контура</span><IconArchive size={15} /></div>
              {archived.map((item) => <p key={item}>{item}</p>)}
            </section>
            <footer>Панель показывает фактическое состояние функций, без демонстрационных обещаний и пустых разделов.</footer>
          </aside>
        </div>
      )}
    </>
  )
}
