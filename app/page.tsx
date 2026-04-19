import CipherBg from "./CipherBg";

export default function Page() {
  return (
    <>
      <CipherBg />

      <main className="main">
        {/* Logo */}
        <div className="logo" aria-label="МОСТ">
          <span className="logo-sl">//</span>
          <span className="logo-co">:</span>
          <span className="logo-nm">МОСТ</span>
        </div>

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
