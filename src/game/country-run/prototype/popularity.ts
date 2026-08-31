/**
 * ⚠️ PROTOTYPE-ONLY POPULARITY MODEL (M2 §17). This is deliberately a very
 * simple, hand-tuned accumulator — NOT part of the generic economic engine
 * and not validated against anything. It exists so decisions feel like
 * they matter politically, not economically. A real, demographic-subgroup
 * popularity model (Product Bible §11: actifs/retraités/jeunes/...) is
 * explicitly out of scope for this prototype.
 *
 * Popularity only ever moves through the named functions below, each
 * called once at a specific decision point, so the accumulated value stays
 * traceable to a specific player choice or outcome.
 */

import { BUDGET_CATEGORY_ORDER } from '../budget/budgetCategories.ts'
import type { BudgetSelections } from '../budget/budgetTypes.ts'

/** Clamps popularity to the valid [0, 100] range. */
export function clampPopularity(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function applyPopularityDelta(current: number, delta: number): number {
  return clampPopularity(current + delta)
}

/**
 * A year-end nudge from how purchasing power and unemployment actually
 * moved over Year 1 (not just the player's declared choices) — rough
 * magnitudes per the M2 brief: good purchasing power +1 to +3, worsening
 * unemployment -1 to -3.
 */
export function popularityFromYearEndOutcomes(purchasingPowerDelta: number, unemploymentDelta: number): number {
  const purchasingPowerEffect = clampContribution(purchasingPowerDelta * 1.5, -3, 3)
  const unemploymentEffect = clampContribution(-unemploymentDelta * 2, -3, 1)
  return purchasingPowerEffect + unemploymentEffect
}

/** Parliament outcome nudge — per the brief, a rejection costs a flat -2 (a compromise is still simulated). */
export function popularityFromParliamentOutcome(outcome: 'adopted' | 'rejected'): number {
  return outcome === 'rejected' ? -2 : 0
}

function clampContribution(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Rough per-category nudges from the enacted budget (§17: "large
 * health/education investment: +1 to +2", "heavy spending cuts: -1 to
 * -4") — defense is explicitly called out as having a small political
 * effect in this prototype, so it counts for less either way.
 */
export function popularityFromBudget(selections: BudgetSelections): number {
  return BUDGET_CATEGORY_ORDER.reduce((delta, categoryId) => {
    const level = selections[categoryId]
    const isDefense = categoryId === 'defense'
    if (level === 'invest') return delta + (isDefense ? 0.5 : 1.5)
    if (level === 'cut') return delta + (isDefense ? -0.5 : -2)
    return delta
  }, 0)
}
