import type { BlocSupportEstimate } from './supportEstimate.ts'

/**
 * ⚠️ PROTOTYPE-ONLY "ENGAGER LA RESPONSABILITÉ DU GOUVERNEMENT" (M4 §20).
 * A simplified, intentionally-not-real-institutional-terminology stand-in
 * for forcing a bill through without an ordinary majority. Powerful but
 * expensive: a large flat political-capital cost, a popularity penalty,
 * and a `governmentTension` bump — tracked for a future milestone's
 * confidence-vote/government-crisis mechanic, which does NOT exist yet in
 * M4 (no government collapse this milestone, per the brief).
 */
export const EXCEPTIONAL_PROCEDURE_CAPITAL_COST = 25
export const EXCEPTIONAL_PROCEDURE_POPULARITY_PENALTY = -6
export const EXCEPTIONAL_PROCEDURE_TENSION_INCREASE = 15

export const MIN_GOVERNMENT_TENSION = 0
export const MAX_GOVERNMENT_TENSION = 100

export function clampGovernmentTension(value: number): number {
  return Math.min(MAX_GOVERNMENT_TENSION, Math.max(MIN_GOVERNMENT_TENSION, value))
}

export function canUseExceptionalProcedure(politicalCapital: number): boolean {
  return politicalCapital >= EXCEPTIONAL_PROCEDURE_CAPITAL_COST
}

export interface ExceptionalProcedureResult {
  politicalCapitalAfter: number
  popularityDelta: number
  governmentTensionAfter: number
}

/** Bill is treated as auto-adopted by the caller — this only returns the costs, never re-derives the vote. */
export function applyExceptionalProcedure(politicalCapital: number, governmentTension: number): ExceptionalProcedureResult {
  return {
    politicalCapitalAfter: Math.max(0, politicalCapital - EXCEPTIONAL_PROCEDURE_CAPITAL_COST),
    popularityDelta: EXCEPTIONAL_PROCEDURE_POPULARITY_PENALTY,
    governmentTensionAfter: clampGovernmentTension(governmentTension + EXCEPTIONAL_PROCEDURE_TENSION_INCREASE),
  }
}

/** Blocs clearly opposed at the moment the procedure is invoked take the relationship hit (M4 §14 "procedural forcing"). */
export function blocsHostileToProcedure(blocBreakdown: readonly Pick<BlocSupportEstimate, 'blocId' | 'supportProbability'>[]): string[] {
  return blocBreakdown.filter((b) => b.supportProbability < 0.4).map((b) => b.blocId)
}
