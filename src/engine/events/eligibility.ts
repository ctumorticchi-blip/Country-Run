import { evaluateCondition } from '../conditions/evaluate.ts'
import type { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { GameState } from '../state/gameState.ts'
import type { GameEvent } from './types.ts'

/** True when the event's `requires` condition holds (or it has none). */
export function isEventEligible(event: GameEvent, state: GameState): boolean {
  return event.requires === undefined || evaluateCondition(event.requires, state)
}

/**
 * Rolls whether an eligible event actually triggers this turn, using its
 * `probability` (defaults to 1, i.e. always, when absent). Does not check
 * eligibility itself — call `isEventEligible` first.
 */
export function rollEventTrigger(event: GameEvent, rng: SeededRng): boolean {
  return rng.chance(event.probability ?? 1)
}
