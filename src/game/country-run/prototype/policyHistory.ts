import type { Turn } from '../../../engine/state/gameState.ts'
import type { PromiseCategory } from '../promises/promiseTypes.ts'

/**
 * A record of one meaningful policy decision (M3 §24) — enough for promise
 * evaluators to later answer "did the player raise household taxes? cut
 * pensions? deliver the hospital plan? when?" without duplicating the
 * whole engine state every turn. Deliberately a flat, append-only,
 * serializable list — a handful of entries per playthrough, not a
 * turn-by-turn snapshot log.
 */
export interface PolicyHistoryEntry {
  turn: Turn
  /** Stable id of the decision/category this entry came from, e.g. "bercy:assume-deficit", "budget:health". */
  sourceId: string
  /** Human-readable, for a future history view — never used for evaluation logic itself. */
  label: string
  /** Tags this entry toward promise categories it can help evaluate (a budget category entry always sets this). */
  category?: PromiseCategory
  /** Md€/year magnitude of the decision, when applicable (e.g. a budget category's chosen level). */
  amount?: number
}

export function appendPolicyHistory(history: readonly PolicyHistoryEntry[], entry: PolicyHistoryEntry): PolicyHistoryEntry[] {
  return [...history, entry]
}
