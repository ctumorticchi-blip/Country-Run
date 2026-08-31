import { resolveDueDelayedEffects } from '../effects/delayedEffect.ts'
import type { GameState } from './gameState.ts'

/**
 * One turn = 2 in-fiction months, 6 turns per year (Product Bible §2,
 * "Temps moteur").
 */
const MONTHS_PER_TURN = 2

/** Advances (year, month) forward by one turn's worth of in-fiction time. */
function advanceCalendar(year: number, month: number): { year: number; month: number } {
  const zeroBasedMonth = month - 1 + MONTHS_PER_TURN
  return {
    year: year + Math.floor(zeroBasedMonth / 12),
    month: (zeroBasedMonth % 12) + 1,
  }
}

/**
 * Advances the game by one turn: increments the turn counter, moves the
 * calendar forward, and applies any DelayedEffect whose turn has come due.
 *
 * This is intentionally the entire M0 turn engine — no economic simulation
 * runs here yet (see docs/ARCHITECTURE.md for what M1 adds).
 *
 * Pure: never mutates `state`, always returns a new GameState.
 */
export function advanceTurn(state: GameState): GameState {
  const { year, month } = advanceCalendar(state.meta.year, state.meta.month)

  const advanced: GameState = {
    ...state,
    meta: { ...state.meta, turn: state.meta.turn + 1, year, month },
  }

  return resolveDueDelayedEffects(advanced)
}
