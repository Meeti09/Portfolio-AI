import { z } from 'zod'
import { RiskLevel, LiquidityNeed, InvestmentType } from '@/constants/enums'

const existingInvestmentOptionSchema = z.enum(['gold', 'equity', 'debt', 'crypto', 'none'])

export const portfolioFormSchema = z.object({
  age: z
    .number({ invalid_type_error: 'Age must be a number' })
    .int('Age must be a whole number')
    .min(1, 'Age must be at least 1')
    .max(100, 'Age must be at most 100'),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0'),
  duration: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 year')
    .max(100, 'Duration must be at most 100 years'),
  risk_level: z.nativeEnum(RiskLevel, {
    errorMap: () => ({ message: 'Select a valid risk level' }),
  }),
  liquidity_need: z.nativeEnum(LiquidityNeed, {
    errorMap: () => ({ message: 'Select a valid liquidity need' }),
  }),
  investment_type: z.nativeEnum(InvestmentType, {
    errorMap: () => ({ message: 'Select a valid investment type' }),
  }),
  existing_investment: existingInvestmentOptionSchema,
})

export type PortfolioFormData = z.infer<typeof portfolioFormSchema>