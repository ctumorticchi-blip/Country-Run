/**
 * Generic popularity primitives, shared by `mandate/popularityV2.ts` (the
 * actual mandate-wide model from M5 onward — see docs/MANDATE_M5.md).
 * M2's per-decision nudge functions (`popularityFromBudget`,
 * `popularityFromYearEndOutcomes`, `popularityFromParliamentOutcome`) are
 * superseded by that unified model and have been removed.
 */

/** Clamps popularity to the valid [0, 100] range. */
export function clampPopularity(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function applyPopularityDelta(current: number, delta: number): number {
  return clampPopularity(current + delta)
}
