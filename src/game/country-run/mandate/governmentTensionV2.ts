import { clampGovernmentTension } from '../parliament/exceptionalProcedure.ts'
import type { PoliticalDeal } from '../parliament/politicalDeal.ts'

/**
 * M5 §20: government tension made genuinely functional. M4 only ever moved
 * it via the exceptional procedure (`parliament/exceptionalProcedure.ts` —
 * kept exactly as-is, this module ADDS the other sources the brief lists
 * rather than replacing it): rises from a major bill defeat or a broken
 * deal, falls from a successful vote / high popularity / a compromise that
 * actually used concessions to pass. `docs/MANDATE_M5.md` documents that no
 * automatic government collapse exists yet at any tension level — high
 * tension only feeds the `political-crisis` event's `probabilityModifier`
 * in `events/eventCatalog.ts`. "Reshuffle" (remaniement) as a
 * tension-relief lever is a documented placeholder — no such mechanic
 * exists yet in M5.
 */
const HIGH_POPULARITY_RELIEF_THRESHOLD = 60
const LOW_POPULARITY_STRAIN_THRESHOLD = 30
const MAX_COMPROMISE_RELIEF = 4

/** A vote's own effect: passing relieves tension a little (more for a harder-fought win); a defeat raises it more the more controversial the bill was — a "major defeat". */
export function tensionDeltaFromVoteOutcome(passed: boolean, controversy: number): number {
  if (passed) return -Math.round(1 + controversy * 2)
  return Math.round(4 + controversy * 10)
}

/**
 * Deals struck for THIS bill's negotiation that were not honored by the
 * bloc's actual vote (`PoliticalDeal.fulfilled === false` after
 * `markDealFulfilled` runs post-vote) — a real breach of trust, distinct
 * from simply losing the vote. Callers must pass only the deals tied to
 * the bill just resolved, not the whole mandate's deal history, or older
 * already-broken deals would keep adding tension every time this runs.
 */
export function tensionDeltaFromBrokenDeals(dealsForThisBill: readonly PoliticalDeal[]): number {
  const broken = dealsForThisBill.filter((d) => !d.fulfilled).length
  return broken * 5
}

/** Concessions actually used to secure a passing majority read as a real compromise, not just a win — a bit more relief than a clean win. */
export function tensionDeltaFromCompromise(concessionsUsedCount: number, passed: boolean): number {
  if (!passed || concessionsUsedCount === 0) return 0
  return -Math.min(MAX_COMPROMISE_RELIEF, concessionsUsedCount)
}

/** A small year-end drift from how popular/unpopular the mandate currently stands. */
export function tensionDeltaFromPopularity(popularity: number): number {
  if (popularity >= HIGH_POPULARITY_RELIEF_THRESHOLD) return -2
  if (popularity <= LOW_POPULARITY_STRAIN_THRESHOLD) return 2
  return 0
}

export function applyTensionDelta(current: number, delta: number): number {
  return clampGovernmentTension(current + delta)
}

export { clampGovernmentTension }
