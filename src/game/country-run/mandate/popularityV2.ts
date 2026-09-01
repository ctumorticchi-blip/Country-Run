import { applyPopularityDelta, clampPopularity } from '../prototype/popularity.ts'

/**
 * M5 §18-19: mandate-wide popularity model succeeding M2's isolated
 * per-decision nudges (`prototype/popularity.ts`'s header documents that
 * those were removed — only the generic `clampPopularity`/
 * `applyPopularityDelta` primitives survive, reused here). Every input
 * below is a SIGNED DELTA the caller (the turn controller,
 * `mandate/turnController.ts`) has already computed from one specific real
 * cause — this module's job is combining them with small, per-source caps
 * so no single input can swing popularity wildly, then applying ONE
 * clamped delta per turn. On a quiet turn (no bill vote, no event, no
 * promise deadline) the total should land close to the brief's ±2; a bill
 * vote or an event choice with a real `popularityEffect` is what pushes a
 * turn further.
 */
export interface PopularityTurnInputs {
  /** From `mandate/economicSentiment.ts` — recent-trend-weighted, already scaled to a small popularity delta. */
  economicTrendDelta?: number
  /** Sum of any promise resolutions finalized this turn (see `popularityDeltaFromPromiseResolution`). */
  promiseResolutionDelta?: number
  /** A resolved bill vote's own popularity effect this turn (0 on a turn with no vote); see `popularityDeltaFromBillOutcome`. */
  billOutcomeDelta?: number
  /** An event choice's `popularityEffect`, if an event fired and was resolved this turn. */
  eventChoiceDelta?: number
}

const MAX_ECONOMIC_TREND_DELTA = 2
const MAX_PROMISE_RESOLUTION_DELTA = 3
const MAX_BILL_OUTCOME_DELTA = 4
const MAX_EVENT_CHOICE_DELTA = 8

function cap(value: number, max: number): number {
  return Math.min(max, Math.max(-max, value))
}

/** The single combined, bounded delta for one turn — always what actually gets applied, never the raw uncapped inputs. */
export function computePopularityTurnDelta(inputs: PopularityTurnInputs): number {
  const economicTrend = cap(inputs.economicTrendDelta ?? 0, MAX_ECONOMIC_TREND_DELTA)
  const promiseResolution = cap(inputs.promiseResolutionDelta ?? 0, MAX_PROMISE_RESOLUTION_DELTA)
  const billOutcome = cap(inputs.billOutcomeDelta ?? 0, MAX_BILL_OUTCOME_DELTA)
  const eventChoice = cap(inputs.eventChoiceDelta ?? 0, MAX_EVENT_CHOICE_DELTA)
  return Math.round(economicTrend + promiseResolution + billOutcome + eventChoice)
}

export function applyPopularityTurn(current: number, inputs: PopularityTurnInputs): number {
  return applyPopularityDelta(current, computePopularityTurnDelta(inputs))
}

const PROMISE_DIFFICULTY_WEIGHT: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = { LOW: 1, MEDIUM: 1.5, HIGH: 2 }

/** KEPT lifts (more for a harder promise), BROKEN hurts more (also more for a harder promise — it was a bigger ask), PARTIAL is a wash. */
export function popularityDeltaFromPromiseResolution(
  finalStatus: 'KEPT' | 'PARTIAL' | 'BROKEN',
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH',
): number {
  const weight = PROMISE_DIFFICULTY_WEIGHT[difficulty]
  if (finalStatus === 'KEPT') return Math.round(1 * weight)
  if (finalStatus === 'PARTIAL') return 0
  return -Math.round(1.5 * weight)
}

/** A resolved bill's own popularity effect — modest, since most of a bill's political weight lands on political capital/tension, not directly on popularity. */
export function popularityDeltaFromBillOutcome(passed: boolean, controversy: number): number {
  if (passed) return Math.round(1 + controversy * 1)
  return -Math.round(1 + controversy * 3)
}

export { clampPopularity }
