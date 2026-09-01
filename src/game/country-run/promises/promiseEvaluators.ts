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

/**
 * M6 §19-26, §48: a tax-cut promise (cut-household-taxes / cut-business-taxes)
 * — kept if a real minimum cut was ever ADOPTED (via a revenue block or a
 * matching reform bill/concession) on the right lever, using the ACTUAL
 * policyHistory `category`/`amount` `gameReducer.ts` now records for every
 * tax-relevant policyHistory entry (see its `taxationPolicyHistoryEntry`
 * helper) rather than the M3-era `evaluateUnavailableLever` stand-in.
 */
export function evaluateTaxCutCommitment(params: {
  currentTurn: number
  deadlineTurn: number
  policyHistory: readonly PolicyHistoryEntry[]
  sourceIdPrefixes: string[]
  minCutAmount: number
}): PromiseEvaluation {
  const { currentTurn, deadlineTurn, policyHistory, sourceIdPrefixes, minCutAmount } = params
  const relevant = policyHistory.filter((e) => e.category === 'taxation' && sourceIdPrefixes.some((prefix) => e.sourceId.startsWith(prefix)))
  const delivered = relevant.some((e) => (e.amount ?? 0) <= -minCutAmount)

  if (currentTurn === 0) return { status: 'NOT_STARTED', progressLabel: `Objectif : au moins ${String(minCutAmount)} Md€/an de baisse`, progressFraction: 0 }
  if (delivered) {
    return {
      status: currentTurn >= deadlineTurn ? 'KEPT' : 'ON_TRACK',
      progressLabel: `Baisse d’impôt adoptée (≥ ${String(minCutAmount)} Md€/an)`,
      progressFraction: 1,
    }
  }
  if (currentTurn >= deadlineTurn) return { status: 'BROKEN', progressLabel: 'Aucune baisse d’impôt suffisante adoptée', progressFraction: 0 }
  return { status: 'AT_RISK', progressLabel: `Pas encore adoptée — ${String(minCutAmount)} Md€/an attendus`, progressFraction: 0 }
}

/**
 * M6 §48: "ne pas augmenter les impôts" is a RATCHET, not a live threshold —
 * any adopted increase in household/business/consumption/social-contribution
 * taxation relative to the campaign-start baseline breaks it PERMANENTLY,
 * even if later reversed (the brief's own example: raised then cut back
 * down still counts as broken, because the promise means "no increase
 * during the mandate", not "no increase right now").
 */
export function evaluateNoTaxIncrease(params: {
  currentTurn: number
  deadlineTurn: number
  policyHistory: readonly PolicyHistoryEntry[]
}): PromiseEvaluation {
  const { currentTurn, deadlineTurn, policyHistory } = params
  const everIncreased = policyHistory.some((e) => e.category === 'taxation' && (e.amount ?? 0) > 0)

  if (currentTurn === 0) return { status: 'NOT_STARTED', progressLabel: 'Aucune hausse d’impôt pour l’instant', progressFraction: 1 }
  if (everIncreased) {
    return {
      status: currentTurn >= deadlineTurn ? 'BROKEN' : 'AT_RISK',
      progressLabel: 'Une hausse d’impôt a été adoptée pendant le mandat',
      progressFraction: 0,
    }
  }
  return {
    status: currentTurn >= deadlineTurn ? 'KEPT' : 'ON_TRACK',
    progressLabel: 'Aucune hausse d’impôt adoptée à ce jour',
    progressFraction: 1,
  }
}

/**
 * M6 §8, §49: "protéger les retraites" evaluates against the ACTUAL pension
 * policy history — a structural/targeted CUT ever adopted is BROKEN even if
 * a later budget also raised pensions (the promise is about not cutting,
 * not about the net); protected/increased-only through the deadline is
 * KEPT. Never inferred from total social spending (§49's explicit warning
 * — solidarity spending is a separate block and never touches this).
 */
export function evaluatePensionProtection(params: {
  currentTurn: number
  deadlineTurn: number
  policyHistory: readonly PolicyHistoryEntry[]
}): PromiseEvaluation {
  const { currentTurn, deadlineTurn, policyHistory } = params
  const everCut = policyHistory.some((e) => e.category === 'pensions' && (e.amount ?? 0) < 0)

  if (currentTurn === 0) return { status: 'NOT_STARTED', progressLabel: 'Aucune réduction des retraites pour l’instant', progressFraction: 1 }
  if (everCut) {
    return {
      status: currentTurn >= deadlineTurn ? 'BROKEN' : 'AT_RISK',
      progressLabel: 'Une réduction des dépenses de retraite a été adoptée pendant le mandat',
      progressFraction: 0,
    }
  }
  return {
    status: currentTurn >= deadlineTurn ? 'KEPT' : 'ON_TRACK',
    progressLabel: 'Aucune réduction des dépenses de retraite adoptée à ce jour',
    progressFraction: 1,
  }
}

/**
 * M6 §50: "restaurer les services publics" against the real composite
 * service index (health/education/security/administration, see
 * `finance/serviceIndices.ts`) instead of the old health/education
 * policyHistory proxy. Thresholds are documented gameplay placeholders —
 * KEPT at +3 index points or more above the campaign-start baseline (100),
 * PARTIAL between -3 and +3, BROKEN below -3.
 */
export function evaluateServiceIndexCommitment(params: {
  currentTurn: number
  deadlineTurn: number
  compositeIndex: number
}): PromiseEvaluation {
  const { currentTurn, deadlineTurn, compositeIndex } = params
  const delta = compositeIndex - 100

  if (currentTurn === 0) return { status: 'NOT_STARTED', progressLabel: 'Indice composite des services publics : 100,0', progressFraction: 0.5 }
  const progressFraction = Math.max(0, Math.min(1, (delta + 3) / 6))
  if (currentTurn >= deadlineTurn) {
    const status = delta >= 3 ? 'KEPT' : delta <= -3 ? 'BROKEN' : 'PARTIAL'
    return { status, progressLabel: `Indice composite des services publics : ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pt`, progressFraction }
  }
  return {
    status: delta >= 0 ? 'ON_TRACK' : 'AT_RISK',
    progressLabel: `Indice composite des services publics : ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pt`,
    progressFraction,
  }
}
