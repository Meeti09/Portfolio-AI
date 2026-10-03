import { describe, it, expect } from 'vitest'
import { loginSchema, signUpSchema } from '@/schemas/auth.schema'
import { portfolioFormSchema } from '@/schemas/dashboard.schema'
import { portfolioResponseSchema } from '@/schemas/portfolio.schema'
import { RiskLevel, LiquidityNeed, InvestmentType } from '@/constants/enums'

// ── Auth schemas ──────────────────────────────────────────────────────────
describe('loginSchema', () => {
  it('passes with valid credentials', () => {
    const result = loginSchema.safeParse({
      email:    'user@example.com',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('fails with invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(result.success).toBe(false)
  })

  it('fails with empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('signUpSchema', () => {
  const valid = {
    name:            'Jane Doe',
    email:           'jane@example.com',
    password:        'Strong@123',
    confirmPassword: 'Strong@123',
    age:             25,
  }

  it('passes with valid data', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true)
  })

  it('fails when passwords do not match', () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: 'Different@1' })
    expect(result.success).toBe(false)
    const errors = result.error?.flatten().fieldErrors
    expect(errors?.confirmPassword).toBeDefined()
  })

  it('fails when age is under 18', () => {
    const result = signUpSchema.safeParse({ ...valid, age: 16 })
    expect(result.success).toBe(false)
  })

  it('fails with weak password (no special char)', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'Weakpass1', confirmPassword: 'Weakpass1' })
    expect(result.success).toBe(false)
  })

  it('fails with weak password (no uppercase)', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'weakpass@1', confirmPassword: 'weakpass@1' })
    expect(result.success).toBe(false)
  })
})

// ── Dashboard schema ──────────────────────────────────────────────────────
describe('portfolioFormSchema', () => {
  const valid = {
    age:             25,
    amount:          10000,
    duration:        5,
    risk_level:      RiskLevel.Medium,
    liquidity_need:  LiquidityNeed.Low,
    investment_type: InvestmentType.LUMPSUM,
    existing_investment: 'gold',
  }

  it('passes with valid form data', () => {
    expect(portfolioFormSchema.safeParse(valid).success).toBe(true)
  })

  it('fails when amount is zero', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, amount: 0 })
    expect(result.success).toBe(false)
  })

  it('fails when amount is negative', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, amount: -500 })
    expect(result.success).toBe(false)
  })

  it('fails when duration is zero', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, duration: 0 })
    expect(result.success).toBe(false)
  })

  it('fails when duration is too high', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, duration: 101 })
    expect(result.success).toBe(false)
  })

  it('fails with invalid risk_level enum', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, risk_level: 'extreme' })
    expect(result.success).toBe(false)
  })

  it('fails when age is below 1', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, age: 0 })
    expect(result.success).toBe(false)
  })

  it('fails when existing_investment is empty', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, existing_investment: '' })
    expect(result.success).toBe(false)
  })

  it('fails when existing_investment has invalid option', () => {
    const result = portfolioFormSchema.safeParse({ ...valid, existing_investment: 'real-estate' })
    expect(result.success).toBe(false)
  })
})

// ── Portfolio response schema ─────────────────────────────────────────────
describe('portfolioResponseSchema', () => {
  const validItem = {
    asset_name: 'Nifty 50 Index Fund',
    asset_type: 'equity',
    allocation_pct: 60.0,
    amount: 600000,
    expected_return_pct: 13.5,
    min_return_pct: 9.0,
    max_return_pct: 18.0,
  }

  const validResponse = {
    user_id: 1,
    total_investment: 1000000,
    portfolio: [
      validItem,
      {
        asset_name: 'Government Bond',
        asset_type: 'debt',
        allocation_pct: 40.0,
        amount: 400000,
        expected_return_pct: 7.1,
        min_return_pct: 5.5,
        max_return_pct: 8.8,
      },
    ],
  }

  it('passes with valid response', () => {
    expect(portfolioResponseSchema.safeParse(validResponse).success).toBe(true)
  })

  it('accepts an empty portfolio', () => {
    const result = portfolioResponseSchema.safeParse({
      user_id: 1,
      total_investment: 50000,
      portfolio: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a null allocation_pct', () => {
    // The backend always emits a number; a null here means the payload shape
    // changed and the UI would render "—" instead of a real weight.
    const result = portfolioResponseSchema.safeParse({
      ...validResponse,
      portfolio: [{ ...validItem, allocation_pct: null }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an item missing the amount field', () => {
    const { amount: _amount, ...withoutAmount } = validItem
    const result = portfolioResponseSchema.safeParse({
      ...validResponse,
      portfolio: [withoutAmount],
    })
    expect(result.success).toBe(false)
  })

  it('fails when portfolio is missing', () => {
    const result = portfolioResponseSchema.safeParse({ user_id: 1, total_investment: 1000 })
    expect(result.success).toBe(false)
  })

  it('fails when total_investment is missing', () => {
    const result = portfolioResponseSchema.safeParse({ user_id: 1, portfolio: [] })
    expect(result.success).toBe(false)
  })

  it('fails when user_id is not a number', () => {
    const result = portfolioResponseSchema.safeParse({
      ...validResponse,
      user_id: 'abc',
    })
    expect(result.success).toBe(false)
  })
})