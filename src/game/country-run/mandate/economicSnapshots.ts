import type { EconomicState, Turn } from '../../../engine/state/gameState.ts'

/**
 * M5 §65: "compact 30-max turn snapshots, not full state duplication per
 * turn." A curated subset of `EconomicState` — only the indicators the
 * mandate actually trends on (economic sentiment, Economy/History detail
 * views, the 5-year trajectory table) — plus popularity, never the whole
 * nested `GameState` (world/political/social/international state included).
 */
export interface EconomicSnapshot {
  turn: Turn
  growth: number
  unemployment: number
  inflation: number
  deficitRatio: number
  debtRatio: number
  purchasingPower: number
  popularity: number
}

/** The full 30-turn mandate has exactly 30 turns — this cap is a defensive bound, not expected to ever actually trim in normal play. */
export const MAX_SNAPSHOTS = 30

export function snapshotFrom(turn: Turn, economic: EconomicState, popularity: number): EconomicSnapshot {
  return {
    turn,
    growth: economic.growth,
    unemployment: economic.unemployment,
    inflation: economic.inflation,
    deficitRatio: economic.deficitRatio,
    debtRatio: economic.debtRatio,
    purchasingPower: economic.purchasingPower,
    popularity,
  }
}

/** Appends one snapshot, dropping the oldest once past `MAX_SNAPSHOTS`. */
export function recordSnapshot(history: readonly EconomicSnapshot[], snapshot: EconomicSnapshot): EconomicSnapshot[] {
  const next = [...history, snapshot]
  return next.length > MAX_SNAPSHOTS ? next.slice(next.length - MAX_SNAPSHOTS) : next
}
