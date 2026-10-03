type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'info'

interface BadgeProps {
  label:    string
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, { pill: string; dot: string }> = {
  default: { pill: 'bg-dark-border  text-gray-300  border-transparent',                         dot: 'bg-gray-400' },
  primary: { pill: 'bg-cyan-dim     text-cyan-400   border-cyan-500/20',                         dot: 'bg-cyan-500' },
  success: { pill: 'bg-success-dim  text-success-500 border-success-500/20',                     dot: 'bg-success-500' },
  warning: { pill: 'bg-gold-dim     text-gold-500    border-gold-500/20',                        dot: 'bg-gold-500' },
  danger:  { pill: 'bg-danger-dim   text-danger-500  border-danger-500/20',                      dot: 'bg-danger-500' },
  info:    { pill: 'bg-dark-border  text-blue-400    border-blue-500/20',                        dot: 'bg-blue-500' },
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { pill, dot } = variantClasses[variant]
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}