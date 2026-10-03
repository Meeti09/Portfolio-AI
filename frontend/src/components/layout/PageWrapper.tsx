import type { ReactNode } from 'react'

interface PageWrapperProps {
  title?:    string
  subtitle?: string
  children:  ReactNode
  action?:   ReactNode
}

export function PageWrapper({ title, subtitle, children, action }: PageWrapperProps) {
  return (
    <div className="animate-slide-up flex flex-col gap-8">
      {(title ?? subtitle) && (
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-dark-border pb-6">
          <div className="space-y-1">
            {title && (
              <h1 className="font-display text-2xl font-bold text-white tracking-tight sm:text-3xl">
                {title}
                <span className="text-cyan-500">.</span>
              </h1>
            )}
            {subtitle && (
              <p className="max-w-xl text-sm font-medium text-muted">
                {subtitle}
              </p>
            )}
          </div>
          {action && (
            <div className="flex-shrink-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
              {action}
            </div>
          )}
        </header>
      )}
      <div className="animate-fade-in" style={{ animationDelay: '80ms' }}>
        {children}
      </div>
    </div>
  )
}