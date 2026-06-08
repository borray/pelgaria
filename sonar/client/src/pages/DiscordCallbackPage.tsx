import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SonarBrand } from '../components/brand/SonarBrand'
import { useAuthStore } from '../store/auth'
import type { User } from '../types'

export function DiscordCallbackPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((state) => state.setTokens)

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
        return
      } catch {
        // Redirect below.
      }
    }
    navigate('/login?error=discord', { replace: true })
  }, [navigate, setTokens])

  return (
    <main className="auth-progress">
      <SonarBrand size="md" />
      <span className="auth-progress-spinner" />
      <strong>Завершаем вход через Discord</strong>
      <p>Проверяем служебную учётную запись.</p>
    </main>
  )
}
