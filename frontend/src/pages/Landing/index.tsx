import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'AI-Driven Allocation',
    desc: 'Portfolio.AI  analyses your risk profile and timeline to craft a uniquely personalised multi-asset portfolio.',
    accent: 'text-cyan-500',
    glow: 'shadow-[0_0_30px_2px_rgba(0,212,170,0.08)]',
    border: 'hover:border-cyan-500/20',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Risk Intelligence',
    desc: 'Set your comfort level — conservative, moderate, or aggressive — and let the AI optimise accordingly.',
    accent: 'text-gold-500',
    glow: 'shadow-[0_0_30px_2px_rgba(240,160,48,0.08)]',
    border: 'hover:border-gold-500/20',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Multi-Asset Coverage',
    desc: 'Stocks, bonds, ETFs, mutual funds, crypto and more — diversified intelligently across global asset classes.',
    accent: 'text-violet-400',
    glow: 'shadow-[0_0_30px_2px_rgba(139,92,246,0.08)]',
    border: 'hover:border-violet-500/20',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  
  const ref10s = useRef<HTMLSpanElement>(null)
  useEffect(() => { if (ref10s.current) ref10s.current.textContent = '< 10s' }, [])

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white overflow-hidden">
      {/* ── Animated background blobs ───────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[100px] animate-float" style={{ animationDuration: '12s' }} />
        <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[100px] animate-float" style={{ animationDuration: '15s', animationDelay: '-5s' }} />
        <div className="absolute -bottom-20 left-1/3 h-[400px] w-[400px] rounded-full bg-gold-500/4 blur-[80px] animate-float" style={{ animationDuration: '10s', animationDelay: '-8s' }} />
      </div>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between mx-auto w-full max-w-6xl px-6 py-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-dim border border-cyan-500/25 shadow-glow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-cyan-500" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <path d="M4 16l6-6 4 4 6-8" />
            </svg>
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white">
            Portfolio<span className="text-cyan-500">.</span>AI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
          <Button size="sm" onClick={() => navigate('/signup')}>Open Account</Button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center text-center px-6">
        <div className="animate-slide-up mt-16 max-w-4xl">
          {/* Live badge */}
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-dark-border bg-dark-card/80 px-5 py-2 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <span className="font-mono text-xs font-bold text-cyan-500  tracking-widest">Portfolio.AI  </span>
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.1] text-white sm:text-7xl tracking-tight">
            Smarter Investment Decisions<br />
            
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base font-medium text-muted sm:text-lg leading-relaxed">
            Automated portfolio allocation based on  risk, duration, investment type , existing investments and market logic.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/signup')}>Generate Portfolio</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/login')} className="text-muted hover:text-white">
              Sign in →
            </Button>
          </div>
        </div>

        

        {/* ── Feature cards ──────────────────────────────────────────────── */}
        <div className="relative z-10 mt-20 mb-24 w-full max-w-5xl">
          <p className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted mb-2">Platform Capabilities</p>
          <h2 className="font-display text-2xl font-bold text-white mb-10">
            Everything you need to invest smarter<span className="text-cyan-500">.</span>
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`card rounded-xl p-6 text-left border border-dark-border transition-all duration-300 ${f.glow} ${f.border} animate-slide-up`}
                style={{ animationDelay: `${150 + i * 80}ms` }}
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-dark-border ${f.accent}`}>
                  {f.icon}
                </div>
                <h3 className="font-display text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}