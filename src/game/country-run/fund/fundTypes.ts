/**
 * M6.5 §33-46: FONDS SOUVERAIN FRANCE — optional, player-created sovereign
 * wealth fund. `SovereignFundState` is fully serializable, `exists: false`
 * being the default/no-op state before creation (§33: "NOT automatically
 * created").
 */
export type SovereignFundStrategy = 'PRUDENT' | 'INDUSTRIAL' | 'INNOVATION' | 'DIVERSIFIED'
export type SovereignFundGovernance = 'INDEPENDENT' | 'STATE_CONTROL' | 'MIXED'
export type SovereignFundFundingSource = 'DEBT' | 'ASSET_SALES' | 'BUDGET_REALLOCATION' | 'HYBRID'

export interface SovereignFundHolding {
  category: string
  /** Share of the portfolio, [0, 1] — every holding's share across the fund sums to 1. */
  share: number
}

export interface SovereignFundState {
  exists: boolean
  createdTurn: number | null
  /** Total state capital ever contributed (initial capitalization + any recapitalization) — the fixed reference point "net value created" is measured against (§46). */
  capitalContributed: number
  /** Current mark-to-market value of the portfolio + cash. */
  portfolioValue: number
  strategy: SovereignFundStrategy
  governance: SovereignFundGovernance
  fundingSource: SovereignFundFundingSource
  /** Sum of every year's return, positive or negative — informational, `portfolioValue` is the source of truth. */
  cumulativeReturn: number
  cumulativeDividendsToState: number
  holdings: SovereignFundHolding[]
  /** Turns since the last recapitalization was allowed — see `fundEngine.ts`'s cooldown. */
  lastRecapitalizationTurn: number | null
}

export const NO_SOVEREIGN_FUND: SovereignFundState = {
  exists: false,
  createdTurn: null,
  capitalContributed: 0,
  portfolioValue: 0,
  strategy: 'DIVERSIFIED',
  governance: 'MIXED',
  fundingSource: 'HYBRID',
  cumulativeReturn: 0,
  cumulativeDividendsToState: 0,
  holdings: [],
  lastRecapitalizationTurn: null,
}
