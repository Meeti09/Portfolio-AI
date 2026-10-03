import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/context/ToastContext'
import { TOAST_DURATION_MS } from '@/context/toast-types'
import { useToast } from '@/hooks/useToast'

function ToastTrigger() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Saved!')}>Success</button>
      <button onClick={() => toast.error('Failed!')}>Error</button>
      <button onClick={() => toast.info('Info message')}>Info</button>
    </div>
  )
}

function renderWithToast() {
  return render(
    <ToastProvider>
      <ToastTrigger />
    </ToastProvider>
  )
}

describe('Toast system', () => {
  // userEvent.setup() wires its internal state updates into React's act(),
  // which the bare userEvent.click() API does not do.
  const user = () => userEvent.setup()

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows success toast when triggered', async () => {
    renderWithToast()
    await user().click(screen.getByText('Success'))
    expect(screen.getByRole('alert')).toHaveTextContent('Saved!')
  })

  it('shows error toast when triggered', async () => {
    renderWithToast()
    await user().click(screen.getByText('Error'))
    expect(screen.getByRole('alert')).toHaveTextContent('Failed!')
  })

  it('dismisses toast when close button clicked', async () => {
    renderWithToast()
    await user().click(screen.getByText('Success'))
    const dismiss = screen.getByRole('button', { name: /dismiss/i })
    await user().click(dismiss)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Timer-dependent tests use fireEvent rather than userEvent. userEvent v14
  // detects fake timers by looking for Jest's `setTimeout._isMockFunction`
  // marker, which Vitest's sinon-based fake timers do not set, so it waits on a
  // faked setTimeout that never fires and the click deadlocks. fireEvent is
  // synchronous and already act-wrapped by React Testing Library.
  it('auto-dismisses toast once the duration elapses', () => {
    // Only setTimeout/clearTimeout are faked; faking queueMicrotask as well
    // deadlocks React 18's act().
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    renderWithToast()
    fireEvent.click(screen.getByText('Info'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Still visible just before the deadline.
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 100))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not fire a stale timer after manual dismissal', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    renderWithToast()
    fireEvent.click(screen.getByText('Info'))
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // A second toast added after the first was cleared must survive; a leaked
    // timer from the dismissed toast would wipe it early.
    fireEvent.click(screen.getByText('Success'))
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 100))
    expect(screen.getByRole('alert')).toHaveTextContent('Saved!')
  })
})