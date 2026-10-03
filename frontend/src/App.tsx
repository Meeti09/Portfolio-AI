import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

/**
 * Catches render-time errors anywhere below it and shows a recovery screen.
 *
 * Without this a single bad render leaves a blank page with no explanation and
 * no way back except a manual reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // In a real deployment this is where you would report to Sentry etc.
    console.error('[ErrorBoundary]', error, info)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-dark-bg p-6">
          <div className="card w-full max-w-md rounded-xl p-8 text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-danger-500/20 bg-danger-dim text-danger-500">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <h1 className="font-display text-lg font-bold text-white">
              Something went wrong
            </h1>
            <p className="mt-2 break-words font-mono text-xs text-muted">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.replace('/')}
              className="mt-6 w-full rounded-xl border border-cyan-500/30 bg-cyan-dim py-3 font-mono text-xs font-bold uppercase tracking-widest text-cyan-500 transition-colors hover:bg-cyan-500/20"
            >
              Return to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}