import type { DelayedEffect } from '../effects/delayedEffect.ts'

/** A deterministic PRNG seed. Same seed => same game trajectory. */
export type Seed = string

/** Turn counter. One turn = 2 in-fiction months (see GameMeta). */
export type Turn = number

/**
 * Coarse lifecycle phase of a run. Deliberately minimal for M0 — this is a
 * placeholder extended in M1+ as campaign/government/election phases are
 * built (see Product Bible §3, §13).
 */
export type GamePhase = 'setup' | 'in_progress' | 'ended'

export interface GameMeta {
  seed: Seed
  turn: Turn
  year: number
  month: number
  phase: GamePhase
}

/**
 * Headline + engine-internal economic indicators (Product Bible §4 and §6).
 * Computed turn over turn by the Economic Engine (`engine/economy/`,
 * M1+) — see docs/ECONOMIC_ENGINE.md for units, formulas, and the
 * annualization convention.
 *
 * Units (see docs/ECONOMIC_ENGINE.md for the full rationale):
 * - `gdp`, `nominalGdp`, `debt`, `publicRevenue`, `publicSpending`,
 *   `interestCost`: levels in Md€ (billions of euros); the flow figures are
 *   annualized run-rates ("at this pace, over a full year").
 * - `growth`, `potentialGrowth`, `inflation`, `productivityGrowth`,
 *   `effectiveDebtRate`: annualized percentage rates.
 * - `unemployment`, `structuralUnemployment`, `deficitRatio`, `debtRatio`:
 *   percentages.
 * - `fiscalBalance`, `deficit`: Md€ (annualized flow; positive
 *   `fiscalBalance` = surplus, negative = deficit; `deficit` itself is
 *   always >= 0).
 * - `purchasingPower`: a cumulative INDEX, in percentage points of
 *   deviation from the campaign-start baseline (0 at game start) — not a
 *   rate.
 * - `consumerConfidence`, `businessConfidence`, `marketConfidence`,
 *   `publicSectorEfficiency`: indices on a 0-100 scale.
 */
export interface EconomicState {
  gdp: number
  nominalGdp: number
  potentialGrowth: number
  growth: number
  inflation: number

  unemployment: number
  structuralUnemployment: number

  publicRevenue: number
  publicSpending: number
  fiscalBalance: number
  deficit: number
  deficitRatio: number

  debt: number
  debtRatio: number

  effectiveDebtRate: number
  interestCost: number

  purchasingPower: number

  productivityGrowth: number

  consumerConfidence: number
  businessConfidence: number
  marketConfidence: number

  publicSectorEfficiency: number
}

export interface PoliticalState {
  popularity: number
  parliamentSeats: number
  politicalCredibility: number
}

export interface SocialState {
  socialTension: number
}

export interface PolicyState {
  /** IDs of currently active policies/reforms, e.g. "pension_reform". */
  activePolicies: string[]
}

export interface GameState {
  meta: GameMeta
  economic: EconomicState
  political: PoliticalState
  social: SocialState
  policy: PolicyState
  delayedEffects: DelayedEffect[]
}
