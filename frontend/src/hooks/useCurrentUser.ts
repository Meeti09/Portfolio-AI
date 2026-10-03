import { useEffect, useState } from 'react'
import { axiosInstance } from '@/api/axios'
import { useAuthStore } from '@/app/store'
import type { AuthUser } from '@/types/auth.types'

let inflight: Promise<AuthUser | null> | null = null

async function loadUser(): Promise<AuthUser | null> {
  if (!inflight) {
    inflight = axiosInstance
      .get<AuthUser>('/me')
      .then(({ data }) => {
        useAuthStore.getState().setUser(data)
        return data
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * The logged-in account.
 *
 * Login stores the profile immediately, but a page reload may restore tokens
 * from an older session shape without a cached profile. This hook fills the
 * gap once, sharing one in-flight request between every caller.
 */
export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(() => Boolean(accessToken) && !user)

  useEffect(() => {
    let cancelled = false

    if (!accessToken || user) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    void loadUser().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [accessToken, user])

  return { user, loading }
}