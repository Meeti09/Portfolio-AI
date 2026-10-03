/**
 * Toast internals: types, reducer and context.
 *
 * Deliberately separate from `ToastContext.tsx` so that file only exports
 * components (React Fast Refresh bails out when a module mixes component and
 * non-component exports).
 */

export type ToastVariant = 'success' | 'error' | 'info'

/** How long a toast stays on screen. Imported by the provider and the tests. */
export const TOAST_DURATION_MS = 4000

export interface Toast {
  id:      string
  message: string
  variant: ToastVariant
}

export interface ToastContextValue {
  toasts:      Toast[]
  addToast:    (message: string, variant?: ToastVariant) => void
  removeToast: (id: string) => void
}

export type ToastAction =
  | { type: 'ADD';    toast: Toast }
  | { type: 'REMOVE'; id: string }

export function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  if (action.type === 'ADD')    return [...state, action.toast]
  if (action.type === 'REMOVE') return state.filter((t) => t.id !== action.id)
  return state
}

/** Random id, falling back where crypto.randomUUID is unavailable. */
export function createToastId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}