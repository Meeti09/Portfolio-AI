import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '@/app/portfolioStore'
import { portfolioResponseSchema } from '@/schemas/portfolio.schema'
import type { PortfolioResponse } from '@/schemas/portfolio.schema'
import { AppShell } from '@/components/layout/AppShell'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { AllocationPieChart } from '@/components/charts/AllocationPieChart'
import { AllocationTable } from './AllocationTable'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatters'

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent, iconPath,
}: {
  label: string
  value: string
  sub?: string
  accent: 'cyan' | 'gold' | 'default'
  iconPath: string
}) {
  const colorMap = {
    cyan:    { val: 'text-cyan-500',  glow: '0 0 20px rgba(0,212,170,0.3)',  iconBg: 'bg-cyan-dim  border-cyan-500/15  text-cyan-500'  },
    gold:    { val: 'text-gold-500',  glow: '0 0 20px rgba(240,160,48,0.3)', iconBg: 'bg-gold-dim  border-gold-500/15  text-gold-500'  },
    default: { val: 'text-white',     glow: 'none',                          iconBg: 'bg-dark-border border-dark-border text-muted'    },
  }
  const c = colorMap[accent]

  return (
    <div className="card rounded-xl p-5 flex items-center gap-4 hover:shadow-card-glow transition-all duration-300 group">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${c.iconBg} transition-all duration-300 group-hover:scale-110`}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest truncate">{label}</p>
        <p
          className={`font-mono text-2xl font-bold mt-0.5 leading-none ${c.val}`}
          style={{ textShadow: c.glow }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted mt-0.5 truncate max-w-[150px]">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Portfolio page ─────────────────────────────────────────────────────────────
export default function Portfolio() {
  const navigate = useNavigate()
  const stored = usePortfolioStore((s) => s.portfolio)

  // Re-validate on read: this came out of sessionStorage, which is user
  // writable, so it gets the same scrutiny as a live API response.
  const portfolio = useMemo<PortfolioResponse | null>(() => {
    const parsed = portfolioResponseSchema.safeParse(stored)
    return parsed.success ? parsed.data : null
  }, [stored])

  const items = useMemo(() => portfolio?.portfolio ?? [], [portfolio])
  const topAsset = useMemo(
    () => [...items].sort((a, b) => b.allocation_pct - a.allocation_pct)[0],
    [items]
  )
  const totalPct = useMemo(
    () => Math.round(items.reduce((sum, i) => sum + i.allocation_pct, 0) * 100) / 100,
    [items]
  )
  const totalAmount = useMemo(
    () => items.reduce((sum, i) => sum + i.amount, 0),
    [items]
  )

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!portfolio) {
    return (
      <AppShell>
        <PageWrapper>
          <div className="card rounded-xl flex flex-col items-center justify-center py-32 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-card border border-dark-border text-muted">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-mono text-lg uppercase tracking-widest font-bold text-white">Data Not Available</h2>
            <p className="mt-2 text-sm text-muted">Please initialise a portfolio configuration first.</p>
            <Button className="mt-8 font-mono text-xs uppercase tracking-widest w-48" onClick={() => navigate('/dashboard')}>
              Start Diagnostic
            </Button>
          </div>
        </PageWrapper>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageWrapper
        title="Portfolio Analysis"
        subtitle={`Portfolio.AI processed ${items.length} instruments for your allocation.`}
        action={
          <Button
            variant="secondary"
            size="sm"
            className="font-mono text-[10px] uppercase tracking-widest"
            onClick={() => navigate('/dashboard')}
            iconLeft={
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            Reconfigure
          </Button>
        }
      >
        <div className="flex flex-col gap-6">

          {/* ── KPI Strip ──────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Active Instruments"
              value={String(items.length)}
              sub="Allocated positions"
              accent="default"
              iconPath="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
            />
            <KpiCard
              label="Primary Position"
              value={topAsset ? `${topAsset.allocation_pct}%` : '—'}
              sub={topAsset ? `${topAsset.asset_name} · ${formatCurrency(topAsset.amount)}` : undefined}
              accent="cyan"
              iconPath="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
            />
            <KpiCard
              label="Capital Deployed"
              value={formatCurrency(totalAmount)}
              sub={`${totalPct.toFixed(2)}% allocated across ${items.length} instruments`}
              accent="gold"
              iconPath="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33"
            />
          </div>

          {/* ── Chart + Table ───────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-5">

            {/* Pie Chart */}
            <section className="card rounded-xl lg:col-span-2 overflow-hidden" aria-label="Allocation chart">
              {/* Section header */}
              <div className="flex items-center justify-between border-b border-dark-border px-6 pt-5 pb-4 bg-dark-card/50">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Distribution</p>
                  <h2 className="font-display text-sm font-bold text-white mt-0.5">Sector Breakdown</h2>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-dim border border-cyan-500/15 text-cyan-500">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="p-4">
                {items.length > 0 ? (
                  <AllocationPieChart items={items} />
                ) : (
                  <div className="flex h-64 items-center justify-center font-mono text-xs text-muted uppercase border border-dark-border border-dashed rounded-lg">
                    No data
                  </div>
                )}
              </div>
            </section>

            {/* Table */}
            <section className="card rounded-xl lg:col-span-3 overflow-hidden" aria-label="Allocation details">
              <div className="flex items-center justify-between border-b border-dark-border px-6 pt-5 pb-4 bg-dark-card/50">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Ledger</p>
                  <h2 className="font-display text-sm font-bold text-white mt-0.5">Instrument Breakdown</h2>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dark-border border border-dark-border text-muted">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                    <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="px-6 pb-6 pt-2">
                <AllocationTable items={items} />
              </div>
            </section>
          </div>

          {/* ── Disclaimer ─────────────────────────────────────────────── */}
          <div className="flex items-start gap-3 rounded-xl border border-dark-border bg-dark-card/60 px-5 py-4">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-muted mt-0.5" stroke="currentColor" strokeWidth="2">
              <path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-xs text-muted leading-relaxed font-mono">
              <strong className="text-gray-400">DISCLAIMER</strong> — Algorithmic output. Not financial advice. Consult a licensed advisor before executing any investment.
            </p>
          </div>

        </div>
      </PageWrapper>
    </AppShell>
  )
}