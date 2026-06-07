import { useAuthStore } from '../store/auth'

async function printResponse(responsePromise: Promise<Response>): Promise<void> {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Разрешите всплывающие окна для печати документа')
  }

  printWindow.document.write(`
    <!doctype html>
    <title>СОНАР · Подготовка документа</title>
    <style>
      body{margin:0;display:grid;place-items:center;min-height:100vh;background:#07111f;color:#dbe7f5;font:14px Inter,Arial,sans-serif}
      div{text-align:center}b{display:block;margin-bottom:8px;font-size:18px;letter-spacing:.08em}span{color:#849ab5}
    </style>
    <div><b>СОНАР</b><span>Подготовка документа к печати...</span></div>
  `)

  try {
    const response = await responsePromise
    if (!response.ok) {
      throw new Error(`Ошибка генерации PDF: ${response.statusText}`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    printWindow.location.replace(url)
    printWindow.addEventListener('load', () => {
      window.setTimeout(() => {
        printWindow.focus()
        printWindow.print()
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }, 450)
    }, { once: true })
  } catch (error) {
    printWindow.close()
    throw error
  }
}

export async function printPdf(url: string): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken
  await printResponse(fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  }))
}

export async function printPdfPost(url: string): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken
  await printResponse(fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  }))
}
