import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'
import type { PromiseCategory, PromiseEvaluation, PromiseStatus } from './promiseTypes.ts'

/**
 * Shared evaluator shapes, reused by the promise catalog. Each takes the
 * pieces it needs from `PromiseEvaluationContext` explicitly rather than
 * the whole context, so a promise's `evaluate` closure stays a one-liner.
 */

function progressStatus(currentTurn: number, deadlineTurn: number, achieved: boolean, progressFraction: number): PromiseStatus {
  const timeFraction = deadlineTurn > 0 ? Math.min(1, currentTurn / deadlineTurn) : 1

  if (currentTurn === 0) return 'NOT_STARTED'
  if (achieved) return currentTurn >= deadlineTurn ? 'KEPT' : 'ON_TRACK'
  if (currentTurn >= deadlineTurn) return 'BROKEN'
  if (currentTurn <= 1) return 'IN_PROGRESS'
  return progressFraction >= timeFraction * 0.7 ? 'ON_TRACK' : 'AT_RISK'
}

/** A target on a single EconomicState metric — e.g. deficitRatio < 4%, unemployment < 7%. */
export function evaluateThreshold(params: {
  currentTurn: number
  deadlineTurn: number
  baseline: number
  target: number
  current: number
  lowerIsBetter: boolean
  formatValue: (value: number) => string
}): PromiseEvaluation {
  const { currentTurn, deadlineTurn, baseline, target, current, lowerIsBetter, formatValue } = params
  const achieved = lowerIsBetter ? current <= target : current >= target
  const span = target - baseline
  const rawProgress = span === 0 ? 1 : (current - baseline) / span
  const progressFraction = Math.max(0, Math.min(1, rawProgress))

  return {
    status: progressStatus(currentTurn, deadlineTurn, achieved, progressFraction),
    progressLabel: `${formatValue(current)} → objectif ${formatValue(target)}`,
    progressFraction: achieved ? 1 : progressFraction,
  }
}

/** A spending/investment commitment tracked via policyHistory (e.g. "at least +10bn on health"). */
export function evaluatePolicyCommitment(params: {
  currentTurn: number
  deadlineTurn: number
  policyHistory: readonly PolicyHistoryEntry[]
  category: PromiseCategory
  minAnnualAmount: number
}): PromiseEvaluation {
  const { currentTurn, deadlineTurn, policyHistory, category, minAnnualAmount } = params
  const delivered = policyHistory.some((entry) => entry.category === category && (entry.amount ?? 0) >= minAnnualAmount)

  if (currentTurn === 0)
    return { status: 'NOT_STARTED', progressLabel: `Objectif : ${String(minAnnualAmount)} Md€/an`, progressFraction: 0 }
  if (delivered) {
    return {
      status: currentTurn >= deadlineTurn ? 'KEPT' : 'ON_TRACK',
      progressLabel: `Engagement tenu (${String(minAnnualAmount)} Md€/an)`,
      progressFraction: 1,
    }
  }
  if (currentTurn >= deadlineTurn) return { status: 'BROKEN', progressLabel: 'Non tenu à l’échéance', progressFraction: 0 }
  return {
    status: 'AT_RISK',
    progressLabel: `Pas encore engagé — ${String(minAnnualAmount)} Md€/an attendus`,
    progressFraction: 0,
  }
}

/**
 * Documented stand-in for promises whose gameplay lever doesn't exist yet
 * in this milestone (M3 §8's explicit allowance for "restaurer les
 * services publics", extended to the other lever-less promises — see
 * promiseCatalog.ts for which ones and why). Never resolves to KEPT/BROKEN
 * — honest about not being able to actually be fulfilled or violated yet,
 * rather than faking a resolution.
 */
export function evaluateUnavailableLever(reason: string): PromiseEvaluation {
  return { status: 'IN_PROGRESS', progressLabel: reason }
}
