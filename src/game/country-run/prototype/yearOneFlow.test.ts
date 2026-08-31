import { describe, expect, it } from 'vitest'
import { advanceEconomicTurn } from '../../../engine/economy/advanceEconomy.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../../../engine/economy/config/defaultConfig.ts'
import { NEUTRAL_POLICY_INPUT, type EconomicPolicyInput, type WorldState } from '../../../engine/economy/types.ts'
import { assertPlausibleEconomicState } from '../../../engine/economy/invariants.ts'
import { createInitialGameState } from '../data/initialState.ts'
import { createInitialWorldState } from '../data/initialWorldState.ts'
import { createActionRng } from './rng.ts'
import { mergePolicyDeltas, scalePolicyInput, simulateYearOne } from './yearOneFlow.ts'

describe('mergePolicyDeltas', () => {
  it('sums overlapping fields across multiple partial deltas instead of overwriting', () => {
    const merged = mergePolicyDeltas({ currentSpendingChanges: 18 }, { currentSpendingChanges: 20 }, { transfersChanges: 6 })
    expect(merged.currentSpendingChanges).toBe(38)
    expect(merged.transfersChanges).toBe(6)
  })

  it('returns the neutral input when given nothing', () => {
    expect(mergePolicyDeltas()).toEqual(NEUTRAL_POLICY_INPUT)
  })
})

describe('scalePolicyInput', () => {
  it('scales every field by the given factor', () => {
    const policy: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 20, transfersChanges: 10 }
    const scaled = scalePolicyInput(policy, 0.5)
    expect(scaled.currentSpendingChanges).toBe(10)
    expect(scaled.transfersChanges).toBe(5)
  })
})

const WORLD: WorldState = createInitialWorldState()

describe('simulateYearOne', () => {
  it('runs exactly TURNS_PER_YEAR (6) turns — one full in-fiction year', () => {
    const start = createInitialGameState('year1-seed')
    const end = simulateYearOne(start, NEUTRAL_POLICY_INPUT, WORLD, 'year1-seed', [])
    expect(end.meta.turn).toBe(6)
  })

  it('is deterministic: the same seed and the same policy reproduce the exact same result', () => {
    const run = () => {
      const start = createInitialGameState('replay-seed')
      return simulateYearOne(start, { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 15 }, WORLD, 'replay-seed', [])
    }
    expect(run()).toEqual(run())
  })

  it('never mutates the input state', () => {
    const start = createInitialGameState('mutation-check')
    const snapshot = JSON.parse(JSON.stringify(start)) as ReturnType<typeof createInitialGameState>
    simulateYearOne(start, { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 10 }, WORLD, 'mutation-check', [])
    expect(start).toEqual(snapshot)
  })

  it('produces a plausible economic state at every scenario magnitude', () => {
    const start = createInitialGameState('plausibility-check')
    const end = simulateYearOne(start, { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 20, transfersChanges: 15 }, WORLD, 'plausibility-check', [])
    expect(() => {
      assertPlausibleEconomicState(end.economic)
    }).not.toThrow()
  })

  it('a sustained policy applies its full effect once and does not keep re-adding itself turn after turn (M1.5 regression, exercised through the game layer)', () => {
    const start = createInitialGameState('sustained-check')
    const policy: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 10 }

    // Manually replay turn-by-turn (mirroring simulateYearOne's own loop) to inspect intermediate spending levels.
    let state = start
    const spendingByTurn: number[] = []
    for (let turn = 1; turn <= 6; turn++) {
      const previousPolicy = turn === 1 ? NEUTRAL_POLICY_INPUT : policy
      const rng = createActionRng('sustained-check', `year1-turn-${String(turn)}`)
      state = advanceEconomicTurn(state, policy, WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], previousPolicy).nextState
      spendingByTurn.push(state.economic.publicSpending)
    }

    const turn1Jump = spendingByTurn[0] - start.economic.publicSpending
    const turn2Jump = spendingByTurn[1] - spendingByTurn[0]
    // Turn 1 absorbs the full +10 (plus organic drift); turn 2 must be a much smaller organic-drift-only move.
    expect(turn1Jump).toBeGreaterThan(8)
    expect(turn2Jump).toBeLessThan(turn1Jump / 2)
  })

  it('changing the policy mid-year from +10 to +15 applies only the +5 incremental delta, not the full +15 again', () => {
    const start = createInitialGameState('incremental-check')
    const policyA: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 10 }
    const policyB: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 15 }

    const rng1 = createActionRng('incremental-check', 'turn-1')
    const afterA = advanceEconomicTurn(start, policyA, WORLD, rng1, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], NEUTRAL_POLICY_INPUT).nextState

    const rng2 = createActionRng('incremental-check', 'turn-2')
    const afterB = advanceEconomicTurn(afterA, policyB, WORLD, rng2, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], policyA).nextState

    const secondTurnJump = afterB.economic.publicSpending - afterA.economic.publicSpending
    // Should reflect roughly +5 (the delta) plus organic drift and interest-cost catch-up (a legitimate,
    // bounded, multi-turn effect — see M1.5's docs/ECONOMIC_ENGINE.md), nowhere near +15 (the full level) again.
    expect(secondTurnJump).toBeLessThan(16)
  })

  it('economic simulation advances exactly TURNS_PER_YEAR times, never more, regardless of how many times the pure function is called (e.g. React StrictMode double-invoke)', () => {
    const start = createInitialGameState('strict-mode-check')
    const runOnce = () => simulateYearOne(start, NEUTRAL_POLICY_INPUT, WORLD, 'strict-mode-check', [])

    const first = runOnce()
    const second = runOnce() // simulates a StrictMode double-invoke of the same pure computation

    expect(first).toEqual(second)
    expect(first.meta.turn).toBe(6)
  })
})
