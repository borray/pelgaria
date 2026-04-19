const CIPHERS = [
  {
    text: "ОБЪЕКТ №БД-001 · БЕРЁЗОВЫЙ ДОМ · СТ.14 · РЕГ-2018-001 · СТАТУС: АРХИВ · ОБЪЕКТ №БД-001 · БЕРЁЗОВЫЙ ДОМ · СТ.14 · РЕГ-2018-001 · СТАТУС: АРХИВ · ",
    top: "7%", duration: "60s", delay: "0s",
  },
  {
    text: "ОБЪЕКТ №ГР-002 · ГОРИЗОНТ · СТ.27 · РЕГ-2019-047 · СТАТУС: ЗАМОРОЖЕН · ОБЪЕКТ №ГР-002 · ГОРИЗОНТ · СТ.27 · РЕГ-2019-047 · СТАТУС: ЗАМОРОЖЕН · ",
    top: "19%", duration: "80s", delay: "-18s",
  },
  {
    text: "ОБЪЕКТ №ПТ-003 · ПЕЛЬМЕНЬТЕХ · СТ.88 · РЕГ-2020-103 · СТАТУС: ЛИКВИДИРОВАН · ОБЪЕКТ №ПТ-003 · ПЕЛЬМЕНЬТЕХ · СТ.88 · РЕГ-2020-103 · СТАТУС: ЛИКВИДИРОВАН · ",
    top: "31%", duration: "50s", delay: "-35s",
  },
  {
    text: "ОБЪЕКТ №KG-004 · KINGDOM · СТ.103 · РЕГ-2021-215 · СТАТУС: АРХИВ · ОБЪЕКТ №KG-004 · KINGDOM · СТ.103 · РЕГ-2021-215 · СТАТУС: АРХИВ · ",
    top: "44%", duration: "70s", delay: "-10s",
  },
  {
    text: "ОБЪЕКТ №СБ-005 · СБЕРБАН · СТ.215 · РЕГ-2022-301 · СТАТУС: АКТИВ · ОБЪЕКТ №СБ-005 · СБЕРБАН · СТ.215 · РЕГ-2022-301 · СТАТУС: АКТИВ · ",
    top: "57%", duration: "55s", delay: "-42s",
  },
  {
    text: "РЕЕСТР ФОНДА · ПЕЛЬГАРИЯ · ВЕРИФИКАЦИЯ ОБЪЕКТОВ · ЗАГРУЗКА БАЗЫ ДАННЫХ · ИНИЦИАЛИЗАЦИЯ РЕЕСТРА · РЕЕСТР ФОНДА · ПЕЛЬГАРИЯ · ВЕРИФИКАЦИЯ ОБЪЕКТОВ · ",
    top: "70%", duration: "65s", delay: "-28s",
  },
  {
    text: "ОБЪЕКТ №БД-001 · БЕРЁЗОВЫЙ ДОМ · СТ.14 · РЕГ-2018-001 · СТАТУС: АРХИВ · ОБЪЕКТ №ГР-002 · ГОРИЗОНТ · СТ.27 · ОБЪЕКТ №ПТ-003 · ПЕЛЬМЕНЬТЕХ · СТ.88 · ",
    top: "82%", duration: "90s", delay: "-55s",
  },
  {
    text: "ОБЪЕКТ №KG-004 · KINGDOM · СТ.103 · ОБЪЕКТ №СБ-005 · СБЕРБАН · СТ.215 · РЕГ-2022-301 · ФЕДЕРАЛЬНЫЙ РЕЕСТР ОБЪЕКТОВ · ПЕЛЬГАРИЯ · СТАТУС: ИНИЦИАЛИЗАЦИЯ · ",
    top: "93%", duration: "72s", delay: "-20s",
  },
];

export default function Page() {
  return (
    <>
      {/* Floating cipher background */}
      {CIPHERS.map((c, i) => (
        <div
          key={i}
          className="cipher-row"
          style={{ top: c.top }}
        >
          <span
            className="cipher-track"
            style={{ animationDuration: c.duration, animationDelay: c.delay }}
          >
            {c.text.repeat(4)}
          </span>
        </div>
      ))}

      {/* Main content */}
      <main className="main">
        <div className="org-name">Пельгария</div>
        <div className="org-title">Федеральный реестр объектов</div>

        <div className="rule" />

        <div className="stamp-wrap">
          <div className="stamp">Недоступно</div>
        </div>

        <div className="rule" />

        <div className="status-line">Статус: техническое обслуживание</div>

        <div className="teaser">Ведётся подготовка реестра фонда</div>
      </main>
    </>
  );
}
