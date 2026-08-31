import type { EconomicState } from '../state/gameState.ts'

/**
 * Exogenous variables the player never controls directly (Product Bible §5,
 * "Monde extérieur"). The engine reacts to these; nothing in
 * `engine/economy/` ever writes to them except `applyExternalShockToWorld`.
 *
 * Units: `eurozoneGrowth`, `globalTradeGrowth`, `externalInflation` are
 * annualized percentage rates; `ecbRate` is an annualized percentage
 * policy rate; `oilPriceIndex` is an index where 100 = the value at
 * campaign start.
 */
export interface WorldState {
  eurozoneGrowth: number
  ecbRate: number
  oilPriceIndex: number
  globalTradeGrowth: number
  externalInflation: number
}

/**
 * A one-off external shock (Product Bible §5): additive deltas applied to
 * `WorldState` for the turn(s) it is active, an optional direct hit to
 * growth (the "crisis effect" term — e.g. a supply disruption that isn't
 * fully captured by the world deltas alone), and an optional immediate
 * confidence hit. Purely structural — no narrative content (title, flavor
 * text) lives here; that's Year 1 content, out of scope for the engine.
 */
export interface ExternalShock {
  id: string
  /** Additive deltas applied to WorldState fields for as long as this shock is passed in. */
  world?: Partial<Pick<WorldState, 'eurozoneGrowth' | 'oilPriceIndex' | 'globalTradeGrowth' | 'externalInflation'>>
  /** Additive annualized pp hit to growth this turn (the "-crisisEffect" term), independent of the world deltas above. */
  directGrowthEffect?: number
  /** Additive deltas (0-100 scale) applied directly to confidence indices this turn. */
  confidence?: Partial<Pick<EconomicState, 'consumerConfidence' | 'businessConfidence' | 'marketConfidence'>>
}

/**
 * The turn's economic policy impulse — everything the player (or, at M1, a
 * test/scenario) can decide that feeds the Economic Engine. Deliberately an
 * aggregate abstraction rather than one field per future decision, so
 * content doesn't need to be hardcoded into the macro formulas (Product
 * Bible §16, "Tout coefficient économique important doit être
 * configurable").
 *
 * Units: the `*Changes` fiscal fields and the `*Investment` fields are
 * annualized Md€/year deltas relative to the current baseline. The
 * `*TaxImpulse` fields are annualized Md€/year of net revenue effect
 * (positive = a tax increase, negative = a tax cut) — used both for their
 * revenue impact (via `taxChanges`, which the caller is responsible for
 * keeping consistent) and their demand/confidence side effects. The reform
 * fields are an intensity in [0, 1]: 0 = no reform, 1 = the strongest
 * single-turn reform the engine models — reforms always take effect via
 * delayed effects (see `productivity.ts`), never instantly.
 */
export interface EconomicPolicyInput {
  taxChanges: number
  currentSpendingChanges: number
  publicInvestmentChanges: number
  transfersChanges: number

  businessTaxImpulse: number
  householdTaxImpulse: number

  researchInvestment: number
  infrastructureInvestment: number
  educationInvestment: number

  laborMarketReform: number
  publicSectorReform: number
}

/** A no-op policy input — useful as a baseline for tests and "neutral" scenarios. */
export const NEUTRAL_POLICY_INPUT: EconomicPolicyInput = {
  taxChanges: 0,
  currentSpendingChanges: 0,
  publicInvestmentChanges: 0,
  transfersChanges: 0,
  businessTaxImpulse: 0,
  householdTaxImpulse: 0,
  researchInvestment: 0,
  infrastructureInvestment: 0,
  educationInvestment: 0,
  laborMarketReform: 0,
  publicSectorReform: 0,
}

/**
 * Explains *why* a turn's economic result came out the way it did — for
 * future advisors/UI to narrate, never itself containing UI text (Product
 * Bible §12, advisors give ranges/reasons, not verdicts).
 */
export interface EconomicDiagnostics {
  growthContributions: {
    potentialGrowth: number
    fiscalImpulse: number
    externalEffect: number
    confidenceEffect: number
    productivityEffect: number
    crisisEffect: number
    noise: number
  }
  inflationContributions: {
    inertia: number
    demandPressure: number
    external: number
    energy: number
    tax: number
    noise: number
  }
  confidenceContributions: {
    consumer: number
    business: number
    market: number
  }
  /** Md€/year: the noise-driven part of publicRevenue's change, isolated from elasticity-driven growth. */
  revenueSurprise: number
  /** Percentage points: effectiveDebtRate(next) - effectiveDebtRate(prev). */
  interestRateChange: number
  /** Percentage points: unemployment(next) - unemployment(prev). */
  unemploymentChange: number
}
