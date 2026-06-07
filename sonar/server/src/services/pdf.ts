import puppeteer from 'puppeteer-core'
import { execSync } from 'child_process'

function findChromium(): string {
  const envPath = process.env.CHROMIUM_PATH
  if (envPath) {
    try {
      execSync(`test -x ${envPath}`)
      return envPath
    } catch {}
  }
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]
  for (const p of candidates) {
    try {
      execSync(`test -x ${p}`)
      return p
    } catch {}
  }
  throw new Error('Chromium не найден. Установите: sudo apt-get install chromium-browser')
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: findChromium(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
