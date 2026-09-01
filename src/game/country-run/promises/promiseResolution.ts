import type { Turn } from '../../../engine/state/gameState.ts'
import type { PromiseDefinition, PromiseEvaluation, PromiseEvaluationContext } from './promiseTypes.ts'

/**
 * M5 §15-16: once a promise's `deadlineTurn` is reached, its status must be
 * FROZEN forever — never re-derived from live economic state again. Without
 * this, a threshold-based promise (e.g. "unemployment under 7%") could flip
 * between KEPT and BROKEN on every later turn as the indicator drifts, which
 * is exactly the oscillation the brief calls out. `PromiseEvaluation.status`
 * stays the live, always-derived M3 runtime read (used before the
 * deadline); `PromiseResolution` is the one piece of genuinely-necessary
 * stored state this system needs — a snapshot taken AT the deadline turn,
 * because the whole point is that it must stop tracking `currentEconomic`
 * afterward.
 */
export interface PromiseResolution {
  promiseId: string
  finalStatus: 'KEPT' | 'PARTIAL' | 'BROKEN'
  resolvedTurn: Turn
  progressLabel: string
}

const PARTIAL_CREDIT_THRESHOLD = 0.5

function classifyFinalStatus(promise: PromiseDefinition, evaluation: PromiseEvaluation): PromiseResolution['finalStatus'] {
  if (evaluation.status === 'KEPT') return 'KEPT'
  // `temporaryEvaluator` promises (M3 §8/§14/§23) have no real lever yet —
  // honest final classification is PARTIAL, never a definitive BROKEN.
  if (promise.temporaryEvaluator || evaluation.progressFraction === undefined) return 'PARTIAL'
  return evaluation.progressFraction >= PARTIAL_CREDIT_THRESHOLD ? 'PARTIAL' : 'BROKEN'
}

/**
 * Called once per turn by the turn controller (M5 §38) for every SELECTED
 * promise not already resolved. A promise whose `deadlineTurn` has not yet
 * been reached is left untouched — its live `evaluate()` read is still what
 * the UI shows. Pure: same inputs always produce the same new resolutions.
 */
export function resolveDuePromises(
  promises: readonly PromiseDefinition[],
  selectedPromiseIds: readonly string[],
  existingResolutions: readonly PromiseResolution[],
  ctx: PromiseEvaluationContext,
): PromiseResolution[] {
  const alreadyResolved = new Set(existingResolutions.map((r) => r.promiseId))
  const newlyResolved: PromiseResolution[] = []

  for (const id of selectedPromiseIds) {
    if (alreadyResolved.has(id)) continue
    const promise = promises.find((p) => p.id === id)
    if (!promise || ctx.currentTurn < promise.deadlineTurn) continue

    const evaluation = promise.evaluate(ctx)
    newlyResolved.push({
      promiseId: id,
      finalStatus: classifyFinalStatus(promise, evaluation),
      resolvedTurn: ctx.currentTurn,
      progressLabel: evaluation.progressLabel,
    })
  }

  return newlyResolved.length === 0 ? [...existingResolutions] : [...existingResolutions, ...newlyResolved]
}

/** What the UI should show for one promise: the frozen resolution once it exists, otherwise a fresh live read. */
export function displayStatusForPromise(
  promise: PromiseDefinition,
  resolutions: readonly PromiseResolution[],
  ctx: PromiseEvaluationContext,
): PromiseEvaluation {
  const resolution = resolutions.find((r) => r.promiseId === promise.id)
  if (!resolution) return promise.evaluate(ctx)
  return { status: resolution.finalStatus, progressLabel: resolution.progressLabel }
}
