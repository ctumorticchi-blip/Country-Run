import { getValueAtPath } from '../../shared/utils/path.ts'
import type { GameState } from '../state/gameState.ts'
import type { Condition } from './types.ts'

/** Evaluates a (possibly composite) Condition against a GameState. */
export function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    case 'eq':
      return getValueAtPath(state, condition.path) === condition.value
    case 'neq':
      return getValueAtPath(state, condition.path) !== condition.value
    case 'gt':
      return asNumber(getValueAtPath(state, condition.path)) > condition.value
    case 'gte':
      return asNumber(getValueAtPath(state, condition.path)) >= condition.value
    case 'lt':
      return asNumber(getValueAtPath(state, condition.path)) < condition.value
    case 'lte':
      return asNumber(getValueAtPath(state, condition.path)) <= condition.value
    case 'hasPolicy':
      return state.policy.activePolicies.includes(condition.policyId)
    case 'and':
      return condition.conditions.every((child) => evaluateCondition(child, state))
    case 'or':
      return condition.conditions.some((child) => evaluateCondition(child, state))
    case 'not':
      return !evaluateCondition(condition.condition, state)
  }
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : NaN
}
