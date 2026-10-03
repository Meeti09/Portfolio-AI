import { useAuthStore } from '@/app/store'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export function Navbar() {
  const { logout }          = useAuth()
  const { isAuthenticated } = useAuthStore()
  const { user }            = useCurrentUser()
  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U'

  return (
    <header className="sticky top-0 z-50 glass-nav">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-dim border border-cyan-500/20 text-cyan-500 shadow-glow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <path d="M4 16l6-6 4 4 6-8" />
            </svg>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white flex items-center">
            Portfolio<span className="text-cyan-500">.</span>AI
          </span>
        </div>

        {/* Right actions */}
        {isAuthenticated && (
          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              className="group flex items-center gap-2 text-sm font-medium text-muted hover:text-white transition-colors duration-200"
            >
              Sign Out
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" stroke="currentColor" strokeWidth="2">
                <path d="M13 7l3 3m0 0l-3 3m3-3H8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div
              className="h-8 w-8 rounded-full bg-dark-border flex items-center justify-center border border-dark-border"
              title={user ? `${user.name} (${user.email})` : 'Account'}
            >
              <span className="text-xs font-bold text-gray-300">{initial}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}