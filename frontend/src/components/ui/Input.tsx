import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label:       string
  error?:      string
  helperText?: string
  iconLeft?:   ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = '', iconLeft, ...props }, ref) => {
    const inputId  = id ?? label.toLowerCase().replace(/\s+/g, '-')
    const errorId  = `${inputId}-error`
    const helperId = `${inputId}-helper`
    const hasLabel = label.trim().length > 0

    return (
      <div className="flex flex-col gap-2">
        {hasLabel && (
          <label
            htmlFor={inputId}
            className="text-xs font-bold uppercase tracking-widest text-muted"
          >
            {label}
            {props.required && (
              <span className="ml-1 text-cyan-500" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {iconLeft && (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-muted">
              {iconLeft}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={
              [error ? errorId : null, helperText ? helperId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={!!error}
            className={`
              w-full rounded-lg border bg-dark-bg px-4 py-3 text-sm text-white font-sans
              placeholder-muted outline-none transition-all duration-200
              focus:bg-dark-card focus:border-cyan-500 focus:shadow-glow-sm
              hover:border-muted disabled:cursor-not-allowed disabled:opacity-50
              ${iconLeft ? 'pl-10' : ''}
              ${error
                ? 'border-danger-500 bg-danger-dim/30 focus:shadow-glow-danger'
                : 'border-dark-border'
              }
              ${className}
            `}
            {...props}
          />
        </div>

        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-danger-500 flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm7-3h2v4H7V5zm0 5h2v2H7v-2z" />
            </svg>
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs font-medium text-muted">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'