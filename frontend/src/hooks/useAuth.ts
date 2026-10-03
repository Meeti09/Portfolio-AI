import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { axiosInstance } from '@/api/axios'
import { useAuthStore } from '@/app/store'
import { normalizeError } from '@/utils/errorHandler'
import { useToast } from './useToast'
import type { LoginPayload, AuthResponse, AuthUser } from '@/types/auth.types'
import type { SignUpFormData } from '@/schemas/auth.schema'

export function useAuth() {
  const { setTokens, setUser, clearToken } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { data } = await axiosInstance.post<AuthResponse>('/login', payload)
      setTokens(data)
      try {
        // Cache the profile so the navbar avatar and dashboard age check work
        // immediately. If this fails, useCurrentUser() retries on next render.
        const me = await axiosInstance.get<AuthUser>('/me')
        setUser(me.data)
      } catch {
        /* profile loads lazily via useCurrentUser */
      }
      navigate('/dashboard', { replace: true })
    },
    [setTokens, setUser, navigate]
  )

  const signUp = useCallback(
    async (payload: SignUpFormData) => {
      // confirmPassword is a client-side concern; the backend does not want it.
      const { confirmPassword: _confirmPassword, ...body } = payload
      await axiosInstance.post('/signup', body)
      toast.success('Account created! Please log in.')
      navigate('/login', { replace: true })
    },
    [navigate, toast]
  )

  const logout = useCallback(() => {
    // Best-effort server call; the tokens are discarded either way.
    void axiosInstance.post('/logout').catch(() => undefined)
    clearToken()
    navigate('/login', { replace: true })
  }, [clearToken, navigate])

  return { login, signUp, logout, normalizeError }
}