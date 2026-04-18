"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import type { SystemNotificationRow } from "@/lib/db";

type Props = { announcements: SystemNotificationRow[] };

/* ── Particle constellation canvas ──────────────────────── */
function ParticleCanvas({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let raf: number;
    let W = 0, H = 0;

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      r: number; opacity: number;
      pulse: number; pulseDir: number;
    };

    let particles: Particle[] = [];

    const el = canvas;
    function resize() {
      W = el.offsetWidth;
      H = el.offsetHeight;
      el.width  = W * devicePixelRatio;
      el.height = H * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    function spawn(): Particle {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.15,
        pulse: Math.random() * Math.PI * 2,
        pulseDir: Math.random() > 0.5 ? 1 : -1,
      };
    }

    function init() {
      resize();
      const count = Math.floor((W * H) / 9000);
      particles = Array.from({ length: Math.min(count, 90) }, spawn);
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, W, H);

      const dotColor  = dark ? "255,255,255" : "30,50,120";
      const lineColor = dark ? "255,255,255" : "30,50,120";
      const maxDist   = 130;

      // Update + draw dots
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;

        p.pulse += 0.02 * p.pulseDir;
        const osc = Math.sin(p.pulse) * 0.15;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotColor},${p.opacity + osc})`;
        ctx.fill();
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.18;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Occasional "pulse ring" from random node
      if (Math.random() < 0.003 && particles.length > 0) {
        const p = particles[Math.floor(Math.random() * particles.length)];
        pulseRings.push({ x: p.x, y: p.y, r: 4, maxR: 60, alpha: 0.4, color: dotColor });
      }

      for (let i = pulseRings.length - 1; i >= 0; i--) {
        const ring = pulseRings[i];
        ring.r += 1.2;
        ring.alpha *= 0.94;
        if (ring.alpha < 0.01) { pulseRings.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ring.color},${ring.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    }

    type Ring = { x: number; y: number; r: number; maxR: number; alpha: number; color: string };
    const pulseRings: Ring[] = [];

    init();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => { init(); });
    ro.observe(canvas);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dark]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function LoginForm({ announcements }: Props) {
  const [tab,    setTab]    = useState<"passport" | "password">("passport");
  const [dark,   setDark]   = useState(true);
  const [passportNum, setPassportNum] = useState("");
  const [pin,      setPin]      = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const creds = tab === "passport"
      ? { passportNumber: passportNum.trim().toUpperCase(), passportPin: pin }
      : { username, password };
    const result = await signIn("credentials", { ...creds, redirect: false });
    if (result?.ok) { window.location.href = "/profile"; }
    else {
      setError(tab === "passport" ? "Паспорт не найден или PIN неверен" : "Неверный логин или пароль");
      setLoading(false);
    }
  }

  // Theme values
  const T = dark ? {
    bg:           "#09090b",
    leftBg:       "rgba(255,255,255,0.02)",
    leftBorder:   "rgba(255,255,255,0.06)",
    cardBg:       "rgba(255,255,255,0.03)",
    cardBorder:   "rgba(255,255,255,0.09)",
    cardShadow:   "0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
    text:         "#f4f4f5",
    textMuted:    "rgba(255,255,255,0.3)",
    textSub:      "rgba(255,255,255,0.22)",
    inputBg:      "rgba(255,255,255,0.05)",
    inputBorder:  "rgba(255,255,255,0.1)",
    inputFocusP:  "rgba(96,165,250,0.45)",
    inputFocusA:  "rgba(251,191,36,0.4)",
    tabBg:        "rgba(255,255,255,0.04)",
    tabBorder:    "rgba(255,255,255,0.07)",
    tabActive:    "rgba(255,255,255,0.1)",
    tabShadow:    "0 1px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
    noticeBg:     "rgba(251,191,36,0.06)",
    noticeBorder: "rgba(251,191,36,0.18)",
    noticeText:   "rgba(251,191,36,0.85)",
    divider:      "rgba(255,255,255,0.06)",
    toggleBg:     "rgba(255,255,255,0.08)",
    toggleBorder: "rgba(255,255,255,0.12)",
    toggleText:   "rgba(255,255,255,0.5)",
    featText:     "rgba(255,255,255,0.32)",
    btnP:         "linear-gradient(135deg,#3b82f6,#1d4ed8)",
    btnPShadow:   "0 4px 20px rgba(59,130,246,0.3)",
    btnA:         "linear-gradient(135deg,#f59e0b,#d97706)",
    btnAShadow:   "0 4px 20px rgba(245,158,11,0.25)",
    btnAColor:    "#1a1a1a",
    errorBg:      "rgba(248,113,113,0.08)",
    errorBorder:  "rgba(248,113,113,0.22)",
    errorText:    "#fca5a5",
    footerText:   "rgba(255,255,255,0.15)",
    orbA:         "rgba(59,130,246,0.08)",
    orbB:         "rgba(139,92,246,0.07)",
    orbC:         "rgba(16,185,129,0.05)",
  } : {
    bg:           "#f0f2f7",
    leftBg:       "rgba(15,28,55,1)",
    leftBorder:   "rgba(255,255,255,0.08)",
    cardBg:       "rgba(255,255,255,0.92)",
    cardBorder:   "rgba(0,0,0,0.08)",
    cardShadow:   "0 16px 60px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.9)",
    text:         "#111827",
    textMuted:    "#6b7280",
    textSub:      "#9ca3af",
    inputBg:      "rgba(0,0,0,0.03)",
    inputBorder:  "rgba(0,0,0,0.12)",
    inputFocusP:  "rgba(59,130,246,0.5)",
    inputFocusA:  "rgba(217,119,6,0.5)",
    tabBg:        "rgba(0,0,0,0.04)",
    tabBorder:    "rgba(0,0,0,0.07)",
    tabActive:    "rgba(255,255,255,0.9)",
    tabShadow:    "0 1px 6px rgba(0,0,0,0.12)",
    noticeBg:     "rgba(217,119,6,0.06)",
    noticeBorder: "rgba(217,119,6,0.2)",
    noticeText:   "#92400e",
    divider:      "rgba(0,0,0,0.06)",
    toggleBg:     "rgba(0,0,0,0.06)",
    toggleBorder: "rgba(0,0,0,0.1)",
    toggleText:   "#6b7280",
    featText:     "rgba(255,255,255,0.4)",
    btnP:         "linear-gradient(135deg,#3b82f6,#1d4ed8)",
    btnPShadow:   "0 4px 20px rgba(59,130,246,0.25)",
    btnA:         "linear-gradient(135deg,#f59e0b,#d97706)",
    btnAShadow:   "0 4px 20px rgba(245,158,11,0.2)",
    btnAColor:    "#1a1a1a",
    errorBg:      "rgba(220,38,38,0.06)",
    errorBorder:  "rgba(220,38,38,0.2)",
    errorText:    "#dc2626",
    footerText:   "#9ca3af",
    orbA:         "rgba(59,130,246,0.06)",
    orbB:         "rgba(139,92,246,0.05)",
    orbC:         "rgba(16,185,129,0.04)",
    btnAColor2:   "#1a1a1a",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "10.5px", fontWeight: 700,
    color: T.textMuted, marginBottom: "7px",
    textTransform: "uppercase", letterSpacing: "0.09em",
  };
  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: "9px",
    border: `1px solid ${T.inputBorder}`, background: T.inputBg,
    color: T.text, fontSize: "14px", outline: "none",
    fontFamily: "var(--font-body)", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", position: "relative", overflow: "hidden", background: T.bg, transition: "background 0.3s" }}>

      {/* ── Canvas animation ───────────────────────── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <ParticleCanvas dark={dark} />

        {/* Soft gradient orbs behind canvas */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", top: -180, left: -120, background: `radial-gradient(circle, ${T.orbA} 0%, transparent 70%)`, filter: "blur(40px)", animation: "orb-float-1 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", bottom: -100, right: -80, background: `radial-gradient(circle, ${T.orbB} 0%, transparent 70%)`, filter: "blur(40px)", animation: "orb-float-2 25s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 350, height: 350, borderRadius: "50%", top: "45%", left: "38%", background: `radial-gradient(circle, ${T.orbC} 0%, transparent 70%)`, filter: "blur(30px)", animation: "orb-float-3 17s ease-in-out infinite" }} />
        </div>
      </div>

      {/* ── Left panel ──────────────────────────────── */}
      <div
        className="login-left-panel"
        style={{
          flex: "0 0 400px", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "44px 40px",
          background: dark ? T.leftBg : T.leftBg,
          borderRight: `1px solid ${T.leftBorder}`,
          position: "relative", zIndex: 1, backdropFilter: "blur(4px)",
        }}
      >
        {/* Logo */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "60px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "9px",
              border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "10px", fontWeight: 900, color: "#e4e4e7", letterSpacing: "-0.02em" }}>РП</span>
              <div style={{ width: "20px", height: "1px", background: "rgba(255,255,255,0.25)" }} />
              <span style={{ fontSize: "5px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)" }}>PELGARIA</span>
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#f4f4f5", fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                <span style={{ color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>//:</span>МОСТ
              </div>
              <div style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Портал Пельгарии
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "36px" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.26em", color: "rgba(255,255,255,0.25)", marginBottom: "16px" }}>
              Официальный доступ
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: 900,
              fontSize: "2.5rem", color: "#fff", letterSpacing: "-0.05em",
              lineHeight: 1.05, marginBottom: "18px",
            }}>
              Республика<br />Пельгария
            </h1>
            <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.3)", lineHeight: 1.8, maxWidth: "280px" }}>
              Государственная информационная система. Документы, законы, реестр граждан и сервисы верификации.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Реестр граждан и паспорта" },
              { label: "Законы и нормативные акты" },
              { label: "Верификация документов" },
            ].map(({ label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "28px 0" }}>
            {announcements.map(a => (
              <div key={a.id} style={{
                padding: "10px 13px", borderRadius: "8px",
                background: a.type === "alert" ? "rgba(248,113,113,0.1)" : a.type === "warning" ? "rgba(251,191,36,0.08)" : "rgba(96,165,250,0.08)",
                border: `1px solid ${a.type === "alert" ? "rgba(248,113,113,0.2)" : a.type === "warning" ? "rgba(251,191,36,0.18)" : "rgba(96,165,250,0.18)"}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: "12px", color: "rgba(255,255,255,0.75)", marginBottom: a.content ? "3px" : 0 }}>{a.title}</div>
                {a.content && <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)" }}>{a.content}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Bottom */}
        <div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />
          <a href="/verify" style={{
            fontSize: "12px", color: "rgba(255,255,255,0.28)", textDecoration: "none",
            display: "flex", alignItems: "center", gap: "8px", transition: "color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
          >
            <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.2)" }} />
            Проверить документ без входа
          </a>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "48px 32px", position: "relative", zIndex: 1, overflowY: "auto",
      }}>

        {/* Theme toggle — top right */}
        <button
          onClick={() => setDark(d => !d)}
          title={dark ? "Светлая тема" : "Тёмная тема"}
          style={{
            position: "absolute", top: "20px", right: "20px",
            background: T.toggleBg, border: `1px solid ${T.toggleBorder}`,
            borderRadius: "8px", padding: "7px 12px",
            cursor: "pointer", fontFamily: "var(--font-body)",
            fontSize: "11.5px", fontWeight: 600, color: T.toggleText,
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.2s",
          }}
        >
          {dark
            ? <><span style={{ fontSize: "13px" }}>☀</span> Светлая</>
            : <><span style={{ fontSize: "13px" }}>☾</span> Тёмная</>
          }
        </button>

        <div style={{ width: "100%", maxWidth: "380px" }}>

          {/* Card */}
          <div style={{
            background: T.cardBg, border: `1px solid ${T.cardBorder}`,
            borderRadius: "18px", padding: "36px 32px",
            backdropFilter: "blur(20px)",
            boxShadow: T.cardShadow,
            transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
          }}>

            {/* Header */}
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "21px", fontWeight: 800, color: T.text, fontFamily: "var(--font-display)", letterSpacing: "-0.03em", marginBottom: "5px", transition: "color 0.3s" }}>
                Вход в систему
              </div>
              <div style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.55, transition: "color 0.3s" }}>
                {tab === "passport" ? "Введите номер паспорта гражданина" : "Служебный вход для государственных работников"}
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px",
              background: T.tabBg, border: `1px solid ${T.tabBorder}`,
              borderRadius: "11px", padding: "4px", marginBottom: "26px",
              transition: "background 0.3s",
            }}>
              {([
                { key: "passport",  label: "Гражданин" },
                { key: "password",  label: "Госслужащий" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTab(key); setError(""); }}
                  style={{
                    padding: "9px 8px", borderRadius: "8px", border: "none",
                    cursor: "pointer", fontFamily: "var(--font-body)",
                    fontSize: "12.5px", fontWeight: 600, transition: "all 0.2s",
                    background: tab === key ? T.tabActive : "transparent",
                    color: tab === key ? T.text : T.textMuted,
                    boxShadow: tab === key ? T.tabShadow : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Gov notice */}
            {tab === "password" && (
              <div style={{
                padding: "10px 13px", borderRadius: "9px", marginBottom: "22px",
                background: T.noticeBg, border: `1px solid ${T.noticeBorder}`,
                transition: "background 0.3s",
              }}>
                <div style={{ fontSize: "11.5px", color: T.noticeText, lineHeight: 1.65 }}>
                  Служебный доступ для администраторов и сотрудников государственных органов Республики Пельгария
                </div>
              </div>
            )}

            {/* Fields */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {tab === "passport" ? (
                <>
                  <div>
                    <label style={labelStyle}>Номер паспорта</label>
                    <input
                      value={passportNum} onChange={e => setPassportNum(e.target.value)}
                      placeholder="PG-00001"
                      required autoFocus
                      style={{ ...inp, fontFamily: "monospace", fontSize: "17px", letterSpacing: "0.08em", textTransform: "uppercase" }}
                      onFocus={e => (e.currentTarget.style.borderColor = T.inputFocusP)}
                      onBlur={e  => (e.currentTarget.style.borderColor = T.inputBorder)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      PIN-код&nbsp;
                      <span style={{ fontWeight: 400, textTransform: "none", color: T.textSub }}>
                        (если установлен)
                      </span>
                    </label>
                    <input
                      type="password" inputMode="numeric"
                      value={pin} onChange={e => setPin(e.target.value)}
                      placeholder="••••"
                      maxLength={16}
                      style={{ ...inp, letterSpacing: "0.3em" }}
                      onFocus={e => (e.currentTarget.style.borderColor = T.inputFocusP)}
                      onBlur={e  => (e.currentTarget.style.borderColor = T.inputBorder)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>Логин</label>
                    <input
                      value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="Имя пользователя"
                      required autoFocus style={inp}
                      onFocus={e => (e.currentTarget.style.borderColor = T.inputFocusA)}
                      onBlur={e  => (e.currentTarget.style.borderColor = T.inputBorder)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Пароль</label>
                    <input
                      type="password"
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required style={inp}
                      onFocus={e => (e.currentTarget.style.borderColor = T.inputFocusA)}
                      onBlur={e  => (e.currentTarget.style.borderColor = T.inputBorder)}
                    />
                  </div>
                </>
              )}

              {error && (
                <div style={{
                  padding: "10px 13px", borderRadius: "8px",
                  background: T.errorBg, border: `1px solid ${T.errorBorder}`,
                  color: T.errorText, fontSize: "12.5px",
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "12px", borderRadius: "9px", border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: 700,
                  marginTop: "4px", transition: "all 0.2s",
                  background: tab === "passport" ? T.btnP : T.btnA,
                  color: tab === "passport" ? "#fff" : T.btnAColor,
                  opacity: loading ? 0.65 : 1,
                  boxShadow: loading ? "none" : tab === "passport" ? T.btnPShadow : T.btnAShadow,
                }}
              >
                {loading ? "Проверка..." : "Войти"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "22px", fontSize: "11px", color: T.footerText, lineHeight: 1.65 }}>
            Все события и организации являются вымыслом · Minecraft · //:МОСТ alpha
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .login-left-panel { display: none !important; } }
      `}</style>
    </div>
  );
}
