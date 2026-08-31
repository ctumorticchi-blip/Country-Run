import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { GameState } from '../state/gameState.ts'
import { advanceEconomicTurn, advanceEconomy } from './advanceEconomy.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { assertPlausibleEconomicState } from './invariants.ts'
import { NEUTRAL_POLICY_INPUT, type EconomicPolicyInput, type WorldState } from './types.ts'

function makeGameState(overrides?: Partial<GameState>): GameState {
  return {
    meta: { seed: 'advance-economy-test', turn: 0, year: 2027, month: 1, phase: 'in_progress' },
    economic: {
      gdp: 2800,
      nominalGdp: 2800,
      potentialGrowth: 1.2,
      growth: 1.1,
      inflation: 2.0,
      unemployment: 7.5,
      structuralUnemployment: 7.0,
      publicRevenue: 1350,
      publicSpending: 1500,
      fiscalBalance: -150,
      deficit: 150,
      deficitRatio: 5.4,
      debt: 3200,
      debtRatio: 114.3,
      effectiveDebtRate: 2.2,
      interestCost: 70,
      purchasingPower: 0,
      productivityGrowth: 0.8,
      consumerConfidence: 50,
      businessConfidence: 50,
      marketConfidence: 55,
      publicSectorEfficiency: 55,
    },
    political: { popularity: 50, parliamentSeats: 289, politicalCredibility: 60 },
    social: { socialTension: 30 },
    policy: { activePolicies: [] },
    delayedEffects: [],
    ...overrides,
  }
}

const NEUTRAL_WORLD: WorldState = {
  eurozoneGrowth: 1.2,
  ecbRate: 3.0,
  oilPriceIndex: 100,
  globalTradeGrowth: 2.0,
  externalInflation: 2.0,
}

describe('advanceEconomy', () => {
  it('is deterministic: same seed + same state + same inputs => same trajectory', () => {
    const run = () => {
      const state = makeGameState()
      const rng = new SeededRng('determinism-check')
      return advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    }

    const a = run()
    const b = run()
    expect(a.nextEconomicState).toEqual(b.nextEconomicState)
    expect(a.diagnostics).toEqual(b.diagnostics)
  })

  it('a different seed produces a different (noise-driven) trajectory', () => {
    const state = makeGameState()
    const a = advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, new SeededRng('seed-a'), DEFAULT_ECONOMIC_ENGINE_CONFIG)
    const b = advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, new SeededRng('seed-b'), DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(a.nextEconomicState.growth).not.toBe(b.nextEconomicState.growth)
  })

  it('never mutates the input state', () => {
    const state = makeGameState()
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState
    advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, new SeededRng('mutation-check'), DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(state).toEqual(snapshot)
  })

  it('a reasonable positive investment impulse raises growth versus a neutral policy', () => {
    const state = makeGameState()
    const rng1 = new SeededRng('policy-check')
    const rng2 = new SeededRng('policy-check')
    const neutral = advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng1, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    const stimulus: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, publicInvestmentChanges: 25, currentSpendingChanges: 15 }
    const stimulated = advanceEconomy(state, stimulus, NEUTRAL_WORLD, rng2, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(stimulated.nextEconomicState.growth).toBeGreaterThan(neutral.nextEconomicState.growth)
  })

  it('produces a full set of diagnostics that explain the result', () => {
    const state = makeGameState()
    const { diagnostics } = advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, new SeededRng('diagnostics-check'), DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(diagnostics.growthContributions).toBeDefined()
    expect(diagnostics.inflationContributions).toBeDefined()
    expect(diagnostics.confidenceContributions).toBeDefined()
    expect(typeof diagnostics.revenueSurprise).toBe('number')
    expect(typeof diagnostics.interestRateChange).toBe('number')
    expect(typeof diagnostics.unemploymentChange).toBe('number')
  })

  it('a single turn never applies a full annual growth rate to GDP', () => {
    const state = makeGameState({
      economic: { ...makeGameState().economic, growth: 12, potentialGrowth: 12, productivityGrowth: 0.8 },
    })
    const { nextEconomicState } = advanceEconomy(
      state,
      NEUTRAL_POLICY_INPUT,
      NEUTRAL_WORLD,
      new SeededRng('annualization-check'),
      { ...DEFAULT_ECONOMIC_ENGINE_CONFIG, growth: { ...DEFAULT_ECONOMIC_ENGINE_CONFIG.growth, noiseStdDev: 0 } },
    )
    // Even with a 12%/year growth rate flowing through, one turn should move GDP by roughly 1/6 of that, not the whole 12%.
    const fullYearGdp = state.economic.gdp * 1.12
    expect(nextEconomicState.gdp).toBeLessThan(fullYearGdp - 100)
  })

  it('produces a plausible economic state after a turn (no NaN, sane bounds)', () => {
    const state = makeGameState()
    const { nextEconomicState } = advanceEconomy(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, new SeededRng('plausibility-check'), DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(() => {
      assertPlausibleEconomicState(nextEconomicState)
    }).not.toThrow()
  })

  it('schedules structural delayed effects but does not apply them the same turn', () => {
    const state = makeGameState()
    const { nextEconomicState, scheduledDelayedEffects } = advanceEconomy(
      state,
      { ...NEUTRAL_POLICY_INPUT, infrastructureInvestment: 20 },
      NEUTRAL_WORLD,
      new SeededRng('delayed-schedule-check'),
      DEFAULT_ECONOMIC_ENGINE_CONFIG,
    )
    expect(scheduledDelayedEffects).toHaveLength(1)
    expect(scheduledDelayedEffects[0]?.executeAtTurn).toBeGreaterThan(state.meta.turn)
    // productivityGrowth this turn only reflects the tiny base drift, not the scheduled investment payoff yet.
    expect(nextEconomicState.productivityGrowth).toBeCloseTo(
      state.economic.productivityGrowth + DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity.baseDriftPerTurn,
    )
  })
})

describe('advanceEconomicTurn', () => {
  it('advances the turn counter, calendar, and economy together', () => {
    const state = makeGameState()
    const { nextState } = advanceEconomicTurn(
      state,
      NEUTRAL_POLICY_INPUT,
      NEUTRAL_WORLD,
      new SeededRng('full-turn-check'),
      DEFAULT_ECONOMIC_ENGINE_CONFIG,
    )
    expect(nextState.meta.turn).toBe(1)
    expect(nextState.meta.month).toBe(3)
    expect(nextState.economic.gdp).not.toBe(state.economic.gdp)
  })

  it('respects the 2-month-per-turn calendar over a full simulated year (6 turns)', () => {
    let state = makeGameState()
    const rng = new SeededRng('year-loop-check')
    for (let i = 0; i < 6; i++) {
      state = advanceEconomicTurn(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG).nextState
    }
    expect(state.meta.turn).toBe(6)
    expect(state.meta.year).toBe(2028)
    expect(state.meta.month).toBe(1)
  })

  it('an infrastructure investment eventually applies its productivity effect at the scheduled turn, and not before', () => {
    let state = makeGameState()
    const rng = new SeededRng('delayed-effect-integration')
    const delayTurns = DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity.infrastructureDelayTurns

    // Turn 1: invest in infrastructure.
    state = advanceEconomicTurn(
      state,
      { ...NEUTRAL_POLICY_INPUT, infrastructureInvestment: 30 },
      NEUTRAL_WORLD,
      rng,
      DEFAULT_ECONOMIC_ENGINE_CONFIG,
    ).nextState
    expect(state.delayedEffects).toHaveLength(1)

    const productivityRightAfterInvestment = state.economic.productivityGrowth

    // Advance turns up to (but not including) the scheduled turn: effect must not be visible yet.
    for (let turn = state.meta.turn; turn < delayTurns; turn++) {
      state = advanceEconomicTurn(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG).nextState
    }
    expect(state.delayedEffects).toHaveLength(1) // still pending
    expect(state.economic.productivityGrowth).toBeCloseTo(productivityRightAfterInvestment, 1)

    // One more turn crosses the scheduled turn: the effect must have matured and left the queue.
    state = advanceEconomicTurn(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG).nextState
    expect(state.delayedEffects).toHaveLength(0)
    expect(state.economic.productivityGrowth).toBeGreaterThan(productivityRightAfterInvestment)
  })

  it('never mutates the input state', () => {
    const state = makeGameState()
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState
    advanceEconomicTurn(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, new SeededRng('turn-mutation-check'), DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(state).toEqual(snapshot)
  })

  it('same seed reproduces an identical multi-turn trajectory', () => {
    const runFiveTurns = () => {
      let state = makeGameState()
      const rng = new SeededRng('replay-trajectory')
      for (let i = 0; i < 5; i++) {
        state = advanceEconomicTurn(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG).nextState
      }
      return state
    }

    expect(runFiveTurns()).toEqual(runFiveTurns())
  })

  // --- M1.5 calibration regression guards -----------------------------------------------
  // These target the exact root-cause bugs found during M1.5 recalibration: policyInput
  // fields are a SUSTAINED level (see types.ts, "Policy input units"), not a fresh action to
  // repeat every turn. Passing the same nonzero policyInput on consecutive turns must not
  // silently 6x it, and must not keep re-adding it forever.

  it('does not amplify a single turn of policy by 6x (annual vs per-turn confusion)', () => {
    const state = makeGameState()
    const policy: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 12 }
    const { nextState } = advanceEconomicTurn(state, policy, NEUTRAL_WORLD, new SeededRng('amplification-check'), DEFAULT_ECONOMIC_ENGINE_CONFIG)

    const spendingDelta = nextState.economic.publicSpending - state.economic.publicSpending
    // A ×6 bug would push this delta up near 12*6=72 (plus organic drift/interest); the correct
    // behavior is close to the policy's own +12 (plus a small amount of baseline drift/interest).
    expect(spendingDelta).toBeGreaterThan(8)
    expect(spendingDelta).toBeLessThan(30)
  })

  it('does not repeatedly re-add a sustained level policy every turn it stays active', () => {
    // Start with effectiveDebtRate already at its steady state (ecbRate + baselineSpread, at
    // neutral confidence) so there's no legitimate multi-turn interest-cost catch-up to conflate
    // with the thing under test — isolating the policy-delta behavior cleanly.
    let state = makeGameState({
      economic: { ...makeGameState().economic, effectiveDebtRate: 3.5, interestCost: 112, publicSpending: 1542 },
    })
    const policy: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 10 }
    const rng = new SeededRng('sustained-policy-check')
    let previousPolicyInput = NEUTRAL_POLICY_INPUT
    const spendingByTurn: number[] = [state.economic.publicSpending]

    for (let i = 0; i < 5; i++) {
      state = advanceEconomicTurn(state, policy, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], previousPolicyInput).nextState
      previousPolicyInput = policy
      spendingByTurn.push(state.economic.publicSpending)
    }

    // Turn 1 absorbs the full +10 policy change; every turn after that, spending should only
    // move by a small amount of organic baseline drift, never another +10.
    for (let i = 2; i < spendingByTurn.length; i++) {
      const turnOverTurnChange = (spendingByTurn[i] ?? 0) - (spendingByTurn[i - 1] ?? 0)
      expect(turnOverTurnChange).toBeLessThan(10)
    }
  })

  it('a sustained structural investment schedules only ONE delayed effect, not one per turn', () => {
    let state = makeGameState()
    const policy: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, infrastructureInvestment: 20 }
    const rng = new SeededRng('sustained-structural-check')
    let previousPolicyInput = NEUTRAL_POLICY_INPUT

    for (let i = 0; i < 4; i++) {
      state = advanceEconomicTurn(state, policy, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], previousPolicyInput).nextState
      previousPolicyInput = policy
    }

    expect(state.delayedEffects).toHaveLength(1)
  })

  it('reversing a sustained policy back to neutral does not leave a residual repeated effect', () => {
    let state = makeGameState()
    const policy: EconomicPolicyInput = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 10 }
    const rng = new SeededRng('policy-reversal-check')

    state = advanceEconomicTurn(state, policy, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG).nextState
    const spendingAfterPolicy = state.economic.publicSpending

    // Reverse the policy: back to neutral, with the policy stance as "previous".
    state = advanceEconomicTurn(state, NEUTRAL_POLICY_INPUT, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], policy).nextState

    // Reversing should pull spending back down toward (not below-by-a-lot, not still-rising-by-10) its pre-policy path.
    expect(state.economic.publicSpending).toBeLessThan(spendingAfterPolicy)
  })
})
