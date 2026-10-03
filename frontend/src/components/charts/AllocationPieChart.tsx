import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { PortfolioItem } from '@/types/portfolio.types'
import { formatPercent } from '@/utils/formatters'

interface Props { items: PortfolioItem[] }

const COLORS = ['#00d4aa', '#f0a030', '#f43f5e', '#8b5cf6', '#3b82f6', '#0ea5e9', '#10b981']

interface ChartDatum { name: string; value: number }

function aggregateByType(items: PortfolioItem[]): ChartDatum[] {
  const map = new Map<string, number>()
  items.forEach((i) => {
    map.set(i.asset_type, (map.get(i.asset_type) ?? 0) + i.allocation_pct)
  })
  return Array.from(map.entries())
    // 2dp, matching the precision the backend allocates at. Rounding to 1dp
    // here made the centre total drift (e.g. 99.9%) away from the real 100%.
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="card rounded-xl px-4 py-3 min-w-[130px] shadow-card-glow border-dark-border bg-dark-card/95 backdrop-blur-sm">
      <p className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">{String(name).replace('_', ' ')}</p>
      <p className="mt-1 font-mono text-lg font-bold text-white">{formatPercent(Number(value))}</p>
    </div>
  )
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload?.length) return null
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
      {payload.map((e) => (
        <li key={e.value} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest font-bold text-muted">
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color, boxShadow: `0 0 8px 1px ${e.color}80` }} />
          {e.value.replace('_', ' ')}
        </li>
      ))}
    </ul>
  )
}

function CenterLabel({ total }: { total: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ bottom: '50px' }}>
      <p className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted">Aggregate</p>
      <p className="font-display text-2xl font-bold text-white mt-0.5">{formatPercent(total, 2)}</p>
    </div>
  )
}

export function AllocationPieChart({ items }: Props) {
  const data = useMemo(() => aggregateByType(items), [items])
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data])
  if (!data.length) return null

  return (
    <div className="relative pt-2">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="44%"
            innerRadius={68}
            outerRadius={95}
            paddingAngle={4}
            strokeWidth={0}
            cornerRadius={4}
            isAnimationActive
            animationBegin={0}
            animationDuration={900}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell
                key={`cell-${i}`}
                fill={COLORS[i % COLORS.length]}
                style={{ filter: `drop-shadow(0 0 8px ${COLORS[i % COLORS.length]}66)` }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
      <CenterLabel total={total} />
    </div>
  )
}