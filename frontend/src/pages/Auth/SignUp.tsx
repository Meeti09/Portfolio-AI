import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { signUpSchema, type SignUpFormData } from '@/schemas/auth.schema'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { normalizeError } from '@/utils/errorHandler'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'

export default function SignUp() {
  const { signUp }            = useAuth()
  const toast                 = useToast()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true)
    try {
      await signUp(data)
    } catch (err) {
      toast.error(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-6 relative overflow-hidden">
      {/* Background Mesh */}
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" aria-hidden="true" />

      <div className="w-full max-w-[440px] animate-slide-up relative z-10 my-10">
        {/* Brand logo */}
        <div className="mb-10 text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-dim border border-cyan-500/20 text-cyan-500 shadow-glow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                <path d="M4 16l6-6 4 4 6-8" />
              </svg>
            </div>
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-2">System Initialisation</h1>
          <p className="text-sm font-medium text-muted tracking-wide">Register new operator credentials.</p>
        </div>

        <div className="card rounded-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            <Input
              label="Full Name"
              id="name"
              autoComplete="name"
              required
              placeholder="Your Name"
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Email Address"
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Age"
              id="age"
              type="number"
              required
              placeholder="25"
              error={errors.age?.message}
              {...register('age', { valueAsNumber: true })}
            />

            <Input
              label="Password"
              id="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="••••••••"
              helperText="8+ chars, uppercase, lowercase, number, special character"
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Confirm Password"
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              loading={loading}
              className="mt-4 w-full font-bold uppercase tracking-widest text-xs h-12"
              iconRight={
                !loading ? (
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                ) : undefined
              }
            >
              Create Account
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs font-semibold uppercase tracking-widest text-muted">
          Already active?{' '}
          <Link to="/login" className="text-cyan-500 hover:text-cyan-400 transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}