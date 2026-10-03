import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { axiosInstance } from './axios'
import { useAuthStore } from '@/app/store'
import type { AuthTokens } from '@/types/auth.types'

interface QueueItem {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let isRefreshing = false
let failedQueue: QueueItem[] = []

/** End the session and send the user back to the login screen. */
function forceLogout(): void {
  useAuthStore.getState().clearToken()
  // Only redirect when there is a router to redirect; guard keeps tests and
  // non-browser environments from blowing up.
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.replace('/login')
  }
}

const processQueue = (error: unknown, token: string | null): void => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

export function setupInterceptors(): void {
  // ── Request: attach the bearer token ────────────────────────────────────
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const { accessToken } = useAuthStore.getState()
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      return config
    },
    (error: unknown) => Promise.reject(error)
  )

  // ── Response: silent refresh on 401 ─────────────────────────────────────
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetriableRequest | undefined

      // Nothing to retry, or the refresh call itself failed.
      if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error)
      }

      // Never try to refresh in response to a failed refresh.
      if (originalRequest.url?.includes('/refresh-token')) {
        forceLogout()
        return Promise.reject(error)
      }

      const { refreshToken } = useAuthStore.getState()

      if (!refreshToken) {
        forceLogout()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // A refresh is already in flight: queue behind it rather than firing
        // a second one, then replay with whatever token it produced.
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return axiosInstance(originalRequest)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axiosInstance.post<AuthTokens>('/refresh-token', {
          refreshToken,
        })
        useAuthStore.getState().setTokens(data)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        processQueue(null, data.accessToken)
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        forceLogout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
  )
}