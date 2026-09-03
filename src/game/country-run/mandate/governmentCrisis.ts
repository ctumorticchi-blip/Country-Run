/**
 * M6.5 §22: a LIGHTWEIGHT government-crisis mechanic — deliberately not a
 * full constitutional/confidence-vote simulator, and never itself capable
 * of ending the mandate. Two triggers, exactly as the brief lists them:
 * government tension crossing a very high threshold, or exceptional
 * procedure usage crossing a repeated-use multiple. Consequences are a
 * one-off capital/popularity hit plus a `governmentCrisisCount` bump the
 * UI/History can surface — never a bespoke PM/cabinet simulation.
 */
export const GOVERNMENT_CRISIS_TENSION_THRESHOLD = 90
export const GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE = 3

export const GOVERNMENT_CRISIS_CAPITAL_PENALTY = 10
export const GOVERNMENT_CRISIS_POPULARITY_PENALTY = -4
export const GOVERNMENT_CRISIS_RELATION_PENALTY = -5

export interface GovernmentCrisisCheckInput {
  tensionBefore: number
  tensionAfter: number
  exceptionalProcedureUsageCountBefore: number
  exceptionalProcedureUsageCountAfter: number
}

/**
 * True only on the TURN the trigger condition is first crossed (tension
 * rising past the threshold, or usage count reaching a new multiple) —
 * never re-fires every subsequent turn tension merely STAYS high, so one
 * sustained crisis reads as one event, not a a repeating tax.
 */
export function governmentCrisisTriggered(input: GovernmentCrisisCheckInput): boolean {
  const tensionCrossed = input.tensionBefore < GOVERNMENT_CRISIS_TENSION_THRESHOLD && input.tensionAfter >= GOVERNMENT_CRISIS_TENSION_THRESHOLD
  const beforeMultiple = Math.floor(input.exceptionalProcedureUsageCountBefore / GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE)
  const afterMultiple = Math.floor(input.exceptionalProcedureUsageCountAfter / GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE)
  const usageCrossed = input.exceptionalProcedureUsageCountAfter > 0 && afterMultiple > beforeMultiple
  return tensionCrossed || usageCrossed
}

export interface GovernmentCrisisConsequence {
  politicalCapitalDelta: number
  popularityDelta: number
  /** Applied to EVERY non-presidential bloc — a government-wide crisis reads as broadly damaging, not targeted at one bloc. */
  relationDeltaAllBlocs: number
}

export function governmentCrisisConsequence(): GovernmentCrisisConsequence {
  return {
    politicalCapitalDelta: -GOVERNMENT_CRISIS_CAPITAL_PENALTY,
    popularityDelta: GOVERNMENT_CRISIS_POPULARITY_PENALTY,
    relationDeltaAllBlocs: GOVERNMENT_CRISIS_RELATION_PENALTY,
  }
}
