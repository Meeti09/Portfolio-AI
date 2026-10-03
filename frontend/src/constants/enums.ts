export enum RiskLevel {
  Low      = 'low',
  Medium   = 'medium',
  High     = 'high',
}

export enum LiquidityNeed {
  Low      = 'low',
  Medium   = 'medium',
  High     = 'high',
}

export enum InvestmentType {
  MONTHLY ="monthly",
  LUMPSUM = "lumpsum"
}

export const RISK_LEVEL_OPTIONS = [
  { label: 'Low',    value: RiskLevel.Low },
  { label: 'Medium', value: RiskLevel.Medium },
  { label: 'High',   value: RiskLevel.High },
]

export const LIQUIDITY_OPTIONS = [
  { label: 'Low',    value: LiquidityNeed.Low },
  { label: 'Medium', value: LiquidityNeed.Medium },
  { label: 'High',   value: LiquidityNeed.High },
]

export const INVESTMENT_TYPE_OPTIONS = [
  { label: 'monthly',      value: InvestmentType.MONTHLY },
  { label: 'lumpsum',       value: InvestmentType.LUMPSUM },
]