import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from './App'
import { router } from './app/router'
import { ToastProvider } from './context/ToastContext'
import { setupInterceptors } from './api/interceptors'
import './index.css'

// Register Axios interceptors once at app startup — before any requests fire
setupInterceptors()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
)