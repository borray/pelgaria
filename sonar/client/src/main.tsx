import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/animations.css'
import './styles/design-system.css'
import './styles/renovation.css'
import './styles/renovation-pages.css'
import './styles/renovation-v3.css'
import './styles/renovation-v4.css'
import './styles/renovation-v5.css'
import './styles/renovation-v6.css'
import './styles/renovation-v7.css'
import './styles/renovation-v8.css'
import './styles/landing.css'
import { ToastProvider } from './components/ui/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// PWA: регистрируем service worker (только в продакшене)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
