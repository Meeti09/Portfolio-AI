import type { AxiosError } from 'axios'
import type { ApiError } from '@/types/api.types'

interface ErrorResponseData {
  message?: string
  detail?:  unknown
}

function toMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as { msg?: unknown }
    if (first && typeof first === 'object' && typeof first.msg === 'string') {
      return first.msg
    }

    return toMessage(value[0])
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.msg === 'string' && record.msg.trim()) {
      return record.msg
    }
  }

  return null
}

export function normalizeError(error: unknown): ApiError {
  const axiosErr = error as AxiosError<ErrorResponseData>

  if (axiosErr.response) {
    const data = axiosErr.response.data
    const parsedMessage = toMessage(data?.message) ?? toMessage(data?.detail)

    return {
      message: parsedMessage ?? `Request failed with status ${axiosErr.response.status}`,
      status: axiosErr.response.status,
    }
  }

  if (axiosErr.request) {
    return { message: 'Network error — please check your connection.', status: 0 }
  }

  if (error instanceof Error) {
    return { message: error.message, status: 0 }
  }

  return { message: 'An unexpected error occurred.', status: 0 }
}