import crypto from 'crypto'

const GOOGLE_FONTS = ''

// A4 @ 96dpi
export const A4_W = 794
export const A4_H = 1123

const ACCENT = '#1B3A6B'
const ACCENT_LIGHT = '#4A90D9'
const INK = '#0A1628'

// ---------------------------------------------------------------------------
// Deterministic seed → numeric stream
// ---------------------------------------------------------------------------
function seedStream(seed: string): () => number {
  // sha256 of seed gives a long deterministic hex string we walk through
  let hex = crypto.createHash('sha256').update(seed || 'СОНАР').digest('hex')
  let i = 0
  return () => {
    if (i + 4 > hex.length) {
      hex += crypto.createHash('sha256').update(hex).digest('hex')
    }
    const chunk = hex.slice(i, i + 4)
    i += 4
    return parseInt(chunk, 16) / 0xffff // 0..1
  }
}

// ---------------------------------------------------------------------------
// Guilloche line band — multiple interweaving sinusoids (refined)
// ---------------------------------------------------------------------------
export function guillochePattern(seed: string, width: number, height: number): string {
  const rnd = seedStream(seed)
  const numLines = 6 + Math.floor(rnd() * 4) // 6–9 lines
  const lines: string[] = []
  const baseColors = [ACCENT, ACCENT_LIGHT, '#2C5AA0']
  for (let i = 0; i < numLines; i++) {
    const amp1 = height * (0.12 + rnd() * 0.18)
    const amp2 = height * (0.05 + rnd() * 0.1)
    const freq1 = 0.008 + rnd() * 0.018
    const freq2 = 0.02 + rnd() * 0.05
    const phase = rnd() * Math.PI * 2
    const yBase = (height / numLines) * i + height / numLines / 2
    const pts: string[] = []
    for (let x = 0; x <= width; x += 3) {
      const y = yBase + amp1 * Math.sin(freq1 * x + phase) + amp2 * Math.sin(freq2 * x + phase * 1.7)
      pts.push(`${x},${y.toFixed(2)}`)
    }
    const color = baseColors[i % baseColors.length]
    lines.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.22"/>`
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${lines.join('')}</svg>`
}

// ---------------------------------------------------------------------------
// Guilloche rosette — parametric hypotrochoid/epitrochoid (spirograph)
// x = (R-r)cos(t) + d·cos(((R-r)/r)·t)
// y = (R-r)sin(t) - d·sin(((R-r)/r)·t)
// ---------------------------------------------------------------------------
export function guillocheRosette(seed: string, size = 220): string {
  const rnd = seedStream('rosette:' + seed)
  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 6

  const R = 60 + Math.floor(rnd() * 70)
  let r = 13 + Math.floor(rnd() * 34)
  if (r === 0) r = 7
  const d = 18 + Math.floor(rnd() * 46)
  const passes = 3 + Math.floor(rnd() * 3) // 3–5 phase-shifted passes
  const turns = r / gcd(R, r) // closes the curve
  const steps = Math.max(720, Math.floor(turns * 240))

  // normalize so the curve fits maxR
  const ratio = (R - r) / r
  const ampEstimate = (R - r) + d
  const scale = maxR / ampEstimate

  const colors = [ACCENT, ACCENT_LIGHT, '#2C5AA0', '#1B3A6B']
  const paths: string[] = []
  for (let p = 0; p < passes; p++) {
    const phase = (p / passes) * Math.PI * 2
    const rot = (p * 13 + rnd() * 20) * (Math.PI / 180)
    const pts: string[] = []
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * turns * Math.PI * 2 + phase
      let x = (R - r) * Math.cos(t) + d * Math.cos(ratio * t)
      let y = (R - r) * Math.sin(t) - d * Math.sin(ratio * t)
      // rotate
      const rx = x * Math.cos(rot) - y * Math.sin(rot)
      const ry = x * Math.sin(rot) + y * Math.cos(rot)
      x = cx + rx * scale
      y = cy + ry * scale
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
    }
    paths.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${colors[p % colors.length]}" stroke-width="0.5" opacity="0.5"/>`
    )
  }
  // concentric guide rings
  const rings = [maxR, maxR * 0.7, maxR * 0.42]
    .map((rr) => `<circle cx="${cx}" cy="${cy}" r="${rr.toFixed(1)}" fill="none" stroke="${ACCENT}" stroke-width="0.4" opacity="0.25"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}${paths.join('')}</svg>`
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a || 1
}

// ---------------------------------------------------------------------------
// Guilloche border frame — intricate wavy border around the page
// ---------------------------------------------------------------------------
export function guillocheBorder(
  seed: string,
  width = A4_W,
  height = A4_H,
  inset = 24
): string {
  const rnd = seedStream('border:' + seed)
  const amp = 5 + rnd() * 5
  const freq = 0.05 + rnd() * 0.04
  const phase = rnd() * Math.PI * 2
  const step = 4

  // build a wavy rounded-rect path that hugs each edge
  function edge(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    normalX: number,
    normalY: number,
    ph: number
  ): string {
    const len = Math.hypot(toX - fromX, toY - fromY)
    const dirX = (toX - fromX) / len
    const dirY = (toY - fromY) / len
    const pts: string[] = []
    for (let s = 0; s <= len; s += step) {
      const w = amp * Math.sin(freq * s + ph)
      const x = fromX + dirX * s + normalX * w
      const y = fromY + dirY * s + normalY * w
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }

  const L = inset
  const T = inset
  const Rt = width - inset
  const B = height - inset

  const lines: string[] = []
  // three nested wavy frames with different phases
  for (let k = 0; k < 3; k++) {
    const pad = k * 5
    const ph = phase + k * 1.1
    const segs = [
      edge(L + pad, T + pad, Rt - pad, T + pad, 0, 1, ph), // top
      edge(Rt - pad, T + pad, Rt - pad, B - pad, -1, 0, ph), // right
      edge(Rt - pad, B - pad, L + pad, B - pad, 0, -1, ph), // bottom
      edge(L + pad, B - pad, L + pad, T + pad, 1, 0, ph), // left
    ]
    lines.push(
      `<polyline points="${segs.join(' ')}" fill="none" stroke="${ACCENT}" stroke-width="${(0.8 - k * 0.15).toFixed(2)}" opacity="${(0.5 - k * 0.1).toFixed(2)}"/>`
    )
  }
  // crisp inner keyline
  lines.push(
    `<rect x="${L - 6}" y="${T - 6}" width="${width - 2 * (L - 6)}" height="${height - 2 * (T - 6)}" fill="none" stroke="${ACCENT}" stroke-width="1.1" opacity="0.6"/>`
  )

  // corner rosettes
  const corners = [
    [L + 6, T + 6],
    [Rt - 6, T + 6],
    [Rt - 6, B - 6],
    [L + 6, B - 6],
  ]
  for (const [cx, cy] of corners) {
    lines.push(cornerRosette(cx, cy, 14, rnd))
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;top:0;left:0;pointer-events:none;">${lines.join('')}</svg>`
}

function cornerRosette(cx: number, cy: number, rad: number, rnd: () => number): string {
  const petals = 6 + Math.floor(rnd() * 4)
  const paths: string[] = []
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    const x = cx + Math.cos(a) * rad
    const y = cy + Math.sin(a) * rad
    paths.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rad * 0.55).toFixed(1)}" fill="none" stroke="${ACCENT}" stroke-width="0.4" opacity="0.4"/>`)
  }
  paths.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${ACCENT}" stroke-width="0.5" opacity="0.5"/>`)
  return paths.join('')
}

// ---------------------------------------------------------------------------
// Microtext line — tiny repeated text forming a thin anti-copy line
// ---------------------------------------------------------------------------
export function microtextLine(
  text: string,
  width: number,
  height = 10
): string {
  const t = (text + ' • ').repeat(Math.ceil(width / ((text.length + 3) * 2.6)) + 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="0" y="${height - 2}" font-family="JetBrains Mono, monospace" font-size="5" letter-spacing="0.4" fill="${ACCENT}" opacity="0.55">${escapeXml(t)}</text></svg>`
}

// ---------------------------------------------------------------------------
// Guilloche fill field — a faint full-width interweaving line field used to
// fill otherwise empty body areas with fine vector line-art (laser friendly).
// ---------------------------------------------------------------------------
export function guillocheField(
  seed: string,
  width: number,
  height: number,
  opacity = 0.1
): string {
  const rnd = seedStream('field:' + seed)
  const numLines = 10 + Math.floor(rnd() * 6)
  const lines: string[] = []
  const colors = [ACCENT, ACCENT_LIGHT, '#2C5AA0']
  for (let i = 0; i < numLines; i++) {
    const amp1 = height * (0.18 + rnd() * 0.22)
    const amp2 = height * (0.06 + rnd() * 0.12)
    const freq1 = 0.006 + rnd() * 0.014
    const freq2 = 0.018 + rnd() * 0.04
    const phase = rnd() * Math.PI * 2
    const yBase = (height / numLines) * i + height / numLines / 2
    const pts: string[] = []
    for (let x = 0; x <= width; x += 4) {
      const y =
        yBase +
        amp1 * Math.sin(freq1 * x + phase) +
        amp2 * Math.sin(freq2 * x + phase * 1.6)
      pts.push(`${x},${y.toFixed(2)}`)
    }
    lines.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="0.45" opacity="${opacity.toFixed(2)}"/>`
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;">${lines.join('')}</svg>`
}

// ---------------------------------------------------------------------------
// Barcode SVG — Code128-like barcode from data hash
// ---------------------------------------------------------------------------
export function barcodeStripes(data: string, width: number, height: number): string {
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  const pattern: number[] = []
  for (let i = 0; i < hash.length; i++) {
    const code = hash.charCodeAt(i)
    const widths = [1, 1, 2, 1, 2]
    for (let b = 0; b < 5; b++) {
      pattern.push(widths[b % 5] * (1 + ((code >> b) & 1)))
    }
  }
  const totalWidth = pattern.reduce((a, b) => a + b, 0)
  const scale = width / totalWidth
  let x = 0
  const bars: string[] = []
  pattern.forEach((w, i) => {
    const sw = w * scale
    if (i % 2 === 0) {
      bars.push(
        `<rect x="${x.toFixed(1)}" y="0" width="${sw.toFixed(1)}" height="${height}" fill="${INK}"/>`
      )
    }
    x += sw
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars.join('')}</svg>`
}

// ---------------------------------------------------------------------------
// MRZ (machine-readable zone) — passport-style monospace strip
// ---------------------------------------------------------------------------
export function mrzLines(fields: {
  type?: string
  country?: string
  surname: string
  number: string
  issued: string
  expires: string
  reg: string
}): string {
  const tr = (s: string) =>
    (s || '')
      .toUpperCase()
      .replace(/[^A-Z0-9А-ЯЁ]/g, '<')
      .replace(/\s+/g, '<')
  const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n)
  const t = (fields.type || 'P').toUpperCase()
  const c = (fields.country || 'PLG').toUpperCase()
  const line1 = pad(`${t}<${c}${tr(fields.surname)}`, 44)
  const line2 = pad(
    `${tr(fields.number)}<${c}<${tr(fields.issued)}<${tr(fields.expires)}<${tr(fields.reg)}`,
    44
  )
  return `${line1}\n${line2}`
}

// ---------------------------------------------------------------------------
// Verification hash (ЭЦП) — sha256(number+signer+date)[:n]
// ---------------------------------------------------------------------------
export function verificationHash(number: string, signer: string, date: string, len = 12): string {
  return crypto
    .createHash('sha256')
    .update(`${number}|${signer}|${date}`)
    .digest('hex')
    .slice(0, len)
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Electronic signature seal / stamp — circular official seal
// ---------------------------------------------------------------------------
export function signatureSeal(options: {
  number: string
  signer: string
  role?: string
  date: string
  size?: number
  rotate?: number
}): string {
  const { number, signer, role = '', date, size = 150, rotate = -8 } = options
  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 4
  const ringR = outerR - 9
  const innerR = ringR - 14
  const hash = verificationHash(number, signer, date)
  const circ = (text: string) =>
    (text + ' • ').repeat(2)

  const topText = circ('ГОСУДАРСТВО ПЕЛЬАГРИЯ')
  const botText = circ('СИСТЕМА СОНАР')

  // emblem star
  const starPts: string[] = []
  const sr = innerR * 0.5
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? sr : sr * 0.42
    starPts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }

  const roleLine = role
    ? `<text x="${cx}" y="${cy + innerR * 0.62}" text-anchor="middle" font-family="Inter, sans-serif" font-size="5.5" fill="${ACCENT}">${escapeXml(role)}</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(${rotate}deg);">
  <defs>
    <path id="seal-top-${hash}" d="M ${cx - (outerR - 7)} ${cy} A ${outerR - 7} ${outerR - 7} 0 1 1 ${cx + (outerR - 7)} ${cy}" />
    <path id="seal-bot-${hash}" d="M ${cx - (ringR - 1)} ${cy} A ${ringR - 1} ${ringR - 1} 0 1 0 ${cx + (ringR - 1)} ${cy}" />
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${ACCENT}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${ACCENT}" stroke-width="1"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${ACCENT}" stroke-width="0.7"/>
  <text font-family="Inter, sans-serif" font-size="7.5" font-weight="700" letter-spacing="1.2" fill="${ACCENT}">
    <textPath href="#seal-top-${hash}" startOffset="0%">${escapeXml(topText)}</textPath>
  </text>
  <text font-family="Inter, sans-serif" font-size="6.5" letter-spacing="1.2" fill="${ACCENT}">
    <textPath href="#seal-bot-${hash}" startOffset="0%">${escapeXml(botText)}</textPath>
  </text>
  <polygon points="${starPts.join(' ')}" fill="none" stroke="${ACCENT}" stroke-width="0.8" opacity="0.85"/>
  <text x="${cx}" y="${cy + innerR * 0.92}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="5.5" fill="${ACCENT}">№${escapeXml(number)}</text>
  ${roleLine}
  </svg>`
}

// HTML block wrapping the seal + ЭЦП verification text for a signature area
export function sealBlock(options: {
  number: string
  signer: string
  role?: string
  date: string
  size?: number
}): string {
  const { number, signer, role, date, size = 140 } = options
  const hash = verificationHash(number, signer, date)
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
    <div style="width:${size}px;height:${size}px;">${signatureSeal({ number, signer, role, date, size })}</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${ACCENT};letter-spacing:0.04em;text-align:center;">
      <span style="color:#9CA3AF;">ЭЦП:</span> ${hash}
    </div>
  </div>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ---------------------------------------------------------------------------
// Shared full-page document shell
// ---------------------------------------------------------------------------
export interface PageShellOptions {
  seed: string
  /** header inner HTML (the dark bar contents) */
  header: string
  /** main body HTML (grows to fill) */
  body: string
  /** footer HTML pinned to the bottom of the sheet */
  footer: string
  /** extra <style> rules specific to the document */
  styles?: string
  /** background fill watermark behind the body (e.g. faint rosette) */
  watermark?: string
  /** accent color for this doc type */
  accent?: string
  /** kind id used for body class hooks */
  kind?: string
}

/**
 * Renders a complete A4 page with a guilloche border frame, microtext strips,
 * a header bar, a flex body that fills the sheet, and a pinned footer.
 * Laser-friendly: light backgrounds, fine SVG line art, one dark header bar.
 */
export function pageShell(opts: PageShellOptions): string {
  const accent = opts.accent ?? ACCENT
  const border = guillocheBorder(opts.seed)
  const micro = microtextLine('ПЕЛЬАГРИЯ • СОНАР', A4_W - 96)
  const watermark = opts.watermark ?? ''
  const controlCode = `СОНАР-${verificationHash(opts.seed, opts.kind ?? 'DOC', 'PRINT')}`
  const controlBarcode = barcodeStripes(controlCode, 250, 34)
  const securityRosette = guillocheRosette(`${opts.seed}:security`, 96)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${GOOGLE_FONTS}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #FFFFFF; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet {
    position: relative;
    width: ${A4_W}px;
    min-height: ${A4_H}px;
    background: #FFFFFF;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sheet-border { position: absolute; inset: 0; z-index: 0; }
  .sheet-inner {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 30px;
    min-height: calc(${A4_H}px - 60px);
  }
  .doc-watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.06;
    z-index: 0;
    pointer-events: none;
  }
  .doc-body { position: relative; z-index: 1; flex: 1; }
  .doc-microstrip { height: 10px; overflow: hidden; opacity: 0.8; margin: 6px 0; }
  .document-security {
    display: grid;
    grid-template-columns: 86px 1fr 250px;
    align-items: center;
    gap: 14px;
    border-top: 2px solid #111;
    border-bottom: 1px solid #777;
    margin-top: 14px;
    padding: 8px 0;
    color: #111;
  }
  .document-security-rosette { width: 62px; height: 62px; filter: grayscale(1) contrast(1.5); }
  .document-security-rosette svg { width: 62px; height: 62px; }
  .document-security-title { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .document-security-copy { font-size: 8px; line-height: 1.45; color: #444; margin-top: 4px; }
  .document-security-code { font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: .04em; margin-top: 2px; }
  .document-security-barcode { text-align: right; }
  .document-security-barcode svg { filter: grayscale(1) contrast(2); }
  @media print {
    * { color: #000 !important; border-color: #222 !important; text-shadow: none !important; box-shadow: none !important; }
    .sheet { filter: grayscale(1) contrast(1.08); }
    .doc-watermark { opacity: .045; }
    svg { shape-rendering: crispEdges; }
  }
  ${opts.accent ? `.accent { color: ${accent}; }` : ''}
  ${opts.styles ?? ''}
</style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-border">${border}</div>
    <div class="sheet-inner">
      ${opts.header}
      <div class="doc-microstrip">${micro}</div>
      ${watermark ? `<div class="doc-watermark">${watermark}</div>` : ''}
      <div class="doc-body">
        ${opts.body}
      </div>
      <div class="doc-microstrip">${micro}</div>
      ${opts.footer}
      <div class="document-security">
        <div class="document-security-rosette">${securityRosette}</div>
        <div>
          <div class="document-security-title">Контроль печатного документа СОНАР</div>
          <div class="document-security-copy">Подлинность проверяется по ШК и контрольному рисунку. Копия сохраняет юридическую силу только при совпадении реквизитов реестра.</div>
          <div class="document-security-code">${controlCode}</div>
        </div>
        <div class="document-security-barcode">${controlBarcode}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

/** Standard dark header bar contents builder (reusable). */
export function headerBar(opts: {
  title: string
  subtitle?: string
  number?: string
  date?: string
  accent?: string
}): string {
  const accent = opts.accent ?? ACCENT_LIGHT
  return `<div style="background:${INK};display:flex;align-items:center;padding:0 28px;height:86px;border-radius:2px;">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:3px;width:180px;flex-shrink:0;line-height:1.6;">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
    <div style="flex:1;text-align:center;">
      <div style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${opts.title}</div>
      ${opts.subtitle ? `<div style="color:rgba(255,255,255,0.55);font-size:11px;margin-top:4px;letter-spacing:0.05em;">${opts.subtitle}</div>` : ''}
      ${opts.number ? `<div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:${accent};margin-top:5px;letter-spacing:0.05em;">${opts.number}</div>` : ''}
    </div>
    <div style="width:180px;flex-shrink:0;text-align:right;font-size:12px;color:rgba(255,255,255,0.5);">${opts.date ?? ''}</div>
  </div>`
}

/** Standard light footer strip (system + print date). */
export function footerStrip(extra?: string): string {
  const printDate = new Date().toLocaleDateString('ru-RU')
  return `<div style="border-top:1px solid #E5E7EB;padding-top:10px;margin-top:14px;display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF;">
    <span>${extra ?? 'Государственная информационная система СОНАР'}</span>
    <span>Дата печати: ${printDate}</span>
  </div>`
}

/** Parse an optional ISO date string; returns Date or null. Throws on invalid. */
export function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null
  const d = new Date(value as string)
  if (isNaN(d.getTime())) {
    throw new Error('invalid-date')
  }
  return d
}

export { ACCENT, ACCENT_LIGHT, INK }
