import { useMemo } from 'react'
import type { PortfolioItem } from '@/types/portfolio.types'
import { formatPercent, formatCurrency } from '@/utils/formatters'
import { Badge } from '@/components/ui/Badge'

interface Props { items: PortfolioItem[] }

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'info'

/**
 * Keyed on the asset_type values the backend actually sends (asset_master),
 * not the names this map used to list. Those keys never matched, so every badge
 * fell through to 'default'.
 */
const TYPE_COLOR_MAP: Record<string, BadgeVariant> = {
  equity:    'primary',
  debt:      'info',
  long_term: 'info',
  gold:      'warning',
  safe:      'success',
  crypto:    'danger',
}

const TYPE_LABEL: Record<string, string> = {
  equity:    'Equity',
  debt:      'Debt',
  long_term: 'Long term',
  gold:      'Gold',
  safe:      'Safe',
  crypto:    'Crypto',
}

function getBadgeVariant(type: string): BadgeVariant {
  return TYPE_COLOR_MAP[type.toLowerCase()] ?? 'default'
}

function getTypeLabel(type: string): string {
  return TYPE_LABEL[type.toLowerCase()] ?? type.replace(/_/g, ' ')
}

type RiskLevel = 'LOW' | 'MED' | 'HIGH'
function getRisk(type: string): { label: RiskLevel; color: string; dotColor: string } {
  switch (type.toLowerCase()) {
    case 'crypto':
      return { label: 'HIGH', color: 'text-danger-500',  dotColor: 'bg-danger-500' }
    case 'equity':
      return { label: 'MED',  color: 'text-gold-500',    dotColor: 'bg-gold-500' }
    case 'gold':
      return { label: 'MED',  color: 'text-gold-500',    dotColor: 'bg-gold-500' }
    case 'debt':
    case 'long_term':
    case 'safe':
      return { label: 'LOW',  color: 'text-success-500', dotColor: 'bg-success-500' }
    default:
      return { label: 'MED', color: 'text-gold-500', dotColor: 'bg-gold-500' }
  }
}

export function AllocationTable({ items }: Props) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.allocation_pct - a.allocation_pct),
    [items]
  )

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">No allocations found</p>
      </div>
    )
  }

  const maxPct = sorted[0]?.allocation_pct || 1
  const total  = sorted.reduce((s, i) => s + i.allocation_pct, 0)
  const totalAmount = sorted.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full" role="table" aria-label="Portfolio allocations">
        <thead>
          <tr className="border-b border-dark-border/80">
            <th scope="col" className="pb-3 pt-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-muted w-[34%]">Asset</th>
            <th scope="col" className="pb-3 pt-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-muted hidden sm:table-cell">Class</th>
            <th scope="col" className="pb-3 pt-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-muted hidden lg:table-cell">Risk</th>
            <th scope="col" className="pb-3 pt-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-muted hidden md:table-cell">Amount</th>
            <th scope="col" className="pb-3 pt-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-muted">Weight</th>
          </tr>
        </thead>

        <tbody>
          {sorted.map((item, idx) => {
            const barW = maxPct > 0 ? (item.allocation_pct / maxPct) * 100 : 0
            const risk = getRisk(item.asset_type)

            return (
              <tr
                key={`${item.asset_name}-${idx}`}
                className="group border-t border-dark-border/40 hover:bg-dark-hover/50 transition-colors duration-150"
              >
                {/* Asset name */}
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-dark-border w-4 text-center shrink-0">
                      {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                    </span>
                    <span className="font-semibold text-white text-sm group-hover:text-cyan-400 transition-colors duration-150 leading-tight">
                      {item.asset_name}
                    </span>
                  </div>
                </td>

                {/* Class */}
                <td className="py-3.5 pr-4 hidden sm:table-cell">
                  <Badge label={getTypeLabel(item.asset_type)} variant={getBadgeVariant(item.asset_type)} />
                </td>

                {/* Risk */}
                <td className="py-3.5 pr-4 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${risk.dotColor}`} aria-hidden="true" />
                    <span className={`font-mono text-[10px] tracking-widest font-bold ${risk.color}`}>{risk.label}</span>
                  </div>
                </td>

                {/* Amount */}
                <td className="py-3.5 pr-4 hidden md:table-cell text-right">
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {formatCurrency(item.amount)}
                  </span>
                </td>

                {/* Weight + bar */}
                <td className="py-3.5">
                  <div className="flex items-center justify-end gap-3">
                    <div className="hidden w-24 sm:block">
                      <div className="h-[3px] w-full rounded-full bg-dark-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan-500 transition-all duration-700 ease-out"
                          style={{ width: `${barW}%`, boxShadow: '0 0 6px rgba(0,212,170,0.5)' }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-white tabular-nums w-14 text-right">
                      {formatPercent(item.allocation_pct, 2)}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* Footer */}
        <tfoot>
          <tr className="border-t-2 border-dark-border">
            <td colSpan={3} className="pt-4 font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
              Portfolio Total
            </td>
            <td className="pt-4 hidden md:table-cell text-right font-mono text-xs text-muted tabular-nums">
              {formatCurrency(totalAmount)}
            </td>
            <td className="pt-4 text-right">
              <span className="font-mono text-base font-bold text-cyan-500 tabular-nums" style={{ textShadow: '0 0 12px rgba(0,212,170,0.5)' }}>
                {formatPercent(total, 2)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}