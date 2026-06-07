import crypto from 'crypto'

const GOOGLE_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');`

// ---------------------------------------------------------------------------
// Guilloche SVG — sinusoidal wave pattern based on seed string
// ---------------------------------------------------------------------------
export function guillochePattern(seed: string, width: number, height: number): string {
  const chars = seed.split('').map((c) => c.charCodeAt(0))
  const numLines = 5 + (chars[0] % 3) // 5–7 lines
  const lines: string[] = []
  for (let i = 0; i < numLines; i++) {
    const amp = 5 + (chars[i % chars.length] % 9) * 2
    const freq = 0.012 + (chars[(i + 1) % chars.length] % 10) * 0.003
    const phase = (chars[(i + 2) % chars.length] % 10) * 0.5
    const yBase = (height / numLines) * i + height / numLines / 2
    const pts: string[] = []
    for (let x = 0; x <= width; x += 4) {
      const y = yBase + amp * Math.sin(freq * x + phase)
      pts.push(`${x},${y.toFixed(2)}`)
    }
    lines.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="#1B3A6B" stroke-width="0.8" opacity="0.15"/>`
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join('')}</svg>`
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
        `<rect x="${x.toFixed(1)}" y="0" width="${sw.toFixed(1)}" height="${height}" fill="#0A1628"/>`
      )
    }
    x += sw
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${bars.join('')}</svg>`
}

// ---------------------------------------------------------------------------
// Document base template
// ---------------------------------------------------------------------------
export function documentBase(
  content: string,
  options: {
    title?: string
    subtitle?: string
    number?: string
    showGuilloche?: boolean
    date?: string
  } = {}
): string {
  const {
    title = 'ДОКУМЕНТ',
    subtitle,
    number,
    showGuilloche = true,
    date = new Date().toLocaleDateString('ru-RU'),
  } = options

  const guilloche = showGuilloche && number ? guillochePattern(number, 794, 40) : ''
  const printDate = new Date().toLocaleDateString('ru-RU')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${GOOGLE_FONTS}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #FFFFFF; font-family: 'Inter', sans-serif; }
  .doc-header {
    background: #0A1628;
    height: 80px;
    display: flex;
    align-items: center;
    padding: 0 40px;
    gap: 0;
  }
  .doc-header-left {
    font-size: 12px;
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    letter-spacing: 3px;
    width: 200px;
    flex-shrink: 0;
  }
  .doc-header-center {
    flex: 1;
    text-align: center;
  }
  .doc-header-title {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .doc-header-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #4A90D9;
    margin-top: 4px;
    letter-spacing: 0.04em;
  }
  .doc-header-right {
    width: 200px;
    flex-shrink: 0;
    text-align: right;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }
  .doc-guilloche {
    overflow: hidden;
    height: 40px;
    background: #F8F9FB;
  }
  .doc-content {
    padding: 40px;
  }
  .doc-footer {
    border-top: 1px solid #E5E7EB;
    padding: 16px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #F8F9FB;
    font-size: 11px;
    color: #9CA3AF;
    margin-top: 40px;
  }
</style>
</head>
<body>
<div class="doc-header">
  <div class="doc-header-left">ГОСУДАРСТВО<br>ПЕЛЬАГРИЯ</div>
  <div class="doc-header-center">
    <div class="doc-header-title">${title}</div>
    ${subtitle ? `<div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:3px;letter-spacing:0.05em;">${subtitle}</div>` : ''}
    ${number ? `<div class="doc-header-number">${number}</div>` : ''}
  </div>
  <div class="doc-header-right">${date}</div>
</div>
${showGuilloche && number ? `<div class="doc-guilloche">${guilloche}</div>` : ''}
<div class="doc-content">
  ${content}
</div>
<div class="doc-footer">
  <span>Государственная информационная система СОНАР</span>
  <span>Дата печати: ${printDate}</span>
</div>
</body>
</html>`
}
