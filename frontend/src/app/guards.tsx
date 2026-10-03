import { Suspense } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Route guards.
 *
 * Kept out of `router.tsx` so that file only exports the router object; mixing
 * component declarations with a non-component export disables React Fast
 * Refresh for the whole module.
 */

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-dark-bg">
    <Skeleton className="h-64 w-full max-w-lg rounded-xl" />
  </div>
)

export function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  ) : (
    <Navigate to="/login" replace />
  )
}

export function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return !isAuthenticated ? (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  ) : (
    <Navigate to="/dashboard" replace />
  )
}

export { PageFallback }