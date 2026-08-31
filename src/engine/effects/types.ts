import type { StatePath } from '../../shared/types/path.ts'

/** Overwrites the value at `path` with `value`. */
interface SetEffect {
  type: 'set'
  path: StatePath
  value: number | string | boolean
}

/**
 * Adds `value` to the numeric value at `path`, optionally clamped to
 * [min, max] when those bounds are defined.
 */
interface AddEffect {
  type: 'add'
  path: StatePath
  value: number
  min?: number
  max?: number
}

/**
 * Subtracts `value` from the numeric value at `path`, optionally clamped to
 * [min, max] when those bounds are defined.
 */
interface SubtractEffect {
  type: 'subtract'
  path: StatePath
  value: number
  min?: number
  max?: number
}

/** Adds a policy ID to `policy.activePolicies` (no-op if already present). */
interface AddPolicyEffect {
  type: 'addPolicy'
  policyId: string
}

/** Removes a policy ID from `policy.activePolicies` (no-op if absent). */
interface RemovePolicyEffect {
  type: 'removePolicy'
  policyId: string
}

/**
 * A data-driven, engine-agnostic mutation of a GameState. Effects never
 * mutate in place — applying one returns a new state (see apply.ts).
 */
export type Effect = SetEffect | AddEffect | SubtractEffect | AddPolicyEffect | RemovePolicyEffect
