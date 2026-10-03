import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PortfolioResponse } from '@/schemas/portfolio.schema'

interface PortfolioState {
  portfolio: PortfolioResponse | null
  setPortfolio: (portfolio: PortfolioResponse) => void
  clearPortfolio: () => void
}

/**
 * The most recently generated allocation.
 *
 * This used to travel through `navigate('/portfolio', { state: … })`, which
 * meant a refresh on the Portfolio page landed on the "Data Not Available"
 * screen. Persisting it means a reload keeps showing the real results.
 */
export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      portfolio: null,
      setPortfolio: (portfolio) => set({ portfolio }),
      clearPortfolio: () => set({ portfolio: null }),
    }),
    {
      name: 'investment-engine-portfolio',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)