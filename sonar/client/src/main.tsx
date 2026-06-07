import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/animations.css'
import { ToastProvider } from './components/ui/Toast'

const globalStyle = document.createElement('style')
globalStyle.textContent = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: Inter, sans-serif;
    background: #F1F5F9;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #D0D7E3;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
  }
`
document.head.appendChild(globalStyle)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
