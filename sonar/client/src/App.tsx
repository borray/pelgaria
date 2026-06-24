import { useEffect, useState } from 'react'
import { AuthPage, type SonarAccount } from './pages/AuthPage'
import { FoundationPage } from './pages/FoundationPage'
import { SonarWorkspace } from './pages/SonarWorkspace'

export default function App() {
  const [isSonarOpen, setSonarOpen] = useState(() => window.location.hash === '#sonar')
  const [account, setAccount] = useState<SonarAccount | null>(null)
  const [isCheckingSession, setCheckingSession] = useState(() => window.location.hash === '#sonar')

  useEffect(() => {
    document.title = isSonarOpen ? 'СОНАР · Пельград' : 'Пельгария · основание мира'
  }, [isSonarOpen])

  useEffect(() => {
    if (!isSonarOpen) { setCheckingSession(false); return }
    const controller = new AbortController()
    setCheckingSession(true)
    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ account: SonarAccount }> : null)
      .then((body) => setAccount(body?.account ?? null))
      .catch(() => setAccount(null))
      .finally(() => setCheckingSession(false))
    return () => controller.abort()
  }, [isSonarOpen])

  const openSonar = () => {
    window.history.pushState(null, '', '#sonar')
    setSonarOpen(true)
  }

  const closeSonar = () => {
    window.history.pushState(null, '', window.location.pathname)
    setAccount(null)
    setSonarOpen(false)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    setAccount(null)
  }

  if (!isSonarOpen) return <FoundationPage onOpenSonar={openSonar} />
  if (isCheckingSession) return <main className="portal-loading"><span /><p>Открываем СОНАР</p></main>
  if (!account) return <AuthPage onAuthenticated={setAccount} onExit={closeSonar} />
  return <SonarWorkspace account={account} onExit={closeSonar} onLogout={logout} />
}
