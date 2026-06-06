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
  hasPermission: (perm: string) => boolean
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

          const data = await response.json()

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

        const data = await response.json()
        set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      },

      setTokens: (accessToken: string, refreshToken: string, user: User) => {
        set({ accessToken, refreshToken, user })
      },

      hasPermission: (perm: string) => {
        const { user } = get()
        if (!user) return false
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
