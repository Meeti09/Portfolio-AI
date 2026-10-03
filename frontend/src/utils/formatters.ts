export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format an amount as Indian rupees.
 *
 * The whole product quotes INR and the dashboard labels the amount field with a
 * ₹ sign, but this defaulted to USD, so every figure on screen was mislabelled.
 * en-IN also applies the lakh/crore grouping (1,00,000 rather than 100,000).
 */
export function formatCurrency(value: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Compact form for tight spaces: ₹1.2L, ₹3.4Cr. */
export function formatCompactINR(value: number): string {
  if (Math.abs(value) >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(2)}Cr`
  }
  if (Math.abs(value) >= 100_000) {
    return `₹${(value / 100_000).toFixed(2)}L`
  }
  if (Math.abs(value) >= 1_000) {
    return `₹${(value / 1_000).toFixed(1)}K`
  }
  return `₹${value.toFixed(0)}`
}