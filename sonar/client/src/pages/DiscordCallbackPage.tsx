import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import type { User } from '../types'

export function DiscordCallbackPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    const userParam = params.get('user')

    if (accessToken && refreshToken && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam)) as User
        setTokens(accessToken, refreshToken, user)
        navigate('/', { replace: true })
      } catch {
        navigate('/login?error=discord', { replace: true })
      }
    } else {
      navigate('/login?error=discord', { replace: true })
    }
  }, [navigate, setTokens])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A1628 0%, #0D2444 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '14px',
      }}
    >
      Авторизация через Discord...
    </div>
  )
}
