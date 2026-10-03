import axios from 'axios'

/**
 * The API origin.
 *
 * Falls back to the Vite dev server's usual backend port instead of throwing at
 * import time. Throwing here took the whole app down with a blank page whenever
 * `.env` was missing, which is the state a fresh clone starts in.
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const DEV_FALLBACK = 'http://localhost:8000'

if (!import.meta.env.PROD && !BASE_URL) {
  console.warn(
    `[api] VITE_API_URL is not set. Falling back to ${DEV_FALLBACK}. ` +
      'Copy .env.example to .env to configure it.'
  )
}

export const API_BASE_URL = BASE_URL || DEV_FALLBACK

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})