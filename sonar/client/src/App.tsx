import { useEffect } from 'react'
import { FoundationPage } from './pages/FoundationPage'

export default function App() {
  useEffect(() => {
    document.title = 'Пельгария · основание мира'
  }, [])

  return <FoundationPage />
}
