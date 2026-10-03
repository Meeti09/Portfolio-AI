import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   Variant
  size?:      Size
  loading?:   boolean
  children:   ReactNode
  iconLeft?:  ReactNode
  iconRight?: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-cyan-500 text-dark-bg font-bold hover:bg-cyan-400 hover:shadow-glow-sm shadow-glow active:bg-cyan-600 disabled:bg-dark-border disabled:text-muted disabled:shadow-none',
  secondary:
    'bg-dark-card border border-dark-border text-white hover:border-cyan-500/50 hover:bg-dark-hover active:scale-[0.98]',
  ghost:
    'text-muted hover:text-white hover:bg-dark-hover active:scale-[0.98]',
  danger:
    'bg-danger-dim text-danger-500 border border-danger-500 hover:bg-danger-500 hover:text-white active:scale-[0.98]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-lg',
  lg: 'px-8 py-3 text-sm rounded-lg',
}

export function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled,
  children,
  className = '',
  iconLeft,
  iconRight,
  ...props
}: ButtonProps) {
  const isDisabled = disabled ?? loading

  return (
    <button
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center gap-2.5 font-semibold tracking-wide
        transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg
        active:scale-[0.98] select-none disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0110 10h-3a7 7 0 00-7-7V2z" />
        </svg>
      ) : iconLeft ? (
        <span className="shrink-0 flex items-center">{iconLeft}</span>
      ) : null}

      <span>{children}</span>

      {!loading && iconRight && (
        <span className="shrink-0 flex items-center">{iconRight}</span>
      )}
    </button>
  )
}