import { useEffect, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { portfolioFormSchema, type PortfolioFormData } from '@/schemas/dashboard.schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePortfolio } from '@/hooks/usePortfolio'
import { AppShell } from '@/components/layout/AppShell'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  RISK_LEVEL_OPTIONS,
  LIQUIDITY_OPTIONS,
  INVESTMENT_TYPE_OPTIONS,
} from '@/constants/enums'

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card rounded-xl p-6 lg:col-span-1 space-y-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="card rounded-xl p-6 lg:col-span-2 space-y-5">
        <Skeleton className="h-5 w-1/4" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-12" /><Skeleton className="h-12" />
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-10 w-48 ml-auto" />
      </div>
    </div>
  )
}

// ── Icon definitions (corrected: LOW=shield, MED=flat, HIGH=spike-up) ────────
const RISK_ICON: Record<string, JSX.Element> = {
  low: (
    // Shield — safe / conservative
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L3 4.5v4c0 2.5 2.2 4.5 5 5 2.8-.5 5-2.5 5-5v-4L8 2z" />
    </svg>
  ),
  medium: (
    // Horizontal line — balanced
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 8h10" />
    </svg>
  ),
  high: (
    // Upward spike — aggressive / volatile
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13l3.5-4 2.5 2 4-7" />
    </svg>
  ),
}

// Active colour per risk level
const RISK_ACTIVE: Record<string, string> = {
  low:    'border-success-500 bg-success-dim text-success-500 shadow-glow-sm scale-[1.03] -translate-y-0.5',
  medium: 'border-gold-500   bg-gold-dim   text-gold-500 shadow-glow-sm scale-[1.03] -translate-y-0.5',
  high:   'border-danger-500 bg-danger-dim  text-danger-500 shadow-glow-sm scale-[1.03] -translate-y-0.5',
}

const LIQUIDITY_ACTIVE =
  'border-cyan-500 bg-cyan-dim text-cyan-500 shadow-glow-sm scale-[1.03] -translate-y-0.5'

const PILL_SELECTED =
  'ring-2 ring-cyan-400/70 ring-offset-1 ring-offset-dark-card text-white bg-cyan-500/10 shadow-glow-sm scale-[1.03] -translate-y-0.5'

const PILL_BASE = [
  'flex cursor-pointer items-center gap-2 rounded-xl border border-dark-border transform-gpu',
  'bg-dark-bg px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted',
  'transition-all duration-300 ease-out hover:border-muted hover:text-white select-none active:scale-[0.98]',
].join(' ')

const EXISTING_INVESTMENT_OPTIONS = [
  { label: 'Gold', value: 'gold' },
  { label: 'Equity', value: 'equity' },
  { label: 'Debt', value: 'debt' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'None', value: 'none' },
]

export default function Dashboard() {
  const { generate, loading } = usePortfolio()
  const { user: accountUser } = useCurrentUser()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioFormSchema),
  })

  // Start from the signup age. The user can still edit it, but generate()
  // rejects anything that does not match the account.
  const agePrefilledFor = useRef<number | null>(null)
  useEffect(() => {
    if (accountUser && agePrefilledFor.current !== accountUser.user_id) {
      agePrefilledFor.current = accountUser.user_id
      setValue('age', accountUser.age, { shouldValidate: true })
    }
  }, [accountUser, setValue])

  const selectedRisk      = useWatch({ control, name: 'risk_level' })
  const selectedLiquidity = useWatch({ control, name: 'liquidity_need' })

  const onSubmit = async (data: PortfolioFormData) => {
    await generate(data)
  }

  if (loading) {
    return (
      <AppShell>
        <PageWrapper title="Analysis In Progress" subtitle="Running proprietary models...">
          <DashboardSkeleton />
        </PageWrapper>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageWrapper
        title="Asset Configuration"
        subtitle="Define risk tolerance, liquidity parameters, and principal capital."
      >
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="card rounded-xl p-6 h-fit">
            <h2 className="mb-5 font-mono text-xs font-bold text-cyan-500 uppercase tracking-widest border-b border-dark-border pb-3">
              Operator Profile
            </h2>
            <div className="flex flex-col gap-5">
              <Input
                label="Age"
                id="ui-age"
                type="number"
                required
                placeholder=""
                error={errors.age?.message}
                {...register('age', { valueAsNumber: true })}
              />
              <p className="font-mono text-[11px] text-muted">
                Must match your account age
                {accountUser ? `: ${accountUser.age}` : ' (loading profile…)'}.
              </p>

              <div className="flex flex-col gap-2">
                <label htmlFor="ui-investments" className="text-xs font-bold uppercase tracking-widest text-muted">
                  Existing Holdings <span className="text-cyan-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="ui-investments"
                    required
                    aria-invalid={!!errors.existing_investment}
                    className={`input-fintech appearance-none pr-10 font-bold uppercase tracking-wide text-xs ${errors.existing_investment ? 'border-danger-500 text-danger-500' : ''}`}
                    {...register('existing_investment')}
                  >
                    <option value="" className="bg-dark-card text-muted normal-case font-normal tracking-normal">Select holding</option>
                    {EXISTING_INVESTMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-dark-card text-white normal-case font-normal tracking-normal">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-cyan-500">
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                {errors.existing_investment && (
                  <p role="alert" className="text-xs font-semibold text-danger-500">
                    {errors.existing_investment.message}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-dim p-4">
                <p className="font-mono text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-1.5">
                  SYS_NOTE
                </p>
                <p className="font-mono text-[11px] text-cyan-400/80 leading-relaxed">
                  Declaring existing holdings mitigates compounding asset concentration risk.
                </p>
              </div>
            </div>
          </aside>

          {/* ── Main form ───────────────────────────────────────────────── */}
          <section className="card rounded-xl p-6 lg:col-span-2">
            <h2 className="mb-5 font-mono text-xs font-bold text-cyan-500 uppercase tracking-widest border-b border-dark-border pb-3">
              Capital Directives
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-7">

              {/* Amount + Duration */}
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Capital (INR)"
                  type="number"
                  required
                  placeholder=""
                  error={errors.amount?.message}
                  iconLeft={<span className="font-mono text-xs font-bold text-muted">₹</span>}
                  {...register('amount', { valueAsNumber: true })}
                />
                <Input
                  label="Duration (Years)"
                  type="number"
                  required
                  placeholder=""
                  error={errors.duration?.message}
                  {...register('duration', { valueAsNumber: true })}
                />
              </div>

              {/* ── Risk Vector (Controller — guarantees registration + watch) */}
              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
                  Risk Vector <span className="text-cyan-500">*</span>
                </legend>
                <Controller
                  name="risk_level"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Risk level">
                      {RISK_LEVEL_OPTIONS.map((opt) => {
                        const isActive = field.value === opt.value
                        const riskKey = String(opt.value).toLowerCase()
                        const riskActiveClass = RISK_ACTIVE[riskKey] ?? ''
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => field.onChange(opt.value)}
                            className={`${PILL_BASE} ${isActive ? `${PILL_SELECTED} ${riskActiveClass}` : ''}`}
                          >
                            {RISK_ICON[riskKey]}
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                />
                {errors.risk_level && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-danger-500">
                    {errors.risk_level.message}
                  </p>
                )}
              </fieldset>

              {/* ── Liquidity Need (Controller — same pattern) */}
              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
                  Liquidity Need <span className="text-cyan-500">*</span>
                </legend>
                <Controller
                  name="liquidity_need"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Liquidity need">
                      {LIQUIDITY_OPTIONS.map((opt) => {
                        const isActive = field.value === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => field.onChange(opt.value)}
                            className={`${PILL_BASE} ${isActive ? `${PILL_SELECTED} ${LIQUIDITY_ACTIVE}` : ''}`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                />
                {errors.liquidity_need && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-danger-500">
                    {errors.liquidity_need.message}
                  </p>
                )}
              </fieldset>

              {/* Execution Strategy */}
              <div className="flex flex-col gap-2">
                <label htmlFor="investment_type" className="text-xs font-bold uppercase tracking-widest text-muted">
                  Execution Strategy <span className="text-cyan-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="investment_type"
                    aria-invalid={!!errors.investment_type}
                    className={`input-fintech appearance-none pr-10 font-bold uppercase tracking-wide text-xs
                                ${errors.investment_type ? 'border-danger-500 text-danger-500' : ''}`}
                    {...register('investment_type')}
                  >
                    <option value="" className="bg-dark-card text-muted normal-case font-normal tracking-normal">Select strategy</option>
                    {INVESTMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-dark-card text-white normal-case font-normal tracking-normal">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-cyan-500">
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                {errors.investment_type && (
                  <p role="alert" className="text-xs font-semibold text-danger-500">{errors.investment_type.message}</p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-5 border-t border-dark-border flex items-center justify-between gap-4">
                {/* Live summary of selections */}
                <div className="hidden sm:flex items-center gap-3 flex-wrap">
                  {selectedRisk && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border
                      ${RISK_ACTIVE[selectedRisk]} border-opacity-50`}>
                      {RISK_ICON[selectedRisk]}
                      {selectedRisk}
                    </span>
                  )}
                  {selectedLiquidity && (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border border-cyan-500/40 bg-cyan-dim text-cyan-500">
                      Liquidity: {selectedLiquidity}
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  size="lg"
                  className="ml-auto font-mono uppercase tracking-widest text-xs h-12 min-w-[180px]"
                  iconRight={
                    !loading ? (
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    ) : undefined
                  }
                >
                  Execute Allocation
                </Button>
              </div>
            </form>
          </section>

        </div>
      </PageWrapper>
    </AppShell>
  )
}