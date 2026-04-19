import Link from "next/link";
import CipherBg from "./CipherBg";
import ThemeToggle from "@/components/ThemeToggle";

export default function Page() {
  return (
    <>
      <CipherBg />

      {/* Top bar */}
      <div className="maint-topbar">
        <Link href="/" className="maint-logo">
          <span className="sl">//</span>
          <span className="co">:</span>
          <span className="nm">МОСТ</span>
        </Link>
        <div className="maint-topbar-right">
          <ThemeToggle />
          <Link href="/login" className="maint-operator-btn">Вход для операторов</Link>
        </div>
      </div>

      {/* Main */}
      <main className="maint-main">
        <div className="maint-card">
          <div className="maint-eyebrow">Федеральный реестр объектов</div>

          <div className="maint-logo-wrap">
            <span className="sl">//</span>
            <span className="co">:</span>
            <span className="nm">МОСТ</span>
          </div>

          <div className="maint-rule" />

          <div className="maint-stamp">Недоступно</div>

          <div className="maint-rule" />

          <div className="maint-status">Статус: техническое обслуживание</div>
          <div className="maint-teaser">Ведётся подготовка реестра фонда</div>
        </div>

        <div className="maint-disclaimer">
          Художественный вымысел. Все упомянутые объекты, организации и события
          носят вымышленный характер и не имеют отношения к реальным лицам или структурам.
        </div>
      </main>
    </>
  );
}
