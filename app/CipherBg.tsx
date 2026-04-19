"use client";

import { useEffect, useRef } from "react";

const CIPHERS = [
  { text: "ОБЪЕКТ №БД-001 · БЕРЁЗОВЫЙ ДОМ · СТ.14 · РЕГ-2018-001 · СТАТУС: АРХИВ", top: 6,  dur: 60, delay: 0,   rev: false, size: 11 },
  { text: "ОБЪЕКТ №ГР-002 · ГОРИЗОНТ · СТ.27 · РЕГ-2019-047 · СТАТУС: ЗАМОРОЖЕН",  top: 17, dur: 82, delay: -18, rev: true,  size: 10 },
  { text: "ОБЪЕКТ №ПТ-003 · ПЕЛЬМЕНЬТЕХ · СТ.88 · РЕГ-2020-103 · СТАТУС: ЛИКВИДИРОВАН", top: 28, dur: 50, delay: -35, rev: false, size: 12 },
  { text: "ОБЪЕКТ №KG-004 · KINGDOM · СТ.103 · РЕГ-2021-215 · СТАТУС: АРХИВ",       top: 40, dur: 72, delay: -10, rev: true,  size: 10 },
  { text: "ОБЪЕКТ №СБ-005 · СБЕРБАН · СТ.215 · РЕГ-2022-301 · СТАТУС: АКТИВ",       top: 52, dur: 55, delay: -42, rev: false, size: 11 },
  { text: "РЕЕСТР ФОНДА · //:МОСТ · ВЕРИФИКАЦИЯ ОБЪЕКТОВ · ЗАГРУЗКА БАЗЫ ДАННЫХ · ИНИЦИАЛИЗАЦИЯ",    top: 64, dur: 67, delay: -28, rev: true,  size: 10 },
  { text: "БД-001 · ГР-002 · ПТ-003 · KG-004 · СБ-005 · СТ.14 · СТ.27 · СТ.88 · СТ.103 · СТ.215", top: 75, dur: 90, delay: -55, rev: false, size: 9  },
  { text: "ФЕДЕРАЛЬНЫЙ РЕЕСТР ОБЪЕКТОВ · ПЕЛЬГАРИЯ · //:МОСТ · ПОРТАЛ ВРЕМЕННО НЕДОСТУПЕН",          top: 86, dur: 74, delay: -20, rev: true,  size: 10 },
];

export default function CipherBg() {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* Mouse proximity glow */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const vh = window.innerHeight;
      rowRefs.current.forEach((el, i) => {
        if (!el) return;
        const rowY = (CIPHERS[i].top / 100) * vh;
        const dist = Math.abs(e.clientY - rowY);
        const t = Math.max(0, 1 - dist / (vh * 0.22));
        el.style.opacity = String(0.13 + t * 0.52);
      });
    };
    const onLeave = () =>
      rowRefs.current.forEach(el => { if (el) el.style.opacity = ""; });

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  /* Random glitch */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const glitch = () => {
      const el = rowRefs.current[Math.floor(Math.random() * rowRefs.current.length)];
      if (el) {
        el.style.opacity = "0.75";
        setTimeout(() => { el.style.opacity = "0.05"; }, 70);
        setTimeout(() => { el.style.opacity = "0.6";  }, 140);
        setTimeout(() => { el.style.opacity = "0.05"; }, 200);
        setTimeout(() => { el.style.opacity = "";     }, 280);
      }
      t = setTimeout(glitch, 1600 + Math.random() * 3800);
    };
    t = setTimeout(glitch, 800);
    return () => clearTimeout(t);
  }, []);

  /* Click burst */
  const handleClick = (i: number) => {
    const el = rowRefs.current[i];
    if (!el) return;
    el.style.transition = "opacity 0.05s";
    el.style.opacity = "0.9";
    setTimeout(() => {
      el.style.opacity = "0.05";
      setTimeout(() => {
        el.style.opacity = "";
        el.style.transition = "";
      }, 500);
    }, 80);
  };

  return (
    <>
      {CIPHERS.map((c, i) => (
        <div
          key={i}
          ref={el => { rowRefs.current[i] = el; }}
          className="cipher-row"
          style={{ top: `${c.top}%`, fontSize: `${c.size}px`, cursor: "pointer" }}
          onClick={() => handleClick(i)}
        >
          <span
            className="cipher-track"
            style={{
              animationDuration: `${c.dur}s`,
              animationDelay:    `${c.delay}s`,
              animationDirection: c.rev ? "reverse" : "normal",
            }}
          >
            {(c.text + "  ·  ").repeat(6)}
          </span>
        </div>
      ))}
    </>
  );
}
