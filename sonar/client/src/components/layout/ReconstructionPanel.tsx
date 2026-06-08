import { useEffect, useState } from 'react'
import { IconArrowLeft, IconChecklist, IconTool, IconX } from '@tabler/icons-react'

const deferred = [
  'Настраиваемые виджеты рабочего стола',
  'Сохранённые наборы фильтров для реестров',
  'Пакетное формирование и печать документов',
  'Редактор собственных шаблонов печатных форм',
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
              <div><strong>Реконструкция СОНАР</strong><small>Статус функций и ближайшие этапы</small></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><IconX size={18} /></button>
            </header>
            <section className="reconstruction-status">
              <IconChecklist size={20} />
              <div>
                <strong>Рабочие разделы не отключены</strong>
                <p>Реестры, документы, экономика, дипломатия и управление доступны в прежнем объёме.</p>
              </div>
            </section>
            <section>
              <span className="reconstruction-kicker">Отложено до следующего этапа</span>
              <ul>{deferred.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <footer>
              <IconArrowLeft size={16} />
              Этот список будет сокращаться по мере готовности функций.
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}
