import { getValueAtPath, setValueAtPath } from '../../shared/utils/path.ts'
import type { GameState } from '../state/gameState.ts'
import type { Effect } from './types.ts'

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let result = value
  if (min !== undefined) result = Math.max(min, result)
  if (max !== undefined) result = Math.min(max, result)
  return result
}

function readNumber(state: GameState, path: string): number {
  const current = getValueAtPath(state, path)
  return typeof current === 'number' ? current : 0
}

/** Applies a single Effect to a GameState, returning a new GameState. */
export function applyEffect(state: GameState, effect: Effect): GameState {
  switch (effect.type) {
    case 'set':
      return setValueAtPath(state, effect.path, effect.value)

    case 'add': {
      const next = clamp(readNumber(state, effect.path) + effect.value, effect.min, effect.max)
      return setValueAtPath(state, effect.path, next)
    }

    case 'subtract': {
      const next = clamp(readNumber(state, effect.path) - effect.value, effect.min, effect.max)
      return setValueAtPath(state, effect.path, next)
    }

    case 'addPolicy': {
      if (state.policy.activePolicies.includes(effect.policyId)) return state
      return {
        ...state,
        policy: { ...state.policy, activePolicies: [...state.policy.activePolicies, effect.policyId] },
      }
    }

    case 'removePolicy': {
      if (!state.policy.activePolicies.includes(effect.policyId)) return state
      return {
        ...state,
        policy: {
          ...state.policy,
          activePolicies: state.policy.activePolicies.filter((id) => id !== effect.policyId),
        },
      }
    }
  }
}

/** Applies a sequence of Effects in order, returning a new GameState. */
export function applyEffects(state: GameState, effects: readonly Effect[]): GameState {
  return effects.reduce(applyEffect, state)
}
