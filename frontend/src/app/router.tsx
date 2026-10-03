import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PageFallback, PrivateRoute, PublicOnlyRoute } from './guards'

// Lazy-loaded pages
const Landing   = lazy(() => import('@/pages/Landing'))
const Login     = lazy(() => import('@/pages/Auth/Login'))
const SignUp    = lazy(() => import('@/pages/Auth/SignUp'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Portfolio = lazy(() => import('@/pages/Portfolio'))

// ── Router definition ─────────────────────────────────────────────────────
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<PageFallback />}>
        <Landing />
      </Suspense>
    ),
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login',  element: <Login /> },
      { path: '/signup', element: <SignUp /> },
    ],
  },
  {
    element: <PrivateRoute />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/portfolio', element: <Portfolio /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])