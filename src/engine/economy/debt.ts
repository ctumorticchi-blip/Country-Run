import { TURNS_PER_YEAR } from '../state/calendar.ts'
import type { EconomicEngineConfig } from './config/types.ts'
import type { WorldState } from './types.ts'

export interface ComputeEffectiveDebtRateInput {
  effectiveDebtRatePrev: number
  world: WorldState
  /** Previous turn's marketConfidence — this turn's is computed after debt, to avoid circularity. */
  marketConfidencePrev: number
  config: EconomicEngineConfig['debt']
}

/**
 * The ECB rate does not reprice the whole debt stock instantly. Only a
 * `refinancingShare` of the blended rate moves toward the new borrowing
 * rate each turn — the rest stays at the old average cost (Product Bible
 * §6, "Ancien coût moyen progressivement remplacé par le coût des
 * nouvelles émissions"). The new borrowing rate itself is the ECB rate
 * plus a baseline spread plus a sovereign risk premium that widens as
 * marketConfidence falls below neutral.
 */
export function computeEffectiveDebtRate(input: ComputeEffectiveDebtRateInput): number {
  const { effectiveDebtRatePrev, world, marketConfidencePrev, config } = input

  const riskPremium = config.riskPremiumPerConfidencePoint * Math.max(0, 50 - marketConfidencePrev)
  const newBorrowingRate = world.ecbRate + config.baselineSpread + riskPremium

  const next = effectiveDebtRatePrev * (1 - config.refinancingShare) + newBorrowingRate * config.refinancingShare
  return Math.max(config.minEffectiveDebtRate, next)
}

/** Md€/year: the effective rate applied to the debt stock as it stood at the start of the turn. */
export function computeInterestCost(effectiveDebtRateNext: number, debtPrev: number): number {
  return (effectiveDebtRateNext / 100) * debtPrev
}

export interface ComputeDebtInput {
  debtPrev: number
  nominalGdpNext: number
  /** publicRevenue - publicSpending for the turn being computed (positive = surplus). */
  fiscalBalance: number
  config: EconomicEngineConfig['debt']
}

/**
 * debt(t+1) = debt(t) + financingRequirement + stockFlowAdjustment.
 *
 * Critically, `financingRequirement` is only the PER-TURN SLICE of the
 * annualized fiscal balance (`-fiscalBalance / TURNS_PER_YEAR`) — the debt
 * stock must not accumulate a full year's deficit every 2-month turn (that
 * would 6x the debt's actual growth rate). `debtRatio` is then computed
 * against `nominalGdpNext`, which is what lets a growing nominal GDP
 * stabilize or shrink the ratio even while nominal debt keeps rising.
 */
export function computeDebt(input: ComputeDebtInput): { debt: number; debtRatio: number } {
  const { debtPrev, nominalGdpNext, fiscalBalance, config } = input

  const financingRequirementPerTurn = -fiscalBalance / TURNS_PER_YEAR
  const stockFlowAdjustmentPerTurn = config.stockFlowAdjustment / TURNS_PER_YEAR

  const debt = Math.max(0, debtPrev + financingRequirementPerTurn + stockFlowAdjustmentPerTurn)
  const debtRatio = (debt / nominalGdpNext) * 100

  return { debt, debtRatio }
}
