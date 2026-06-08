import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { accessSync, constants } from 'fs'
import path from 'path'
import crypto from 'crypto'

let cachedBrowserPath: string | null = null
let packagedBrowser = false
let browserPromise: Promise<Browser> | null = null
let queueTail: Promise<void> = Promise.resolve()

function isExecutable(candidate: string): boolean {
  try {
    accessSync(candidate, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function findChromium(): Promise<string> {
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

  const systemExecutable = process.env.SONAR_BUNDLED_CHROMIUM === '1'
    ? undefined
    : candidates.find(isExecutable)
  if (systemExecutable) {
    cachedBrowserPath = systemExecutable
    return systemExecutable
  }

  try {
    const bundledExecutable = await chromium.executablePath()
    if (isExecutable(bundledExecutable)) {
      packagedBrowser = true
      cachedBrowserPath = bundledExecutable
      return bundledExecutable
    }
  } catch (error) {
    console.error('Bundled Chromium initialization failed', error)
  }

  throw new Error('Модуль формирования PDF не смог запустить встроенный браузер.')
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = await findChromium()
  const browser = await puppeteer.launch({
    executablePath,
    args: [...(packagedBrowser ? chromium.args : []),
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=medium',
    ],
    headless: packagedBrowser ? chromium.headless : true,
  })

  browser.once('disconnected', () => {
    browserPromise = null
  })
  return browser
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null
      throw error
    })
  }

  const browser = await browserPromise
  if (browser.connected) return browser

  browserPromise = null
  return getBrowser()
}

async function discardBrowser(): Promise<void> {
  const current = browserPromise
  browserPromise = null
  if (!current) return

  try {
    const browser = await current
    if (browser.connected) await browser.close()
  } catch {
    // The original rendering error is more useful than a cleanup failure.
  }
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
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
    await page.close().catch(() => undefined)
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const previousJob = queueTail
  let releaseQueue!: () => void
  queueTail = new Promise<void>((resolve) => {
    releaseQueue = resolve
  })

  await previousJob
  try {
    try {
      return await renderPdf(html)
    } catch (firstError) {
      console.error('PDF render attempt failed, restarting Chromium', firstError)
      await discardBrowser()
      return await renderPdf(html)
    }
  } finally {
    releaseQueue()
  }
}

export async function closePdfBrowser(): Promise<void> {
  await discardBrowser()
}

export function pdfError(error: unknown, context: string): { error: string; errorId: string } {
  const errorId = crypto.randomBytes(4).toString('hex').toUpperCase()
  console.error(`[PDF ${errorId}] ${context}`, error)
  return {
    error: `Не удалось сформировать документ. Код ошибки: ${errorId}`,
    errorId,
  }
}

export function pdfHeaders(pdf: Buffer, filename: string): Record<string, string> {
  const utf8Filename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  const asciiFilename = utf8Filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\;]/g, '_')
    .trim() || 'sonar-document.pdf'
  const encodedFilename = encodeURIComponent(utf8Filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )

  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
    'Content-Length': String(pdf.length),
  }
}
