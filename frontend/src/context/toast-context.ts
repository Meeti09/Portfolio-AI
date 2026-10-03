import { createContext, useContext } from 'react'
import type { ToastContextValue } from './toast-types'

/**
 * The toast context object and its consumer hook.
 *
 * Separate from `ToastContext.tsx` so that file exports only components, which
 * React Fast Refresh requires to be able to hot-reload them.
 */
export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider')
  return ctx
}