import type { SeededRng } from '../seeded-rng/SeededRng.ts'
import { annualPercentToPerTurnFraction } from './annualization.ts'
import type { EconomicEngineConfig } from './config/types.ts'
import { controlledNoise } from './noise.ts'

export interface ComputeRevenueInput {
  publicRevenuePrev: number
  /** growth + inflation for the turn (nominal growth proxy), annualized %. */
  nominalGrowth: number
  /** Annualized Md€/year policy delta — applied to the run-rate in full, not divided by turns/year (see docs/ECONOMIC_ENGINE.md). */
  taxChanges: number
  rng: SeededRng
  config: EconomicEngineConfig['revenue']
}

/**
 * publicRevenue is an annualized Md€/year run-rate. Its organic growth
 * (`revenueGrowth ≈ nominalGrowth × elasticity`, Product Bible §6) is a
 * PERCENTAGE RATE, so it must go through `annualPercentToPerTurnFraction`
 * before compounding the level — unlike `taxChanges`, which is already an
 * annualized Md€/year delta and applies to the run-rate directly, in full,
 * as soon as the policy takes effect.
 */
export function computePublicRevenue(input: ComputeRevenueInput): { publicRevenue: number; revenueSurprise: number } {
  const { publicRevenuePrev, nominalGrowth, taxChanges, config } = input

  const revenueGrowthAnnualized = nominalGrowth * config.elasticity
  const organicGrowth = publicRevenuePrev * annualPercentToPerTurnFraction(revenueGrowthAnnualized)

  const revenueSurprise = controlledNoise(input.rng, config.noiseStdDev) * publicRevenuePrev

  const publicRevenue = publicRevenuePrev + organicGrowth + taxChanges + revenueSurprise

  return { publicRevenue, revenueSurprise }
}

export interface ComputeSpendingInput {
  publicSpendingPrev: number
  interestCostPrev: number
  interestCostNext: number
  currentSpendingChanges: number
  publicInvestmentChanges: number
  transfersChanges: number
  config: EconomicEngineConfig['spending']
}

/**
 * publicSpending is also an annualized Md€/year run-rate: `primarySpending`
 * (everything except interest) drifts at a small configured baseline pace
 * and absorbs this turn's discretionary policy deltas directly, then
 * `interestCost` (computed separately in debt.ts, using its own dedicated
 * refinancing formula) is layered back on top.
 */
export function computePublicSpending(input: ComputeSpendingInput): number {
  const { publicSpendingPrev, interestCostPrev, interestCostNext, currentSpendingChanges, publicInvestmentChanges, transfersChanges, config } =
    input

  const primarySpendingPrev = publicSpendingPrev - interestCostPrev
  const primarySpendingNext =
    primarySpendingPrev * (1 + annualPercentToPerTurnFraction(config.baselineDrift)) +
    currentSpendingChanges +
    publicInvestmentChanges +
    transfersChanges

  return primarySpendingNext + interestCostNext
}

/**
 * fiscalBalance = publicRevenue - publicSpending. Positive = surplus,
 * negative = deficit — no ambiguity of sign (Product Bible brief for M1).
 * `deficit` is always >= 0.
 */
export function computeFiscalBalance(
  publicRevenue: number,
  publicSpending: number,
  nominalGdp: number,
): { fiscalBalance: number; deficit: number; deficitRatio: number } {
  const fiscalBalance = publicRevenue - publicSpending
  const deficit = Math.max(0, -fiscalBalance)
  const deficitRatio = (deficit / nominalGdp) * 100

  return { fiscalBalance, deficit, deficitRatio }
}
