import { useAuthStore } from '../store/auth'

export async function downloadPdf(url: string, filename: string): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken
  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  if (!response.ok) {
    throw new Error(`Ошибка генерации PDF: ${response.statusText}`)
  }
  const blob = await response.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export async function downloadPdfPost(url: string, filename: string): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(`Ошибка генерации PDF: ${response.statusText}`)
  }
  const blob = await response.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
