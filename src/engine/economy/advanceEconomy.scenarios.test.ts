import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import type { GameState } from '../state/gameState.ts'
import { advanceEconomicTurn } from './advanceEconomy.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { assertPlausibleEconomicState } from './invariants.ts'
import { NEUTRAL_POLICY_INPUT, type EconomicPolicyInput, type WorldState } from './types.ts'

/**
 * DEV/TEST SCENARIO TOOL (M1 brief §19) — not a UI. Runs the Economic
 * Engine standalone, independent of React, over a full 5-year mandate (30
 * turns) under three policy stances, and checks the resulting trajectories
 * are both plausible (no invariant violations at any turn) and distinct
 * from one another (the whole point of a policy layer). Run with
 * `npm run test:scenarios` to see the year-by-year table on stdout.
 */

function makeInitialGameState(): GameState {
  return {
    meta: { seed: 'scenario-comparison', turn: 0, year: 2027, month: 1, phase: 'in_progress' },
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
  }
}

const NEUTRAL_WORLD: WorldState = {
  eurozoneGrowth: 1.2,
  ecbRate: 3.0,
  oilPriceIndex: 100,
  globalTradeGrowth: 2.0,
  externalInflation: 2.0,
}

/** Scenario A — neutral policy: no discretionary fiscal moves at all. */
const SCENARIO_A_NEUTRAL: EconomicPolicyInput = NEUTRAL_POLICY_INPUT

/** Scenario B — investment-led stimulus: deficit-financed public/structural investment. */
const SCENARIO_B_INVESTMENT_LED: EconomicPolicyInput = {
  ...NEUTRAL_POLICY_INPUT,
  publicInvestmentChanges: 20,
  infrastructureInvestment: 15,
  researchInvestment: 8,
  educationInvestment: 5,
  currentSpendingChanges: 5,
}

/** Scenario C — strong fiscal consolidation: spending cuts and tax increases. */
const SCENARIO_C_CONSOLIDATION: EconomicPolicyInput = {
  ...NEUTRAL_POLICY_INPUT,
  currentSpendingChanges: -20,
  transfersChanges: -10,
  taxChanges: 15,
  householdTaxImpulse: 8,
  businessTaxImpulse: 4,
  publicSectorReform: 0.6,
}

interface YearSnapshot {
  year: number
  turn: number
  gdp: number
  growth: number
  unemployment: number
  inflation: number
  debtRatio: number
  deficitRatio: number
  marketConfidence: number
}

function runScenario(policyInput: EconomicPolicyInput, turns: number, label: string): YearSnapshot[] {
  let state = makeInitialGameState()
  const rng = new SeededRng(`scenario-${label}`)
  const snapshots: YearSnapshot[] = []

  for (let i = 1; i <= turns; i++) {
    state = advanceEconomicTurn(state, policyInput, NEUTRAL_WORLD, rng, DEFAULT_ECONOMIC_ENGINE_CONFIG).nextState
    assertPlausibleEconomicState(state.economic) // fails fast on any engine bug, at every single turn

    if (i % 6 === 0) {
      snapshots.push({
        year: state.meta.year,
        turn: state.meta.turn,
        gdp: Number(state.economic.gdp.toFixed(1)),
        growth: Number(state.economic.growth.toFixed(2)),
        unemployment: Number(state.economic.unemployment.toFixed(2)),
        inflation: Number(state.economic.inflation.toFixed(2)),
        debtRatio: Number(state.economic.debtRatio.toFixed(1)),
        deficitRatio: Number(state.economic.deficitRatio.toFixed(2)),
        marketConfidence: Number(state.economic.marketConfidence.toFixed(1)),
      })
    }
  }

  return snapshots
}

describe('economic engine scenario comparison (5-year mandate, 30 turns)', () => {
  const oneYear = runScenario(SCENARIO_A_NEUTRAL, 6, 'A-neutral-1y')
  const neutral = runScenario(SCENARIO_A_NEUTRAL, 30, 'A-neutral-5y')
  const investmentLed = runScenario(SCENARIO_B_INVESTMENT_LED, 30, 'B-investment-5y')
  const consolidation = runScenario(SCENARIO_C_CONSOLIDATION, 30, 'C-consolidation-5y')

  it('1-year run reaches exactly turn 6 / year 2028 and stays plausible throughout', () => {
    expect(oneYear).toHaveLength(1)
    expect(oneYear[0]?.turn).toBe(6)
    expect(oneYear[0]?.year).toBe(2028)
  })

  it('5-year runs reach exactly turn 30 / year 2032', () => {
    expect(neutral.at(-1)?.turn).toBe(30)
    expect(neutral.at(-1)?.year).toBe(2032)
  })

  it('investment-led stimulus produces higher debt than the neutral scenario by year 5', () => {
    expect(investmentLed.at(-1)?.debtRatio).toBeGreaterThan(neutral.at(-1)?.debtRatio ?? 0)
  })

  it('consolidation produces a lower deficit ratio than the neutral scenario by year 5', () => {
    expect(consolidation.at(-1)?.deficitRatio).toBeLessThan(neutral.at(-1)?.deficitRatio ?? 100)
  })

  it('the three scenarios are clearly distinct trajectories, not near-identical noise', () => {
    const finalGdps = [neutral.at(-1)?.gdp, investmentLed.at(-1)?.gdp, consolidation.at(-1)?.gdp]
    const finalDebtRatios = [neutral.at(-1)?.debtRatio, investmentLed.at(-1)?.debtRatio, consolidation.at(-1)?.debtRatio]

    expect(new Set(finalGdps).size).toBe(3)
    expect(new Set(finalDebtRatios).size).toBe(3)

    // Spread should be a real gameplay-visible difference, not a rounding artifact.
    const debtRatioSpread = Math.max(...finalDebtRatios.map((v) => v ?? 0)) - Math.min(...finalDebtRatios.map((v) => v ?? 0))
    expect(debtRatioSpread).toBeGreaterThan(2)
  })

  it('prints a year-by-year comparison table for manual inspection', () => {
    console.log('\n--- Scenario A: neutral policy ---')
    console.table(neutral)
    console.log('\n--- Scenario B: investment-led stimulus ---')
    console.table(investmentLed)
    console.log('\n--- Scenario C: fiscal consolidation ---')
    console.table(consolidation)

    expect(neutral.length).toBe(5)
  })
})
