import { useToastContext } from '@/context/toast-context'

export function useToast() {
  const { addToast } = useToastContext()
  return {
    success: (msg: string) => addToast(msg, 'success'),
    error:   (msg: string) => addToast(msg, 'error'),
    info:    (msg: string) => addToast(msg, 'info'),
  }
}