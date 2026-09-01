import type { Turn } from '../../../engine/state/gameState.ts'
import type { EconomicState } from '../../../engine/state/gameState.ts'
import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'

/** Product Bible-neutral category labels (M3 §7) — never left/right. */
export type PromiseCategory =
  | 'purchasingPower'
  | 'employment'
  | 'publicFinances'
  | 'health'
  | 'education'
  | 'security'
  | 'environment'
  | 'housing'
  | 'pensions'
  | 'taxation'
  | 'publicServices'
  | 'investment'

export type PromiseDifficulty = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * A promise's lifecycle status (M3 §6) — richer than the generic engine's
 * `PromiseStatus` (`engine/state/promise.ts`, 4 states), so this is its own
 * Country Run-specific type rather than a change to that generic one.
 */
export type PromiseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_TRACK' | 'AT_RISK' | 'KEPT' | 'BROKEN'

/**
 * Loose political affinity tags used only for Parliament bloc compatibility
 * (`prototype/parliamentComposition.ts`) and the campaign's descriptive
 * profile label (`prototype/electionResult.ts`) — never an ideology label
 * shown to the player (M3 §2).
 */
export type PoliticalTag =
  | 'fiscalDiscipline'
  | 'socialProtection'
  | 'investment'
  | 'reform'
  | 'security'
  | 'environment'
  | 'taxCut'

export interface PromiseEvaluationContext {
  initialEconomic: EconomicState
  currentEconomic: EconomicState
  currentTurn: Turn
  policyHistory: readonly PolicyHistoryEntry[]
}

export interface PromiseEvaluation {
  status: PromiseStatus
  /** Human-readable progress, e.g. "5.0% → objectif 4.0%" — never raw engine coefficients. */
  progressLabel: string
}

/**
 * Static campaign promise content. `evaluate` is a pure function closure —
 * fine to live here as CODE (like `budgetCategories.ts`'s category config),
 * since only the player's 5 *selected promise ids* need to be part of the
 * serializable `GamePrototypeState` (M3 §27: "avoid storing derived
 * progress if it can be calculated" — status is always derived from real
 * engine state via `evaluate`, never stored).
 */
export interface PromiseDefinition {
  id: string
  category: PromiseCategory
  title: string
  shortDescription: string
  campaignPitch: string
  targetMetricLabel: string
  deadlineTurn: Turn
  deadlineLabel: string
  /** Md€/year, the promise's own fiscal footprint estimate — 0 when purely a target, not a spending commitment. */
  estimatedAnnualCost: number
  difficulty: PromiseDifficulty
  politicalTags: PoliticalTag[]
  evaluate: (ctx: PromiseEvaluationContext) => PromiseEvaluation
  /** Set on promises whose evaluator is a documented stand-in because M3's gameplay has no dedicated lever yet (M3 §8, §14, §23). */
  temporaryEvaluator?: boolean
}
