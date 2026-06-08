import { useAuthStore } from '../store/auth'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function confirmDocumentFormation(
  title = 'Сформировать документ',
  description = 'Система подготовит PDF и откроет его в новой вкладке.'
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const dialog = document.createElement('dialog')
    dialog.className = 'formation-dialog'
    dialog.innerHTML = `
      <form method="dialog" class="formation-dialog-card">
        <div class="formation-dialog-head">
          <span>Формирование документа</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        <div class="formation-dialog-note">
          Проверьте исходные сведения. После подтверждения документ будет сформирован в PDF.
        </div>
        <div class="formation-dialog-actions">
          <button value="cancel" class="formation-dialog-cancel">Отмена</button>
          <button value="confirm" class="formation-dialog-confirm">Сформировать</button>
        </div>
      </form>
    `
    const finish = (result: boolean) => {
      if (settled) return
      settled = true
      if (dialog.open) dialog.close()
      dialog.remove()
      resolve(result)
    }
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault()
      finish(false)
    })
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false)
    })
    dialog.addEventListener('close', () => {
      if (settled) return
      settled = true
      const confirmed = dialog.returnValue === 'confirm'
      if (dialog.isConnected) dialog.remove()
      resolve(confirmed)
    }, { once: true })
    document.body.appendChild(dialog)
    dialog.showModal()
  })
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string }
    return data.error || `Ошибка формирования документа (${response.status})`
  } catch {
    return `Ошибка формирования документа (${response.status})`
  }
}

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const request = (token: string | null) => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }

  let response = await request(useAuthStore.getState().accessToken)
  if (response.status !== 401 || !useAuthStore.getState().refreshToken) return response

  await useAuthStore.getState().refresh()
  const refreshedToken = useAuthStore.getState().accessToken
  if (!refreshedToken) return response

  response = await request(refreshedToken)
  return response
}

async function openPdf(responsePromise: Promise<Response>): Promise<void> {
  const documentWindow = window.open('', 'sonar-document')
  if (!documentWindow) {
    throw new Error('Разрешите открытие новой вкладки для сформированного документа')
  }

  documentWindow.document.title = 'СОНАР — формирование документа'
  documentWindow.document.body.innerHTML = `
    <main style="font: 15px/1.5 'Segoe UI',Arial,sans-serif; max-width: 520px; margin: 18vh auto; padding: 36px; color: #17231f;">
      <div style="color: #19705a; font-size: 12px; font-weight: 700;">СОНАР</div>
      <h1 style="font-size: 25px; margin: 16px 0 8px;">Подготовка документа</h1>
      <p style="margin: 0; color: #68756f;">Окно обновится автоматически, когда PDF будет готов.</p>
    </main>
  `

  try {
    const response = await responsePromise
    if (!response.ok) throw new Error(await readError(response))

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/pdf')) {
      throw new Error('Сервер вернул ответ в неверном формате')
    }

    const blob = await response.blob()
    if (blob.size < 100) throw new Error('Сформирован пустой документ')

    const url = URL.createObjectURL(blob)
    documentWindow.location.replace(url)
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось сформировать документ'
    documentWindow.document.body.innerHTML = `
      <main style="font: 15px/1.5 'Segoe UI',Arial,sans-serif; max-width: 520px; margin: 18vh auto; padding: 36px; color: #46231f;">
        <div style="color: #a33a2b; font-size: 12px; font-weight: 700;">СОНАР</div>
        <h1 style="font-size: 25px; margin: 16px 0 8px;">Документ не сформирован</h1>
        <p style="margin: 0; color: #71534e;">${escapeHtml(message)}</p>
      </main>
    `
  }
}

export async function printPdf(url: string, confirmed = false): Promise<void> {
  if (!confirmed && !await confirmDocumentFormation()) return
  await openPdf(authenticatedFetch(url))
}

export async function printPdfPost(url: string, confirmed = false): Promise<void> {
  if (!confirmed && !await confirmDocumentFormation()) return
  await openPdf(authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }))
}
