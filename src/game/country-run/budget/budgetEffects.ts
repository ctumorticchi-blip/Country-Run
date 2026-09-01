import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_ORDER, getTier } from './budgetCategories.ts'
import type { BercyWarningLevel, BudgetImpactEstimate, BudgetLevels, BudgetSelections } from './budgetTypes.ts'

/** Resolves a draft `BudgetSelections` (tier ids) to the absolute `BudgetLevels` (Md€/year) it represents. */
export function selectionsToLevels(selections: BudgetSelections): BudgetLevels {
  const levels = {} as BudgetLevels
  for (const categoryId of BUDGET_CATEGORY_ORDER) {
    levels[categoryId] = getTier(categoryId, selections[categoryId]).value
  }
  return levels
}

/**
 * Sums every category's ABSOLUTE Md€ level into the (few) `EconomicPolicyInput`
 * fields they map to. This is the ONLY place budget categories translate
 * into the real engine — everything downstream (growth, deficit, debt...)
 * is computed by the calibrated M1.5 engine, not by this prototype layer.
 * Returns the FULL sustained policy contribution, not a delta — the
 * mandate turn controller is responsible for diffing this against last
 * turn's total via the engine's own `computePolicyDelta` (M5 §29).
 */
export function budgetLevelsToPolicyInput(levels: BudgetLevels): Partial<EconomicPolicyInput> {
  const delta: Partial<EconomicPolicyInput> = {}
  for (const categoryId of BUDGET_CATEGORY_ORDER) {
    const category = BUDGET_CATEGORIES[categoryId]
    delta[category.engineField] = (delta[category.engineField] ?? 0) + levels[categoryId]
  }
  return delta
}

/** Sum of all categories' absolute Md€/year levels — the total fiscal stance. */
export function totalBudgetLevel(levels: BudgetLevels): number {
  return BUDGET_CATEGORY_ORDER.reduce((sum, categoryId) => sum + levels[categoryId], 0)
}

/** Sum of (new - previous) per category — M5 §32's "change vs current policy". */
export function netChangeFromCurrentPolicy(newLevels: BudgetLevels, previousLevels: BudgetLevels): number {
  return BUDGET_CATEGORY_ORDER.reduce((sum, categoryId) => sum + (newLevels[categoryId] - previousLevels[categoryId]), 0)
}

export function classifyBercyWarning(totalAnnualLevel: number): BercyWarningLevel {
  if (totalAnnualLevel > 25) return 'expansionist'
  if (totalAnnualLevel >= 10) return 'stimulus'
  if (totalAnnualLevel > -10) return 'balanced'
  if (totalAnnualLevel >= -25) return 'consolidation'
  return 'austerity'
}

export const BERCY_WARNING_COPY: Record<BercyWarningLevel, { title: string; body: string; severe: boolean }> = {
  expansionist: {
    title: 'BUDGET TRÈS EXPANSIONNISTE',
    body: 'Bercy estime que la trajectoire de dette devient difficile à stabiliser.',
    severe: true,
  },
  stimulus: { title: 'RELANCE BUDGÉTAIRE', body: 'Un budget de soutien à l’activité, financé par un déficit plus élevé.', severe: false },
  balanced: { title: 'BUDGET ÉQUILIBRÉ', body: 'Les nouvelles mesures s’équilibrent globalement.', severe: false },
  consolidation: {
    title: 'CONSOLIDATION BUDGÉTAIRE',
    body: 'Un effort d’économies mesuré, qui améliore la trajectoire des finances publiques.',
    severe: false,
  },
  austerity: {
    title: 'AUSTÉRITÉ FORTE',
    body: 'Risque élevé sur la croissance, les services publics et la contestation sociale.',
    severe: true,
  },
}

/**
 * A FAST, engine-informed APPROXIMATION for live UI feedback as the player
 * adjusts the budget — not a call into the real simulation. Deliberately
 * returns ranges, never a single precise number (M2 §12, M5 §32-33).
 */
export function estimateBudgetImpact(newLevels: BudgetLevels, previousLevels: BudgetLevels, gdp: number): BudgetImpactEstimate {
  const totalAnnualLevel = totalBudgetLevel(newLevels)
  const netChange = netChangeFromCurrentPolicy(newLevels, previousLevels)
  const warningLevel = classifyBercyWarning(totalAnnualLevel)

  // The marginal CHANGE this cycle is what actually moves next turn's trajectory —
  // a budget kept identical to last year (netChange = 0) shouldn't show a fresh deficit/growth swing.
  const pctOfGdp = (netChange / gdp) * 100

  const deficitCentral = pctOfGdp
  const growthCentral = pctOfGdp * 0.4
  const popularityCentral = netChange * 0.12

  const band = (central: number, spread: number): [number, number] => {
    const lo = central - Math.abs(central) * spread - 0.02
    const hi = central + Math.abs(central) * spread + 0.02
    return [Number(lo.toFixed(2)), Number(hi.toFixed(2))]
  }

  const marketRisk = totalAnnualLevel > 25 || totalAnnualLevel < -25 ? 'ÉLEVÉ' : totalAnnualLevel > 10 || totalAnnualLevel < -10 ? 'MODÉRÉ' : 'FAIBLE'

  return {
    totalAnnualLevel,
    netChangeFromCurrentPolicy: netChange,
    warningLevel,
    deficitRatioDeltaRange: band(deficitCentral, 0.35),
    growthDeltaRange: band(growthCentral, 0.4),
    popularityDeltaRange: band(popularityCentral, 0.5),
    marketRisk,
  }
}
