import { advanceEconomicTurn } from '../../../engine/economy/advanceEconomy.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../../../engine/economy/config/defaultConfig.ts'
import { NEUTRAL_POLICY_INPUT, type EconomicPolicyInput, type ExternalShock, type WorldState } from '../../../engine/economy/types.ts'
import { TURNS_PER_YEAR } from '../../../engine/state/calendar.ts'
import type { GameState } from '../../../engine/state/gameState.ts'
import { createActionRng } from './rng.ts'

/**
 * Sums any number of partial policy deltas into one complete
 * `EconomicPolicyInput` — several decision points can touch the same
 * field (e.g. the Bercy audit and the health/defense budget categories
 * both feed `currentSpendingChanges`), and they must ADD, never overwrite
 * each other.
 */
export function mergePolicyDeltas(...deltas: Partial<EconomicPolicyInput>[]): EconomicPolicyInput {
  const result: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT }
  for (const delta of deltas) {
    for (const key of Object.keys(delta) as (keyof EconomicPolicyInput)[]) {
      result[key] = result[key] + (delta[key] ?? 0)
    }
  }
  return result
}

/** Scales every field of a policy input by a factor — used for Parliament's "simplified compromise budget" on rejection. */
export function scalePolicyInput(policy: EconomicPolicyInput, scale: number): EconomicPolicyInput {
  const scaled = {} as EconomicPolicyInput
  for (const key of Object.keys(policy) as (keyof EconomicPolicyInput)[]) {
    scaled[key] = policy[key] * scale
  }
  return scaled
}

/**
 * Runs a full in-fiction year (`TURNS_PER_YEAR` turns — 6, i.e. 12 months,
 * see engine/state/calendar.ts) of the real M1.5 engine under a single,
 * SUSTAINED enacted policy. The policy applies its full effect on the
 * first turn (relative to a neutral baseline, since nothing was in effect
 * before Year 1 started) and then holds steady for the rest of the year —
 * exactly the "sustained annualized level" semantics from
 * engine/economy/types.ts, "Policy input units". Any `shocks` are applied
 * only on the first turn (they are one-off events, not a standing world
 * change beyond what the shock itself permanently shifts in WorldState).
 *
 * Each turn derives its own fresh RNG via `createActionRng` (RNG safety —
 * see rng.ts) rather than sharing one mutable instance, so this function
 * is pure and safe to call from a React reducer under `<StrictMode>`.
 */
export function simulateYearOne(
  initialState: GameState,
  policy: EconomicPolicyInput,
  worldState: WorldState,
  seed: string,
  shocks: readonly ExternalShock[],
): GameState {
  let state = initialState

  for (let turn = 1; turn <= TURNS_PER_YEAR; turn++) {
    const previousPolicy = turn === 1 ? NEUTRAL_POLICY_INPUT : policy
    const turnShocks = turn === 1 ? shocks : []
    const rng = createActionRng(seed, `year1-turn-${String(turn)}`)

    state = advanceEconomicTurn(
      state,
      policy,
      worldState,
      rng,
      DEFAULT_ECONOMIC_ENGINE_CONFIG,
      turnShocks,
      previousPolicy,
    ).nextState
  }

  return state
}
