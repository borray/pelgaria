import { getPassportById } from "@/lib/db";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { generateIdentifier, splitPassportNumber } from "@/lib/passport-identifier";
import bwipjs from "bwip-js";

const CITIZENSHIP_LABELS: Record<string, string> = {
  resident: "Житель", citizen: "Гражданин", honorary: "Почётный гражданин",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Действителен", blocked: "Заблокирован", wanted: "В розыске",
  deactivating: "Деактивируется", frozen: "Заморожен",
  temp_frozen: "Вр. заморожен", suspended: "Отстранён", deceased: "Выбыл",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

const LBL: React.CSSProperties = {
  fontSize: "6px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.22em", color: "#888", marginBottom: "2px",
};

function Guilloche({ uid, h = 14 }: { uid: string; h?: number }) {
  const mid = h / 2;
  const pid = `gp_${uid}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }} height={h} preserveAspectRatio="none">
      <defs>
        <pattern id={pid} x="0" y="0" width="36" height={h} patternUnits="userSpaceOnUse">
          <path d={`M0,${mid} C9,0 27,0 36,${mid}`}                              fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d={`M0,${mid} C9,${h} 27,${h} 36,${mid}`}                        fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d={`M0,${mid} C9,${mid*0.4} 27,${mid*0.4} 36,${mid}`}            fill="none" stroke="#000" strokeWidth="0.25" strokeDasharray="1.5,2.5"/>
          <path d={`M0,${mid} C9,${h-mid*0.4} 27,${h-mid*0.4} 36,${mid}`}        fill="none" stroke="#000" strokeWidth="0.25" strokeDasharray="1.5,2.5"/>
          <path d={`M0,${mid} C9,${mid*0.7} 27,${mid*0.7} 36,${mid}`}            fill="none" stroke="#000" strokeWidth="0.15" strokeDasharray="0.5,4"/>
          <path d={`M0,${mid} C9,${h-mid*0.7} 27,${h-mid*0.7} 36,${mid}`}        fill="none" stroke="#000" strokeWidth="0.15" strokeDasharray="0.5,4"/>
        </pattern>
      </defs>
      <rect width="100%" height={h} fill={`url(#${pid})`}/>
    </svg>
  );
}

function DiamondDivider({ uid }: { uid: string }) {
  const pid = `dd_${uid}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }} height={12} preserveAspectRatio="none">
      <defs>
        <pattern id={pid} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse">
          <line x1="0" y1="6" x2="24" y2="6" stroke="#ccc" strokeWidth="0.4"/>
          <polygon points="12,3 15.5,6 12,9 8.5,6" fill="none" stroke="#aaa" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="12" fill={`url(#${pid})`}/>
    </svg>
  );
}

function CornerOrnament({ flip }: { flip?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0, transform: flip ? "scaleX(-1)" : undefined }}>
      <path d="M2,2 L12,2 M2,2 L2,12" fill="none" stroke="#000" strokeWidth="1.4"/>
      <path d="M2,2 L7,7" fill="none" stroke="#000" strokeWidth="0.6"/>
      <circle cx="2" cy="2" r="1.6" fill="#000"/>
      <circle cx="12" cy="2" r="0.8" fill="none" stroke="#000" strokeWidth="0.6"/>
      <circle cx="2" cy="12" r="0.8" fill="none" stroke="#000" strokeWidth="0.6"/>
      <path d="M5,5 Q7,3 9,5 Q7,7 5,5Z" fill="none" stroke="#000" strokeWidth="0.4"/>
    </svg>
  );
}

export default async function PrintPassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = getPassportById(Number(id));
  if (!passport) notFound();

  const issuer    = passport.issued_by_custom || passport.issued_by_name || "Администрация Пельгарии";
  const issueDate = passport.issue_date ? fmt(passport.issue_date) : fmt(passport.created_at);
  const name      = passport.full_name ?? "—";
  const ident     = generateIdentifier(passport.id, passport.passport_number);
  const { series, number: pnum } = splitPassportNumber(passport.passport_number);

  /* Barcode — Code128, encodes the identifier */
  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: ident,
    scale: 3,
    height: 18,
    includetext: false,
    backgroundcolor: "ffffff",
    barcolor: "000000",
  });
  const barcodeDataUrl = `data:image/png;base64,${barcodePng.toString("base64")}`;

  return (
    <div className="print-preview-bg">

      {/* ── Toolbar (screen only) ─── */}
      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(14,14,16,0.96)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 24px", display: "flex", alignItems: "center", gap: "12px",
      }}>
        <a href={`/admin/passports/${id}/edit`} style={{ fontSize: "12px", color: "#666", textDecoration: "none" }}>← Назад</a>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontSize: "11px", color: "#555" }}>Предпросмотр · </span>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#888" }}>{passport.passport_number}</span>
        </div>
        <PrintButton />
      </div>

      <div className="no-print" style={{ height: "32px" }} />

      {/* ══════════════ A4 ══════════════ */}
      <div
        className="passport-a4"
        style={{
          fontFamily: "Arial, 'Helvetica Neue', sans-serif",
          background: "#fff", color: "#000",
          padding: "7mm 9mm 6mm",
          boxSizing: "border-box",
        }}
      >

        {/* ── HEADER ── */}
        <div style={{ borderBottom: "1.5px solid #000", paddingBottom: "3mm", marginBottom: "2mm" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "2.5mm" }}>
            <CornerOrnament />
            <div style={{ flex: 1, height: "0.4px", background: "#bbb", margin: "0 2.5mm" }} />
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "#666" }}>
              Республика Пельгария · Портал //:МОСТ
            </span>
            <div style={{ flex: 1, height: "0.4px", background: "#bbb", margin: "0 2.5mm" }} />
            <CornerOrnament flip />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
            <div style={{
              width: "18mm", height: "24mm", flexShrink: 0,
              border: "1px dashed #ccc", borderRadius: "1mm 1mm 9mm 9mm",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "6px", color: "#ccc", letterSpacing: "0.08em" }}>ГЕРБ</span>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1, marginBottom: "2mm" }}>
                Удостоверение гражданина
              </div>
              <div style={{ fontSize: "7.5px", letterSpacing: "0.18em", color: "#888", textTransform: "uppercase" }}>
                Citizen Identity Document · Pelgaria Republic
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {series && (
                <div style={{ marginBottom: "2.5mm" }}>
                  <div style={LBL}>Серия</div>
                  <div style={{ fontFamily: "monospace", fontSize: "15px", fontWeight: 700, letterSpacing: "0.1em" }}>{series}</div>
                </div>
              )}
              <div>
                <div style={LBL}>Номер</div>
                <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 900, letterSpacing: "0.06em" }}>{pnum}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── GUILLOCHE 1 ── */}
        <Guilloche uid="top" h={14} />

        {/* ── STATUS ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "0.5px solid #ddd", borderBottom: "0.5px solid #ddd",
          padding: "2mm 0", margin: "2mm 0",
        }}>
          <div style={LBL}>Статус документа</div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", border: "1px solid #000", padding: "1.5mm 5mm 1.5mm 4mm", borderRadius: "0.5mm" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", border: "1px solid #000" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>
              {STATUS_LABELS[passport.status] ?? passport.status}
            </span>
          </div>
          <div style={{ fontSize: "6px", color: "#aaa", letterSpacing: "0.15em" }}>
            PELG · {new Date().getFullYear()}
          </div>
        </div>

        {/* ── IDENTITY ── */}
        <div style={{ display: "flex", gap: "5mm", marginBottom: "3mm" }}>
          {/* Fields */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3mm", borderBottom: "0.5px solid #e0e0e0", paddingBottom: "3mm", marginBottom: "3mm" }}>
              <div>
                <div style={LBL}>Никнейм в Minecraft</div>
                <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{passport.minecraft_nick}</div>
              </div>
              <div>
                <div style={LBL}>Полное имя</div>
                <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{name}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "3mm", borderBottom: "0.5px solid #e0e0e0", paddingBottom: "3mm", marginBottom: "3mm" }}>
              <div>
                <div style={LBL}>Уровень гражданства</div>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>{CITIZENSHIP_LABELS[passport.citizenship_level] ?? passport.citizenship_level}</div>
              </div>
              <div>
                <div style={LBL}>Дата выдачи</div>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>{issueDate}</div>
              </div>
              <div>
                <div style={LBL}>Выдан</div>
                <div style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1.4 }}>{issuer}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2mm", marginBottom: "3mm" }}>
              {[
                { l: "Срок действия", v: "Бессрочно" },
                { l: "Гражданство",   v: "Пельгария" },
                { l: "Тип",           v: "ID Internal" },
                { l: "Код",           v: "PG / PELG" },
              ].map(f => (
                <div key={f.l} style={{ padding: "2mm 2.5mm", border: "0.5px solid #e0e0e0" }}>
                  <div style={LBL}>{f.l}</div>
                  <div style={{ fontSize: "9px", fontWeight: 700 }}>{f.v}</div>
                </div>
              ))}
            </div>

            {passport.notes && (
              <div style={{ padding: "2mm 2.5mm", border: "0.5px solid #e0e0e0", marginBottom: "3mm" }}>
                <div style={{ ...LBL, color: "#b45309" }}>Примечание</div>
                <div style={{ fontSize: "9px", color: "#444", lineHeight: 1.6 }}>{passport.notes}</div>
              </div>
            )}

            {/* Signatures (inside identity block) */}
            <div style={{ borderTop: "0.5px solid #ddd", paddingTop: "3mm" }}>
              <div style={{ display: "grid", gridTemplateColumns: "13mm 1fr 1fr", gap: "3mm" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "11mm", height: "11mm", borderRadius: "50%", border: "1.2px dashed #bbb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "5px", color: "#bbb" }}>М.П.</span>
                  </div>
                </div>
                <div style={{ borderLeft: "0.5px solid #e0e0e0", paddingLeft: "3mm" }}>
                  <div style={{ ...LBL, marginBottom: "6mm" }}>Подпись гражданина</div>
                  <div style={{ borderBottom: "0.8px solid #000", marginBottom: "1.5mm" }} />
                  <div style={{ fontSize: "7px", color: "#888" }}>{passport.full_name ?? passport.minecraft_nick}</div>
                </div>
                <div style={{ borderLeft: "0.5px solid #e0e0e0", paddingLeft: "3mm" }}>
                  <div style={{ ...LBL, marginBottom: "6mm" }}>Подпись уполномоченного</div>
                  <div style={{ borderBottom: "0.8px solid #000", marginBottom: "1.5mm" }} />
                  <div style={{ fontSize: "7px", color: "#888" }}>{issuer}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── DIAMOND DIVIDER ── */}
        <DiamondDivider uid="mid" />

        {/* ── LEGAL + RIGHTS ── */}
        <div style={{ marginBottom: "3mm", marginTop: "1mm" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm", marginBottom: "3mm" }}>
            <div>
              <div style={{ ...LBL, marginBottom: "2mm" }}>Правовой статус</div>
              <p style={{ fontSize: "8.5px", color: "#555", lineHeight: 1.9, margin: 0 }}>
                Настоящее удостоверение выдано на основании решения уполномоченного органа
                Республики Пельгария и подтверждает гражданский статус, права и обязанности
                лица, указанного в данном документе, в соответствии с Конституцией и
                законодательством Республики.
              </p>
            </div>
            <div>
              <div style={{ ...LBL, marginBottom: "2mm" }}>Ответственность</div>
              <p style={{ fontSize: "8.5px", color: "#555", lineHeight: 1.9, margin: 0 }}>
                Документ действителен при наличии подписей уполномоченного лица и владельца.
                Подделка документа и внесение ложных сведений преследуется по законам
                Пельгарии. Утерянный документ подлежит немедленному аннулированию.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2.5mm" }}>
            {[
              { t: "Участие", b: "Право голосовать и участвовать в государственных и общественных делах Республики." },
              { t: "Защита",  b: "Права и свободы гарантированы Конституцией и охраняются законом Пельгарии." },
              { t: "Обязанности", b: "Соблюдение законодательства и участие в гражданских обязанностях перед государством." },
            ].map(item => (
              <div key={item.t} style={{ padding: "2.5mm 3mm", border: "0.5px solid #e0e0e0" }}>
                <div style={{ ...LBL, marginBottom: "2mm" }}>{item.t}</div>
                <div style={{ fontSize: "8px", color: "#555", lineHeight: 1.8 }}>{item.b}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── GUILLOCHE 2 ── */}
        <Guilloche uid="bot" h={14} />

        {/* ── BARCODE / IDENTIFIER BAND ── */}
        <div style={{
          borderTop: "1.5px solid #000", paddingTop: "3mm", marginTop: "2mm",
          display: "grid", gridTemplateColumns: "1fr 0.5px 50mm",
          gap: "4mm", alignItems: "center",
        }}>
          {/* Identifier + barcode */}
          <div style={{ textAlign: "center" }}>
            <div style={LBL}>Идентификатор верификации</div>
            <div style={{
              fontFamily: "monospace", fontSize: "18px", fontWeight: 900,
              letterSpacing: "0.22em", marginTop: "2mm", marginBottom: "2.5mm",
              border: "1.5px solid #000", display: "inline-block", padding: "2mm 5mm",
            }}>
              {ident}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={barcodeDataUrl} alt="barcode" style={{ display: "block", width: "100%", height: "14mm", objectFit: "fill", imageRendering: "crisp-edges" }} />
            <div style={{ fontSize: "6px", color: "#aaa", marginTop: "1.5mm", letterSpacing: "0.12em" }}>pg-bridge.ru/verify</div>
          </div>

          <div style={{ width: "0.5px", height: "28mm", background: "#ccc" }} />

          {/* Doc info */}
          <div>
            <div style={LBL}>Документ</div>
            <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "3mm" }}>
              {passport.passport_number}
            </div>
            <div style={LBL}>Гражданство</div>
            <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "3mm" }}>
              {CITIZENSHIP_LABELS[passport.citizenship_level] ?? passport.citizenship_level}
            </div>
            <div style={LBL}>Статус</div>
            <div style={{ fontSize: "10px", fontWeight: 600 }}>
              {STATUS_LABELS[passport.status] ?? passport.status}
            </div>
          </div>
        </div>

        {/* ── MRZ ── */}
        <div style={{ borderTop: "0.5px solid #bbb", marginTop: "3mm", paddingTop: "2.5mm" }}>
          <div style={{ ...LBL, marginBottom: "1.5mm" }}>Machine Readable Zone</div>
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "8px", letterSpacing: "0.16em", color: "#222",
            background: "#f7f7f7", padding: "2mm 3mm",
            border: "0.4px solid #e0e0e0", lineHeight: 2,
          }}>
            <div>{"P<PELG"}{passport.minecraft_nick.toUpperCase().replace(/[^A-Z]/g, "").padEnd(20, "<").slice(0, 20)}{"<".repeat(6)}</div>
            <div>{passport.passport_number.replace(/[^A-Z0-9]/g, "").padEnd(9, "<")}{"8PG"}{passport.id.toString().padStart(7, "0")}{"M99"}{pnum.padEnd(9, "<").slice(0, 9)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "3mm", marginTop: "2mm" }}>
            <div style={{ flex: 1, height: "0.4px", background: "#ccc" }} />
            <span style={{ fontSize: "5.5px", color: "#bbb", letterSpacing: "0.3em", textTransform: "uppercase" }}>
              PELGARIA · //:МОСТ · {new Date().getFullYear()}
            </span>
            <div style={{ flex: 1, height: "0.4px", background: "#ccc" }} />
          </div>
        </div>

      </div>{/* end passport-a4 */}

      <div className="no-print" style={{ height: "60px" }} />
    </div>
  );
}
