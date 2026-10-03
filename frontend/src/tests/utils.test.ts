import { describe, it, expect } from 'vitest'
import { formatPercent, formatCurrency, formatCompactINR } from '@/utils/formatters'
import { normalizeError } from '@/utils/errorHandler'

describe('formatPercent', () => {
  it('formats number to percent string with 1 decimal', () => {
    expect(formatPercent(25.5)).toBe('25.5%')
  })

  it('formats with custom decimal places', () => {
    expect(formatPercent(25.554, 2)).toBe('25.55%')
    expect(formatPercent(33.333, 2)).toBe('33.33%')
  })

  it('formats zero correctly', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('rounds down when the binary value sits just below the tie', () => {
    // 25.555 is stored as 25.55499999..., so toFixed(2) yields "25.55".
    // This is inherent to IEEE-754 doubles, not a formatting choice; the
    // assertion pins the behaviour so a future "fix" does not silently
    // introduce inconsistent rounding across the allocation table.
    expect(formatPercent(25.555, 2)).toBe('25.55%')
  })
})

describe('formatCurrency', () => {
  it('defaults to INR', () => {
    expect(formatCurrency(50000)).toBe('₹50,000')
  })

  it('uses Indian lakh/crore grouping', () => {
    expect(formatCurrency(1000000)).toBe('₹10,00,000')
    expect(formatCurrency(10000000)).toBe('₹1,00,00,000')
  })

  it('honours an explicit currency', () => {
    expect(formatCurrency(50000, 'USD')).toBe('$50,000')
  })
})

describe('formatCompactINR', () => {
  it('abbreviates thousands, lakhs and crores', () => {
    expect(formatCompactINR(500)).toBe('₹500')
    expect(formatCompactINR(5000)).toBe('₹5.0K')
    expect(formatCompactINR(250000)).toBe('₹2.50L')
    expect(formatCompactINR(12500000)).toBe('₹1.25Cr')
  })
})

describe('normalizeError', () => {
  it('returns message from axios response data', () => {
    const err = {
      response: { status: 400, data: { message: 'Bad request' } },
      request:  {},
    }
    const result = normalizeError(err)
    expect(result.message).toBe('Bad request')
    expect(result.status).toBe(400)
  })

  it('returns network error for no response', () => {
    const err = { request: {}, response: undefined }
    const result = normalizeError(err)
    expect(result.status).toBe(0)
    expect(result.message).toContain('Network error')
  })

  it('handles plain Error instances', () => {
    const result = normalizeError(new Error('Something broke'))
    expect(result.message).toBe('Something broke')
  })

  it('handles unknown errors gracefully', () => {
    const result = normalizeError('totally unknown')
    expect(result.message).toBe('An unexpected error occurred.')
  })

  it('extracts message from FastAPI validation detail arrays', () => {
    const err = {
      response: {
        status: 422,
        data: {
          detail: [
            {
              type: 'missing',
              loc: ['body', 'existing_investment'],
              msg: 'Field required',
            },
          ],
        },
      },
      request: {},
    }

    const result = normalizeError(err)
    expect(result.status).toBe(422)
    expect(result.message).toBe('Field required')
  })

  it('falls back to status message when detail is not parseable', () => {
    const err = {
      response: { status: 500, data: { detail: { nested: true } } },
      request: {},
    }

    const result = normalizeError(err)
    expect(result.message).toBe('Request failed with status 500')
  })
})