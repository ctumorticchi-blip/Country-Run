import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import { TURNS_PER_YEAR } from '../state/calendar.ts'
import type { GameState } from '../state/gameState.ts'
import { advanceEconomicTurn } from './advanceEconomy.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { assertPlausibleEconomicState } from './invariants.ts'
import { NEUTRAL_POLICY_INPUT, type EconomicPolicyInput, type WorldState } from './types.ts'

/**
 * DEV/TEST SCENARIO TOOL (M1 brief §19, recalibrated at M1.5) — not a UI.
 * Runs the Economic Engine standalone, independent of React, over a full
 * 5-year mandate (30 turns) under three SUSTAINED policy stances (the same
 * `EconomicPolicyInput` held constant turn after turn — see types.ts,
 * "Policy input units"), and checks the resulting trajectories are both
 * plausible (no invariant violations at any turn, no catastrophic
 * magnitudes) and distinct from one another. Run with `npm run
 * test:scenarios` to see the year-by-year tables — including each
 * scenario's difference vs neutral — on stdout.
 */

function makeInitialGameState(): GameState {
  return {
    meta: { seed: 'scenario-comparison', turn: 0, year: 2027, month: 1, phase: 'in_progress' },
    economic: {
      gdp: 2800,
      nominalGdp: 2800,
      potentialGrowth: 0.9,
      growth: 0.9,
      inflation: 1.7,
      unemployment: 8.1,
      structuralUnemployment: 8.1,
      publicRevenue: 1372,
      publicSpending: 1512,
      fiscalBalance: -140,
      deficit: 140,
      deficitRatio: 5.0,
      debt: 3360,
      debtRatio: 120.0,
      effectiveDebtRate: 3.0,
      interestCost: 100.8,
      purchasingPower: 0,
      productivityGrowth: 0.83,
      consumerConfidence: 50,
      businessConfidence: 50,
      marketConfidence: 50,
      publicSectorEfficiency: 55,
    },
    political: { popularity: 50, parliamentSeats: 289, politicalCredibility: 60 },
    social: { socialTension: 30 },
    policy: { activePolicies: [] },
    delayedEffects: [],
  }
}

const NEUTRAL_WORLD: WorldState = {
  eurozoneGrowth: 1.2,
  ecbRate: 3.0,
  oilPriceIndex: 100,
  globalTradeGrowth: 2.0,
  externalInflation: 1.7,
}

/** Scenario A — neutral policy: no discretionary fiscal moves at all. */
const SCENARIO_A_NEUTRAL: EconomicPolicyInput = NEUTRAL_POLICY_INPUT

/**
 * Scenario B — sustained, strong investment-led stimulus: a permanently
 * higher public/structural investment budget, deficit-financed. Passed
 * unchanged every turn — the engine's policy-delta discipline (see
 * types.ts) means this applies its full effect once, at turn 1, and then
 * holds as a steady elevated spending level, not a repeated fresh action.
 */
const SCENARIO_B_INVESTMENT_LED: EconomicPolicyInput = {
  ...NEUTRAL_POLICY_INPUT,
  publicInvestmentChanges: 12,
  infrastructureInvestment: 10,
  researchInvestment: 6,
  educationInvestment: 4,
  currentSpendingChanges: 3,
}

/** Scenario C — sustained, strong fiscal consolidation: spending cuts and tax increases, held in place. */
const SCENARIO_C_CONSOLIDATION: EconomicPolicyInput = {
  ...NEUTRAL_POLICY_INPUT,
  currentSpendingChanges: -12,
  transfersChanges: -6,
  taxChanges: 10,
  householdTaxImpulse: 5,
  businessTaxImpulse: 3,
  publicSectorReform: 0.6,
}

interface YearSnapshot {
  year: number
  turn: number
  gdp: number
  growth: number
  unemployment: number
  inflation: number
  publicRevenue: number
  publicSpending: number
  deficit: number
  deficitRatio: number
  debt: number
  debtRatio: number
  interestCost: number
  marketConfidence: number
  productivityGrowth: number
}

function snapshotOf(state: GameState): YearSnapshot {
  const e = state.economic
  const round = (value: number) => Number(value.toFixed(2))
  return {
    year: state.meta.year,
    turn: state.meta.turn,
    gdp: round(e.gdp),
    growth: round(e.growth),
    unemployment: round(e.unemployment),
    inflation: round(e.inflation),
    publicRevenue: round(e.publicRevenue),
    publicSpending: round(e.publicSpending),
    deficit: round(e.deficit),
    deficitRatio: round(e.deficitRatio),
    debt: round(e.debt),
    debtRatio: round(e.debtRatio),
    interestCost: round(e.interestCost),
    marketConfidence: round(e.marketConfidence),
    productivityGrowth: round(e.productivityGrowth),
  }
}

/** Runs a SUSTAINED policy stance for `turns` turns, snapshotting at year 0 and every year after. */
function runScenario(policyInput: EconomicPolicyInput, turns: number, label: string): YearSnapshot[] {
  let state = makeInitialGameState()
  const rng = new SeededRng(`scenario-${label}`)
  let previousPolicyInput = NEUTRAL_POLICY_INPUT
  const snapshots: YearSnapshot[] = [snapshotOf(state)]

  for (let i = 1; i <= turns; i++) {
    state = advanceEconomicTurn(state, policyInput, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], previousPolicyInput).nextState
    previousPolicyInput = policyInput
    assertPlausibleEconomicState(state.economic) // fails fast on any engine bug, at every single turn

    if (i % TURNS_PER_YEAR === 0) {
      snapshots.push(snapshotOf(state))
    }
  }

  return snapshots
}

/** Also runs turn-by-turn (not just yearly snapshots) — used to check per-turn movement, not just year-end levels. */
function runScenarioAllTurns(policyInput: EconomicPolicyInput, turns: number, label: string): GameState[] {
  let state = makeInitialGameState()
  const rng = new SeededRng(`scenario-allturns-${label}`)
  let previousPolicyInput = NEUTRAL_POLICY_INPUT
  const states: GameState[] = [state]

  for (let i = 1; i <= turns; i++) {
    state = advanceEconomicTurn(state, policyInput, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG, [], previousPolicyInput).nextState
    previousPolicyInput = policyInput
    states.push(state)
  }

  return states
}

function diffVsNeutral(scenario: YearSnapshot[], neutral: YearSnapshot[]): Record<string, number>[] {
  return scenario.map((snapshot, i) => {
    const base = neutral[i]
    return {
      year: snapshot.year,
      gdp: Number((snapshot.gdp - base.gdp).toFixed(2)),
      growth: Number((snapshot.growth - base.growth).toFixed(2)),
      unemployment: Number((snapshot.unemployment - base.unemployment).toFixed(2)),
      deficitRatio: Number((snapshot.deficitRatio - base.deficitRatio).toFixed(2)),
      debtRatio: Number((snapshot.debtRatio - base.debtRatio).toFixed(2)),
      marketConfidence: Number((snapshot.marketConfidence - base.marketConfidence).toFixed(2)),
    }
  })
}

const oneYear = runScenario(SCENARIO_A_NEUTRAL, TURNS_PER_YEAR, 'A-neutral-1y')
const neutral = runScenario(SCENARIO_A_NEUTRAL, 30, 'A-neutral-5y')
const investmentLed = runScenario(SCENARIO_B_INVESTMENT_LED, 30, 'B-investment-5y')
const consolidation = runScenario(SCENARIO_C_CONSOLIDATION, 30, 'C-consolidation-5y')

describe('economic engine scenario comparison (5-year mandate, 30 turns)', () => {
  it('1-year run reaches exactly turn 6 / year 2028 and stays plausible throughout', () => {
    expect(oneYear.at(-1)?.turn).toBe(6)
    expect(oneYear.at(-1)?.year).toBe(2028)
  })

  it('5-year runs reach exactly turn 30 / year 2032', () => {
    expect(neutral.at(-1)?.turn).toBe(30)
    expect(neutral.at(-1)?.year).toBe(2032)
  })

  it('the three scenarios are clearly distinct trajectories, not near-identical noise', () => {
    const finalGdps = [neutral.at(-1)?.gdp, investmentLed.at(-1)?.gdp, consolidation.at(-1)?.gdp]
    const finalDebtRatios = [neutral.at(-1)?.debtRatio, investmentLed.at(-1)?.debtRatio, consolidation.at(-1)?.debtRatio]

    expect(new Set(finalGdps).size).toBe(3)
    expect(new Set(finalDebtRatios).size).toBe(3)

    const debtRatioSpread = Math.max(...finalDebtRatios.map((v) => v ?? 0)) - Math.min(...finalDebtRatios.map((v) => v ?? 0))
    expect(debtRatioSpread).toBeGreaterThan(2)
  })

  it('prints year-by-year tables (levels and difference vs neutral) for manual inspection', () => {
    console.log('\n--- Scenario A: neutral policy ---')
    console.table(neutral)
    console.log('\n--- Scenario B: investment-led stimulus ---')
    console.table(investmentLed)
    console.log('\n--- Scenario B minus neutral ---')
    console.table(diffVsNeutral(investmentLed, neutral))
    console.log('\n--- Scenario C: fiscal consolidation ---')
    console.table(consolidation)
    console.log('\n--- Scenario C minus neutral ---')
    console.table(diffVsNeutral(consolidation, neutral))

    expect(neutral.length).toBe(6) // year 0..5
  })
})

describe('calibration guardrails — neutral scenario stays "sticky" (M1.5)', () => {
  it('year 1 growth stays roughly 0-2%', () => {
    const year1 = neutral[1]
    expect(year1.growth).toBeGreaterThanOrEqual(0)
    expect(year1.growth).toBeLessThanOrEqual(2)
  })

  it('year 1 deficit ratio stays broadly around 4-6%', () => {
    const year1 = neutral[1]
    expect(year1.deficitRatio).toBeGreaterThanOrEqual(3)
    expect(year1.deficitRatio).toBeLessThanOrEqual(7)
  })

  it('debt ratio does not lurch in year 1 — moves only a few points at most', () => {
    const year0 = neutral[0]
    const year1 = neutral[1]
    expect(Math.abs(year1.debtRatio - year0.debtRatio)).toBeLessThan(6)
  })

  it('by year 5, debt ratio remains in a plausible band (not a collapse, not a runaway explosion)', () => {
    const year5 = neutral.at(-1)
    expect(year5?.debtRatio).toBeGreaterThan(100)
    expect(year5?.debtRatio).toBeLessThan(145)
  })

  it('by year 5, deficit ratio remains in a plausible band', () => {
    const year5 = neutral.at(-1)
    expect(year5?.deficitRatio).toBeGreaterThan(1)
    expect(year5?.deficitRatio).toBeLessThan(9)
  })

  it('by year 5, unemployment stays broadly plausible (~7-9%)', () => {
    const year5 = neutral.at(-1)
    expect(year5?.unemployment).toBeGreaterThan(6)
    expect(year5?.unemployment).toBeLessThan(10)
  })

  it('growth stays in a low-single-digit normal range throughout the mandate', () => {
    for (const snapshot of neutral) {
      expect(snapshot.growth).toBeGreaterThan(-2)
      expect(snapshot.growth).toBeLessThan(4)
    }
  })
})

describe('calibration guardrails — sustained strong investment stimulus (M1.5)', () => {
  it('raises GDP relative to neutral after a sufficient lag (by year 4-5, once structural investment has matured)', () => {
    // Structural productivity effects mature gradually (infrastructure ~turn 9, research ~turn 15 —
    // see productivity.ts); a single early-year snapshot can still be noise-dominated, so this checks
    // the later, post-maturation years where the signal should be clear.
    const year4Diff = (investmentLed[4]?.gdp ?? 0) - (neutral[4]?.gdp ?? 0)
    const year5Diff = (investmentLed[5]?.gdp ?? 0) - (neutral[5]?.gdp ?? 0)
    expect(year4Diff).toBeGreaterThan(0)
    expect(year5Diff).toBeGreaterThan(0)
  })

  it('increases debt ratio relative to neutral by year 5, but not catastrophically', () => {
    const diff = (investmentLed.at(-1)?.debtRatio ?? 0) - (neutral.at(-1)?.debtRatio ?? 0)
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThan(20) // regression guard well below the old (pre-M1.5) +49pp explosion
  })

  it('never produces a deficit ratio above 15% under this defined scenario', () => {
    for (const snapshot of investmentLed) {
      expect(snapshot.deficitRatio).toBeLessThan(15)
    }
  })

  it('initially worsens the deficit relative to neutral', () => {
    const year1Diff = (investmentLed[1]?.deficitRatio ?? 0) - (neutral[1]?.deficitRatio ?? 0)
    expect(year1Diff).toBeGreaterThan(0)
  })
})

describe('calibration guardrails — sustained strong fiscal consolidation (M1.5)', () => {
  it('reduces debt ratio relative to neutral by year 5', () => {
    const diff = (neutral.at(-1)?.debtRatio ?? 0) - (consolidation.at(-1)?.debtRatio ?? 0)
    expect(diff).toBeGreaterThan(0)
  })

  it('cannot reduce debt ratio by more than 30 points over 5 years under this defined scenario', () => {
    const year0 = consolidation[0]
    const year5 = consolidation.at(-1)
    expect(year0.debtRatio - (year5?.debtRatio ?? 0)).toBeLessThan(30)
  })

  it('does not collapse debt to near-zero — stays a plausible sovereign debt level', () => {
    const year5 = consolidation.at(-1)
    expect(year5?.debtRatio).toBeGreaterThan(60)
  })

  it('reduces short-term growth relative to neutral (year 1)', () => {
    const year1Consolidation = consolidation[1]
    const year1Neutral = neutral[1]
    expect(year1Consolidation.gdp).toBeLessThanOrEqual(year1Neutral.gdp)
  })

  it('reduces the deficit ratio relative to neutral', () => {
    expect(consolidation.at(-1)?.deficitRatio).toBeLessThan(neutral.at(-1)?.deficitRatio ?? 100)
  })
})

describe('calibration guardrails — unemployment moves gradually, not in large per-turn jumps (M1.5)', () => {
  it('unemployment never moves by more than 1.5pp in a single 2-month turn, in any scenario', () => {
    for (const [policyInput, label] of [
      [SCENARIO_A_NEUTRAL, 'neutral'],
      [SCENARIO_B_INVESTMENT_LED, 'investment'],
      [SCENARIO_C_CONSOLIDATION, 'consolidation'],
    ] as const) {
      const states = runScenarioAllTurns(policyInput, 30, label)
      for (let i = 1; i < states.length; i++) {
        const prevUnemployment = states[i - 1]?.economic.unemployment ?? 0
        const nextUnemployment = states[i]?.economic.unemployment ?? 0
        expect(Math.abs(nextUnemployment - prevUnemployment)).toBeLessThan(1.5)
      }
    }
  })
})
