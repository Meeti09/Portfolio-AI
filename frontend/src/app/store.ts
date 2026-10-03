import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AuthUser } from '@/types/auth.types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
  setUser: (user: AuthUser) => void
  clearToken: () => void
}

/**
 * Auth session.
 *
 * Persisted to sessionStorage so a page reload keeps you signed in for the tab,
 * while closing the tab ends the session. localStorage is deliberately avoided:
 * it would leave tokens readable by any script on the origin long after the user
 * believed they had logged out.
 *
 * The profile (`user`) is cached here for the same tab lifetime so the navbar
 * avatar and the dashboard age check work immediately after a reload.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      clearToken: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'investment-engine-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Persist the session. isAuthenticated is re-derived on rehydrate.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isAuthenticated = Boolean(state.accessToken)
      },
    }
  )
)