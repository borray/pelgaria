import puppeteer from 'puppeteer-core'
import { accessSync, constants } from 'fs'
import path from 'path'

let cachedBrowserPath: string | null = null

function isExecutable(candidate: string): boolean {
  try {
    accessSync(candidate, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function findChromium(): string {
  if (cachedBrowserPath) return cachedBrowserPath

  const envCandidates = [
    process.env.CHROMIUM_PATH,
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].filter((value): value is string => Boolean(value))

  const localAppData = process.env.LOCALAPPDATA ?? ''
  const programFiles = process.env.PROGRAMFILES ?? 'C:\\Program Files'
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'
  const candidates = [
    ...envCandidates,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]

  const executable = candidates.find(isExecutable)
  if (!executable) {
    throw new Error(
      'Не найден браузер для формирования PDF. Укажите CHROMIUM_PATH или установите Chrome, Edge либо Chromium.'
    )
  }
  cachedBrowserPath = executable
  return executable
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: findChromium(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=medium',
    ],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page.emulateMediaType('print')
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => window.setTimeout(resolve, 2_500)),
        ])
      }
    })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
