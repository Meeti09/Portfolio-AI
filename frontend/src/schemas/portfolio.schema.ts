import { z } from 'zod'

export const portfolioItemSchema = z.object({
  asset_name: z.string(),
  asset_type: z.string(),
  /** Percent of the portfolio, already rounded to 2dp by the backend. */
  allocation_pct: z.number(),
  /** Capital allocated to this instrument. */
  amount: z.number(),
  expected_return_pct: z.number(),
  min_return_pct: z.number(),
  max_return_pct: z.number(),
})

export const portfolioResponseSchema = z.object({
  user_id: z.number(),
  total_investment: z.number(),
  portfolio: z.array(portfolioItemSchema),
})

export type PortfolioItem = z.infer<typeof portfolioItemSchema>
export type PortfolioResponse = z.infer<typeof portfolioResponseSchema>