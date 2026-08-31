import type { GameState, Turn } from '../state/gameState.ts'
import { applyEffect } from './apply.ts'
import type { Effect } from './types.ts'

/**
 * An Effect registered now but applied at a later turn — e.g. "a reform
 * voted at turn 4 affects productivity at turn 10" (Product Bible §6,
 * "Temporalité des effets").
 */
export interface DelayedEffect {
  id: string
  effect: Effect
  /** The turn at which this effect should be applied. */
  executeAtTurn: Turn
  /** Optional origin reference (e.g. the decision or event that scheduled it). */
  sourceId?: string
}

/** Registers a DelayedEffect on the state's queue, without mutating it. */
export function scheduleDelayedEffect(state: GameState, delayedEffect: DelayedEffect): GameState {
  return { ...state, delayedEffects: [...state.delayedEffects, delayedEffect] }
}

/**
 * Applies every DelayedEffect whose `executeAtTurn` has been reached
 * (`executeAtTurn <= state.meta.turn`), removing them from the queue.
 * Effects that are not yet due are left untouched in the queue.
 */
export function resolveDueDelayedEffects(state: GameState): GameState {
  const due = state.delayedEffects.filter((entry) => entry.executeAtTurn <= state.meta.turn)
  const pending = state.delayedEffects.filter((entry) => entry.executeAtTurn > state.meta.turn)

  if (due.length === 0) return state

  const resolvedState = due.reduce((current, entry) => applyEffect(current, entry.effect), state)
  return { ...resolvedState, delayedEffects: pending }
}
