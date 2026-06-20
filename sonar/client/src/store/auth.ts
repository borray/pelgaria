import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string, user: User) => void
  setUser: (user: User) => void
  hasPermission: (perm: string) => boolean
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    if (response.status >= 500) {
      throw new Error('СОНАР временно недоступен. Сервер не отвечает, попробуйте войти через несколько минут.')
    }
    throw new Error('Сервер вернул некорректный ответ. Обновите страницу и повторите попытку.')
  }

  return response.json()
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (login: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password }),
          })

          const data = await readApiResponse(response)

          if (!response.ok) {
            throw new Error(data.error || 'Ошибка входа')
          }

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null })
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          get().logout()
          return
        }

        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })

        if (!response.ok) {
          get().logout()
          return
        }

        const data = await readApiResponse(response)
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          ...(data.user ? { user: data.user } : {}),
        })
      },

      setTokens: (accessToken: string, refreshToken: string, user: User) => {
        set({ accessToken, refreshToken, user })
      },

      setUser: (user: User) => set({ user }),

      hasPermission: (perm: string) => {
        const { user } = get()
        if (!user) return false
        // Суперадмин (Председатель Верховного Совета) проходит любую проверку прав —
        // согласовано с серверным requirePermission.
        if (user.permissions?.['system.superadmin'] === true) return true
        return user.permissions?.[perm] === true
      },
    }),
    {
      name: 'sonar-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
