import { useEffect, useState } from 'react'
import { FoundationPage } from './pages/FoundationPage'
import { SonarWorkspace } from './pages/SonarWorkspace'

export default function App() {
  const [isSonarOpen, setSonarOpen] = useState(() => window.location.hash === '#sonar')

  useEffect(() => {
    document.title = isSonarOpen ? 'СОНАР · Пельград' : 'Пельгария · основание мира'
  }, [isSonarOpen])

  const openSonar = () => {
    window.history.pushState(null, '', '#sonar')
    setSonarOpen(true)
  }

  const closeSonar = () => {
    window.history.pushState(null, '', window.location.pathname)
    setSonarOpen(false)
  }

  return isSonarOpen ? <SonarWorkspace onExit={closeSonar} /> : <FoundationPage onOpenSonar={openSonar} />
}
