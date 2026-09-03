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

/** M6.5 §21: each ADDITIONAL use this mandate compounds the cost — "repeated usage compounds political consequences", never a free repeatable skip-Parliament button. Capped so it stays a large-but-payable cost, not an eventual mathematical impossibility. */
export const EXCEPTIONAL_PROCEDURE_ESCALATION_PER_USE = 8
export const EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS = 4

export const MIN_GOVERNMENT_TENSION = 0
export const MAX_GOVERNMENT_TENSION = 100

export function clampGovernmentTension(value: number): number {
  return Math.min(MAX_GOVERNMENT_TENSION, Math.max(MIN_GOVERNMENT_TENSION, value))
}

/** `usageCount` is the number of times the procedure has ALREADY been used this mandate (0 the first time). */
function escalationFactor(usageCount: number): number {
  return Math.min(usageCount, EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS)
}

export function exceptionalProcedureCost(usageCount: number): number {
  return EXCEPTIONAL_PROCEDURE_CAPITAL_COST + escalationFactor(usageCount) * EXCEPTIONAL_PROCEDURE_ESCALATION_PER_USE
}

export function canUseExceptionalProcedure(politicalCapital: number, usageCount = 0): boolean {
  return politicalCapital >= exceptionalProcedureCost(usageCount)
}

export interface ExceptionalProcedureResult {
  politicalCapitalAfter: number
  popularityDelta: number
  governmentTensionAfter: number
}

/**
 * Bill is treated as auto-adopted by the caller — this only returns the
 * costs, never re-derives the vote. `usageCount` is the number of PRIOR
 * uses this mandate (M6.5 §21 escalation — see `exceptionalProcedureCost`/
 * `EXCEPTIONAL_PROCEDURE_ESCALATION_PER_USE`).
 */
export function applyExceptionalProcedure(politicalCapital: number, governmentTension: number, usageCount = 0): ExceptionalProcedureResult {
  const factor = escalationFactor(usageCount)
  return {
    politicalCapitalAfter: Math.max(0, politicalCapital - exceptionalProcedureCost(usageCount)),
    popularityDelta: EXCEPTIONAL_PROCEDURE_POPULARITY_PENALTY - factor,
    governmentTensionAfter: clampGovernmentTension(governmentTension + EXCEPTIONAL_PROCEDURE_TENSION_INCREASE + factor * 2),
  }
}

/** Blocs clearly opposed at the moment the procedure is invoked take the relationship hit (M4 §14 "procedural forcing"). */
export function blocsHostileToProcedure(blocBreakdown: readonly Pick<BlocSupportEstimate, 'blocId' | 'supportProbability'>[]): string[] {
  return blocBreakdown.filter((b) => b.supportProbability < 0.4).map((b) => b.blocId)
}
