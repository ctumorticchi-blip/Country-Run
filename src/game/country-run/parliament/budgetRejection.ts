import type { ExternalShock } from '../../../engine/economy/types.ts'

/**
 * M6.5 §19: a REJECTED Budget Bill must matter beyond the ordinary
 * bill-rejection penalty every bill already takes (`resolveBillVote`'s
 * `capitalDelta`/`popularityDelta`) — the budget is the mandatory,
 * highest-stakes vote of the year, so failing it carries an EXTRA,
 * budget-specific cost: a market-confidence hit (via the same
 * `ExternalShock.confidence` mechanism events already use — see
 * `budgetForecast.ts`'s neighbouring modules for the precedent) and a
 * larger political-capital penalty. The player keeps last year's enacted
 * budget running (a "provisional budget", `applyAdoptedBudget` is simply
 * never called) — never a dead end, always followed by Reform Hub/the
 * next turn loop exactly like any other resolved bill.
 */
export const BUDGET_REJECTION_EXTRA_CAPITAL_PENALTY = 6
export const BUDGET_REJECTION_MARKET_CONFIDENCE_HIT = -7

export function budgetRejectionShock(turn: number): ExternalShock {
  return { id: `budget-rejected-turn-${String(turn)}`, confidence: { marketConfidence: BUDGET_REJECTION_MARKET_CONFIDENCE_HIT } }
}
