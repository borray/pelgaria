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
  const contentType = response.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) {
      const data = await response.json() as { error?: string }
      return data.error || `Ошибка формирования документа (${response.status})`
    }

    const raw = (await response.text())
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (raw && raw.length < 180) return raw
    if (contentType.includes('text/html')) {
      return `Сервер вернул страницу вместо PDF (${response.status}). Повторите попытку позже.`
    }
    return `Ошибка формирования документа (${response.status})`
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
  documentWindow.document.documentElement.lang = 'ru'
  documentWindow.document.body.innerHTML = `
    <style>
      *{box-sizing:border-box}html,body{min-height:100%;margin:0}body{display:grid;place-items:center;padding:28px;color:#eaf7f3;background:
      linear-gradient(rgba(103,211,183,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(103,211,183,.035) 1px,transparent 1px),
      radial-gradient(circle at 50% 42%,rgba(64,184,151,.13),transparent 30%),#071712;background-size:34px 34px,34px 34px,auto,auto;
      font:14px/1.5 Inter,'Segoe UI',Arial,sans-serif;overflow:hidden}
      .shell{width:min(760px,100%);display:grid;grid-template-columns:250px minmax(0,1fr);overflow:hidden;border:1px solid rgba(115,221,194,.18);
      border-radius:24px;background:rgba(11,34,28,.9);box-shadow:0 40px 120px rgba(0,0,0,.36);backdrop-filter:blur(12px)}
      .visual{position:relative;min-height:420px;display:grid;place-items:center;overflow:hidden;border-right:1px solid rgba(115,221,194,.12);
      background:radial-gradient(circle,rgba(85,211,178,.12),transparent 52%)}
      .visual:before,.visual:after,.orbit{content:"";position:absolute;border:1px solid rgba(104,218,188,.14);border-radius:50%}
      .visual:before{width:190px;height:190px}.visual:after{width:135px;height:135px}.orbit{width:245px;height:245px;animation:spin 8s linear infinite}
      .orbit:before{content:"";position:absolute;top:26px;right:25px;width:8px;height:8px;border-radius:50%;background:#67d3b7;box-shadow:0 0 18px #67d3b7}
      .pulse{position:relative;z-index:2;width:94px;height:94px;display:grid;place-items:center;border:1px solid rgba(105,218,189,.28);border-radius:28px;
      color:#69d5b8;background:#0d3027;box-shadow:0 0 0 13px rgba(103,211,183,.035)}
      .pulse svg{width:42px;height:42px}.scan{position:absolute;z-index:3;left:22px;right:22px;height:2px;background:linear-gradient(90deg,transparent,#67d3b7,transparent);
      box-shadow:0 0 14px #67d3b7;animation:scan 2s ease-in-out infinite}
      .copy{padding:42px}.brand{display:flex;align-items:center;gap:9px;color:#67d3b7;font-size:10px;font-weight:800;letter-spacing:.16em}
      .brand i{width:8px;height:8px;border-radius:50%;background:#67d3b7;box-shadow:0 0 0 5px rgba(103,211,183,.08)}
      h1{max-width:370px;margin:25px 0 10px;color:#fff;font-size:31px;line-height:1.08;letter-spacing:-.045em}
      p{max-width:390px;margin:0;color:#82a299;font-size:12px}.steps{display:grid;gap:9px;margin-top:30px}
      .step{min-height:48px;display:grid;grid-template-columns:28px minmax(0,1fr) 8px;align-items:center;gap:10px;padding:0 13px;border:1px solid rgba(116,203,181,.1);
      border-radius:12px;color:#6f8e85;background:rgba(255,255,255,.025);font-size:10px}
      .step b{font:700 9px Consolas,monospace}.step i{width:6px;height:6px;border-radius:50%;background:#35584f}
      .step.active{color:#dff5ef;border-color:rgba(103,211,183,.22);background:rgba(103,211,183,.06)}.step.active b{color:#67d3b7}
      .step.active i{background:#67d3b7;box-shadow:0 0 0 5px rgba(103,211,183,.07);animation:blink 1.2s ease-in-out infinite}
      footer{margin-top:28px;color:#4e7067;font-size:9px;letter-spacing:.05em;text-transform:uppercase}
      @keyframes spin{to{transform:rotate(360deg)}}@keyframes scan{0%,100%{top:90px;opacity:.25}50%{top:330px;opacity:1}}@keyframes blink{50%{opacity:.35}}
      @media(max-width:620px){.shell{grid-template-columns:1fr}.visual{min-height:190px;border-right:0;border-bottom:1px solid rgba(115,221,194,.12)}
      .visual:before{width:145px;height:145px}.visual:after{width:100px;height:100px}.orbit{width:180px;height:180px}.scan{animation:none;top:95px}.copy{padding:28px}}
      @media(prefers-reduced-motion:reduce){.orbit,.scan,.step.active i{animation:none}}
    </style>
    <main class="shell">
      <section class="visual">
        <div class="orbit"></div>
        <div class="pulse">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M14 35V15a4 4 0 0 1 4-4h17M20 35V21a4 4 0 0 1 4-4h11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="34" r="4" fill="currentColor"/></svg>
        </div>
        <div class="scan"></div>
      </section>
      <section class="copy">
        <div class="brand"><i></i> СОНАР · ПЕЧАТНЫЙ КОНТУР</div>
        <h1>Формируем документ</h1>
        <p>Не закрывайте эту вкладку. Готовый PDF откроется здесь автоматически после проверки данных.</p>
        <div class="steps">
          <div class="step active"><b>01</b><span>Подготовка печатного макета</span><i></i></div>
          <div class="step"><b>02</b><span>Добавление ШК и реквизитов</span><i></i></div>
          <div class="step"><b>03</b><span>Открытие готового документа</span><i></i></div>
        </div>
        <footer>Защищённая операция · окно обновится автоматически</footer>
      </section>
    </main>
  `

  try {
    const [response] = await Promise.all([
      responsePromise,
      new Promise<void>((resolve) => window.setTimeout(resolve, 7000)),
    ])
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
      <style>*{box-sizing:border-box}body{min-height:100vh;display:grid;place-items:center;margin:0;padding:24px;color:#38201d;background:#f7f3f1;font:14px/1.55 Inter,'Segoe UI',Arial,sans-serif}
      main{width:min(560px,100%);padding:36px;border:1px solid #e4c6c0;border-radius:20px;background:#fff;box-shadow:0 24px 70px rgba(77,37,29,.11)}
      .mark{width:54px;height:54px;display:grid;place-items:center;border-radius:17px;color:#a43f33;background:#f9e8e5;font-size:25px;font-weight:800}
      small{display:block;margin-top:24px;color:#a43f33;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
      h1{margin:8px 0 10px;font-size:27px;letter-spacing:-.035em}p{margin:0;color:#755750}button{margin-top:24px;padding:11px 16px;border:1px solid #d5b5af;border-radius:10px;color:#5d3934;background:#fff;font-weight:650;cursor:pointer}</style>
      <main><div class="mark">!</div><small>СОНАР · Печатный контур</small><h1>Документ не сформирован</h1><p>${escapeHtml(message)}</p><button onclick="window.close()">Закрыть окно</button></main>
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
