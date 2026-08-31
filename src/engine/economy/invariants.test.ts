import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { applyEconomicInvariants, assertPlausibleEconomicState } from './invariants.ts'
import type { EconomicState } from '../state/gameState.ts'

function makeEconomicState(overrides?: Partial<EconomicState>): EconomicState {
  return {
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
    ...overrides,
  }
}

describe('applyEconomicInvariants', () => {
  it('leaves an already-plausible state unchanged in value', () => {
    const state = makeEconomicState()
    const next = applyEconomicInvariants(state, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(next).toEqual(state)
  })

  it('floors unemployment and confidence indices without silently absorbing large swings elsewhere', () => {
    const state = makeEconomicState({ unemployment: -3, consumerConfidence: -20, marketConfidence: 140 })
    const next = applyEconomicInvariants(state, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(next.unemployment).toBe(DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment.minUnemployment)
    expect(next.consumerConfidence).toBe(0)
    expect(next.marketConfidence).toBe(100)
  })

  it('floors debt and gdp at their configured minimums', () => {
    const state = makeEconomicState({ debt: -50, gdp: -10 })
    const next = applyEconomicInvariants(state, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(next.debt).toBe(DEFAULT_ECONOMIC_ENGINE_CONFIG.bounds.minDebt)
    expect(next.gdp).toBe(DEFAULT_ECONOMIC_ENGINE_CONFIG.bounds.minGdp)
  })

  it('never mutates the input state', () => {
    const state = makeEconomicState({ unemployment: -3 })
    const snapshot = JSON.parse(JSON.stringify(state)) as EconomicState
    applyEconomicInvariants(state, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(state).toEqual(snapshot)
  })

  it('does NOT clamp deficitRatio or growth — extreme-but-legitimate outcomes stay visible', () => {
    const state = makeEconomicState({ deficitRatio: 45, growth: -12 })
    const next = applyEconomicInvariants(state, DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(next.deficitRatio).toBe(45)
    expect(next.growth).toBe(-12)
  })
})

describe('assertPlausibleEconomicState', () => {
  it('does not throw for a plausible state', () => {
    expect(() => {
      assertPlausibleEconomicState(makeEconomicState())
    }).not.toThrow()
  })

  it('throws when a field is NaN or Infinity (a real engine bug)', () => {
    expect(() => {
      assertPlausibleEconomicState(makeEconomicState({ growth: NaN }))
    }).toThrow(/not finite/)
    expect(() => {
      assertPlausibleEconomicState(makeEconomicState({ inflation: Infinity }))
    }).toThrow(/not finite/)
  })

  it('throws when gdp or debt goes negative', () => {
    expect(() => {
      assertPlausibleEconomicState(makeEconomicState({ gdp: -1 }))
    }).toThrow(/gdp/)
    expect(() => {
      assertPlausibleEconomicState(makeEconomicState({ debt: -1 }))
    }).toThrow(/debt/)
  })

  it('throws when a confidence index escapes [0, 100]', () => {
    expect(() => {
      assertPlausibleEconomicState(makeEconomicState({ businessConfidence: 150 }))
    }).toThrow(/businessConfidence/)
  })
})
