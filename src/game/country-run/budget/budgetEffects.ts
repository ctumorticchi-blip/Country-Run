import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_ORDER } from './budgetCategories.ts'
import type { BercyWarningLevel, BudgetImpactEstimate, BudgetSelections } from './budgetTypes.ts'

/**
 * Sums every category's Md€ delta into the (few) `EconomicPolicyInput`
 * fields they map to. This is the ONLY place budget categories translate
 * into the real engine — everything downstream (growth, deficit, debt...)
 * is computed by the calibrated M1.5 engine, not by this prototype layer.
 */
export function budgetSelectionsToPolicyDelta(selections: BudgetSelections): Partial<EconomicPolicyInput> {
  const delta: Partial<EconomicPolicyInput> = {}

  for (const categoryId of BUDGET_CATEGORY_ORDER) {
    const category = BUDGET_CATEGORIES[categoryId]
    const level = selections[categoryId]
    const amount = category.levels[level]
    delta[category.engineField] = (delta[category.engineField] ?? 0) + amount
  }

  return delta
}

/** Net Md€/year across every category — what the Bercy warning is based on. */
export function computeNetAnnualChange(selections: BudgetSelections): number {
  return BUDGET_CATEGORY_ORDER.reduce((sum, categoryId) => {
    const category = BUDGET_CATEGORIES[categoryId]
    return sum + category.levels[selections[categoryId]]
  }, 0)
}

export function classifyBercyWarning(netAnnualChange: number): BercyWarningLevel {
  if (netAnnualChange > 25) return 'expansionist'
  if (netAnnualChange >= 10) return 'stimulus'
  if (netAnnualChange > -10) return 'balanced'
  if (netAnnualChange >= -25) return 'consolidation'
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
 * adjusts the budget — not a call into the real simulation (which would be
 * too slow/heavy to re-run on every click, and isn't meant to reveal an
 * exact forecast anyway — see docs/GAMEPLAY_M2.md, "Live preview vs real
 * simulation"). The real outcome is only known once
 * `advanceEconomicTurn` actually runs, after Parliament passes the budget.
 * Deliberately returns ranges, never a single precise number, matching the
 * Product Bible's advisor philosophy (§7, §12: ranges and confidence,
 * never a perfect truth).
 */
export function estimateBudgetImpact(selections: BudgetSelections, gdp: number): BudgetImpactEstimate {
  const netAnnualChange = computeNetAnnualChange(selections)
  const warningLevel = classifyBercyWarning(netAnnualChange)

  const pctOfGdp = (netAnnualChange / gdp) * 100

  // Rough central estimates, then a ±30% band to make the "estimate, not a fact" nature visible.
  const deficitCentral = pctOfGdp
  const growthCentral = pctOfGdp * 0.4 // a fraction of a point of GDP-worth of stimulus, roughly
  const popularityCentral = netAnnualChange * 0.12

  const band = (central: number, spread: number): [number, number] => {
    const lo = central - Math.abs(central) * spread - 0.02
    const hi = central + Math.abs(central) * spread + 0.02
    return [Number(lo.toFixed(2)), Number(hi.toFixed(2))]
  }

  const marketRisk = netAnnualChange > 25 || netAnnualChange < -25 ? 'ÉLEVÉ' : netAnnualChange > 10 || netAnnualChange < -10 ? 'MODÉRÉ' : 'FAIBLE'

  return {
    netAnnualChange,
    warningLevel,
    deficitRatioDeltaRange: band(deficitCentral, 0.35),
    growthDeltaRange: band(growthCentral, 0.4),
    popularityDeltaRange: band(popularityCentral, 0.5),
    marketRisk,
  }
}
