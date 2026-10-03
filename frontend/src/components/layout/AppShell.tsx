import type { ReactNode } from 'react'
import { Navbar } from './Navbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 flex flex-col">
      {/* Mesh background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-mesh" aria-hidden="true" />

      <div className="relative z-10">
        <Navbar />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10 animate-fade-in">
        {children}
      </main>
    </div>
  )
}