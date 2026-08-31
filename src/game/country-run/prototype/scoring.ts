import type { EconomicState } from '../../../engine/state/gameState.ts'
import type { BudgetSelections } from '../budget/budgetTypes.ts'

/**
 * ⚠️ PROTOTYPE-ONLY SCORING (M2 §19-20). A simple, bounded, documented
 * heuristic over the real engine's start/end EconomicState — not a
 * validated metric, and never presented as one. Weights per the brief:
 * economy 25%, public finances 25%, purchasing power 20%, public
 * services/investment 15%, popularity/stability 15%.
 */

function clamp0to100(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function scoreEconomy(end: EconomicState, start: EconomicState): number {
  const growthScore = clamp0to100(50 + (end.growth - start.growth) * 20 + (end.growth - 0.9) * 10)
  const unemploymentScore = clamp0to100(50 - (end.unemployment - start.unemployment) * 15)
  return (growthScore + unemploymentScore) / 2
}

function scoreFinances(end: EconomicState): number {
  const debtScore = clamp0to100(50 - (end.debtRatio - 120) * 3)
  const deficitScore = clamp0to100(50 - (end.deficitRatio - 3) * 8)
  return (debtScore + deficitScore) / 2
}

function scorePurchasingPower(end: EconomicState): number {
  // purchasingPower is a cumulative index, 0 = baseline at game start (see gameState.ts).
  return clamp0to100(50 + end.purchasingPower * 15)
}

function scoreServices(end: EconomicState, start: EconomicState, selections: BudgetSelections): number {
  const productivityScore = clamp0to100(50 + (end.productivityGrowth - start.productivityGrowth) * 200)
  const investedInFuture = selections.education === 'invest' || selections.investment === 'invest'
  return clamp0to100(investedInFuture ? productivityScore + 5 : productivityScore)
}

function scorePopularity(finalPopularity: number): number {
  return clamp0to100(finalPopularity)
}

export interface ScoreBreakdown {
  economy: number
  finances: number
  purchasingPower: number
  services: number
  popularity: number
  /** [0, 1] — applied on top of the weighted sum so no single strong metric can fully mask a catastrophe. */
  catastropheMultiplier: number
  /** Final score out of 10 000. */
  total: number
}

export function computeScore(
  start: EconomicState,
  end: EconomicState,
  finalPopularity: number,
  selections: BudgetSelections,
): ScoreBreakdown {
  const economy = scoreEconomy(end, start)
  const finances = scoreFinances(end)
  const purchasingPower = scorePurchasingPower(end)
  const services = scoreServices(end, start, selections)
  const popularity = scorePopularity(finalPopularity)

  const weighted = economy * 0.25 + finances * 0.25 + purchasingPower * 0.2 + services * 0.15 + popularity * 0.15

  // No single metric should fully compensate for a genuine catastrophe elsewhere.
  let catastropheMultiplier = 1
  const debtRatioDelta = end.debtRatio - start.debtRatio
  if (debtRatioDelta > 3 && end.deficitRatio > 7) catastropheMultiplier *= 0.9
  if (end.growth < 0) catastropheMultiplier *= 0.9
  if (end.unemployment - start.unemployment > 1) catastropheMultiplier *= 0.95

  const total = Math.round(weighted * catastropheMultiplier * 100)

  return { economy, finances, purchasingPower, services, popularity, catastropheMultiplier, total: Math.min(10000, Math.max(0, total)) }
}

export type EndingTitle = 'LE BÂTISSEUR' | 'LE GESTIONNAIRE' | 'LE PARI RISQUÉ' | 'LE PRÉSIDENT PRUDENCE' | 'LA TEMPÊTE'

/**
 * Rule-based, checked in order — describes the SHAPE of the run (what kind
 * of president the player played), never an ideological judgment (M2
 * §20). Ties are broken by whichever rule is listed first.
 */
export function computeEndingTitle(
  start: EconomicState,
  end: EconomicState,
  finalPopularity: number,
  selections: BudgetSelections,
): EndingTitle {
  const growthDelta = end.growth - start.growth
  const debtRatioDelta = end.debtRatio - start.debtRatio
  const deficitRatioDelta = end.deficitRatio - start.deficitRatio
  const unemploymentDelta = end.unemployment - start.unemployment
  const investedInFuture = selections.education === 'invest' || selections.investment === 'invest'

  const badGrowth = growthDelta < -0.3
  const badDebt = debtRatioDelta > 3
  const badPopularity = finalPopularity < 45
  const badCount = [badGrowth, badDebt, badPopularity, unemploymentDelta > 0.5].filter(Boolean).length

  if (badCount >= 3) return 'LA TEMPÊTE'
  if (investedInFuture && debtRatioDelta <= 3) return 'LE BÂTISSEUR'
  if (growthDelta > 0.3 && debtRatioDelta > 2) return 'LE PARI RISQUÉ'
  if (deficitRatioDelta < -0.3 && growthDelta < 0.3) return 'LE PRÉSIDENT PRUDENCE'
  if (deficitRatioDelta <= 0.3 && growthDelta >= -0.1) return 'LE GESTIONNAIRE'
  return 'LE GESTIONNAIRE'
}
