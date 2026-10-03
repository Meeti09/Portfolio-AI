import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { axiosInstance } from '@/api/axios'
import { useAuthStore } from '@/app/store'
import { usePortfolioStore } from '@/app/portfolioStore'
import { portfolioResponseSchema } from '@/schemas/portfolio.schema'
import { normalizeError } from '@/utils/errorHandler'
import { useToast } from './useToast'
import type { PortfolioFormData } from '@/schemas/dashboard.schema'
import type { PortfolioResponse } from '@/schemas/portfolio.schema'

const MAX_RETRIES = 2

export function usePortfolio() {
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const setStoredPortfolio = usePortfolioStore((s) => s.setPortfolio)

  const generate = useCallback(
    async (payload: PortfolioFormData) => {
      setLoading(true)
      setError(null)

      // One account, one age. The dashboard age must match the signup age
      // stored on the account; otherwise stop before calling the API.
      const accountAge = useAuthStore.getState().user?.age
      if (accountAge === undefined || accountAge === null) {
        const message = 'Could not load your account profile yet. Please wait a moment and try again.'
        setError(message)
        toast.error(message)
        setLoading(false)
        return
      }
      if (Number(payload.age) !== accountAge) {
        const message = `Age mismatch: this form says ${payload.age}, but your account says ${accountAge}. One account cannot have two ages.`
        setError(message)
        toast.error(message)
        setLoading(false)
        return
      }

      let attempt = 0

      while (attempt <= MAX_RETRIES) {
        try {
          const { data: raw } = await axiosInstance.post('/generate-portfolio', {
            age: Number(payload.age),
            risk_level: payload.risk_level,
            investment_amount: Number(payload.amount),
            investment_type: payload.investment_type,
            duration_years: Number(payload.duration),
            liquidity_need: payload.liquidity_need,
            // Sent verbatim. This used to be rewritten to 'None', a capital N
            // that matches no row in existing_investment_rules, so the rule for
            // users with no holdings silently never applied.
            existing_investment: payload.existing_investment,
          })

          // Validate the API response with Zod before trusting it.
          const parsed = portfolioResponseSchema.safeParse(raw)
          if (!parsed.success) {
            throw new Error('Invalid response from server. Please try again.')
          }

          setData(parsed.data)
          setStoredPortfolio(parsed.data)
          navigate('/portfolio')
          return
        } catch (err) {
          const normalized = normalizeError(err)

          // Only retry on network-level failures (status 0).
          if (normalized.status !== 0 || attempt === MAX_RETRIES) {
            setError(normalized.message)
            toast.error(normalized.message)
            setLoading(false)
            return
          }

          attempt++
          toast.info(`Connection issue, retrying… (${attempt}/${MAX_RETRIES})`)
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }

      setLoading(false)
    },
    [navigate, toast, setStoredPortfolio]
  )

  return { generate, data, loading, error }
}