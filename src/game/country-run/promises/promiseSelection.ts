import { getPromiseDefinition } from './promiseCatalog.ts'
import type { PoliticalTag } from './promiseTypes.ts'

/** M3 §3: exactly 5 promises, no more, no fewer. */
export const REQUIRED_PROMISE_COUNT = 5

/**
 * Bercy-style "programme difficile à financer" threshold (M3 §10, "No Free
 * Lunch"). Crossing it never blocks selection — it only surfaces a warning
 * with the actual estimated cost, on `bercyAudit`.
 */
export const FISCAL_WARNING_THRESHOLD_BN = 25

export function isCompleteSelection(selectedPromiseIds: readonly string[]): boolean {
  return selectedPromiseIds.length === REQUIRED_PROMISE_COUNT && new Set(selectedPromiseIds).size === REQUIRED_PROMISE_COUNT
}

/** Sum of each selected promise's own `estimatedAnnualCost` (Md€/year) — the "gross fiscal commitment" shown at the Bercy audit. */
export function totalEstimatedAnnualCost(selectedPromiseIds: readonly string[]): number {
  return selectedPromiseIds.reduce((sum, id) => sum + getPromiseDefinition(id).estimatedAnnualCost, 0)
}

export function isFiscallyDifficult(selectedPromiseIds: readonly string[]): boolean {
  return totalEstimatedAnnualCost(selectedPromiseIds) > FISCAL_WARNING_THRESHOLD_BN
}

/** Tally of how many selected promises carry each political tag. */
export function tallyPoliticalTags(selectedPromiseIds: readonly string[]): Partial<Record<PoliticalTag, number>> {
  const tally: Partial<Record<PoliticalTag, number>> = {}
  for (const id of selectedPromiseIds) {
    for (const tag of getPromiseDefinition(id).politicalTags) {
      tally[tag] = (tally[tag] ?? 0) + 1
    }
  }
  return tally
}

/**
 * How concentrated the selected programme is around a small set of
 * political tags, in [0, 1] — 1 means every tag mention falls under a
 * single dominant tag (a very coherent programme), lower values mean the
 * 5 promises pull in many different directions at once. Reused by both
 * `electionResult.ts` (campaign profile label) and
 * `parliamentComposition.ts` (coalition seat bonus) — a single shared
 * definition of "coherence" rather than two divergent ones.
 */
export function coherenceScore(selectedPromiseIds: readonly string[]): number {
  const tally = tallyPoliticalTags(selectedPromiseIds)
  const counts = Object.values(tally)
  const totalMentions = counts.reduce((sum: number, count) => sum + count, 0)
  if (totalMentions === 0) return 0
  const maxCount = Math.max(...counts)
  return maxCount / totalMentions
}

/** The 1-2 tags with the most mentions in the selection — used for the campaign's descriptive profile label. */
export function dominantTags(selectedPromiseIds: readonly string[], limit = 2): PoliticalTag[] {
  const tally = tallyPoliticalTags(selectedPromiseIds)
  return (Object.entries(tally) as [PoliticalTag, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag)
}
