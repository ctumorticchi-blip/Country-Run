import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { computePurchasingPower, type ComputePurchasingPowerInput } from './purchasingPower.ts'

function baseInput(overrides?: Partial<ComputePurchasingPowerInput>): ComputePurchasingPowerInput {
  return {
    purchasingPowerPrev: 0,
    nominalIncomeGrowth: 3.2,
    inflation: 2.0,
    gdp: 2800,
    transfersChanges: 0,
    householdTaxImpulse: 0,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.purchasingPower,
    ...overrides,
  }
}

describe('computePurchasingPower', () => {
  it('rises when nominal income growth outpaces inflation', () => {
    const next = computePurchasingPower(baseInput({ nominalIncomeGrowth: 4, inflation: 2 }))
    expect(next).toBeGreaterThan(0)
  })

  it('falls when inflation outpaces nominal income growth', () => {
    const next = computePurchasingPower(baseInput({ nominalIncomeGrowth: 1, inflation: 4 }))
    expect(next).toBeLessThan(0)
  })

  it('is a cumulative index: turn N+1 builds on turn N, it does not reset', () => {
    const afterTurn1 = computePurchasingPower(baseInput({ purchasingPowerPrev: 0 }))
    const afterTurn2 = computePurchasingPower(baseInput({ purchasingPowerPrev: afterTurn1 }))
    expect(afterTurn2).toBeGreaterThan(afterTurn1)
  })

  it('higher transfers improve purchasing power', () => {
    const baseline = computePurchasingPower(baseInput())
    const withTransfers = computePurchasingPower(baseInput({ transfersChanges: 20 }))
    expect(withTransfers).toBeGreaterThan(baseline)
  })

  it('a household tax increase reduces purchasing power', () => {
    const baseline = computePurchasingPower(baseInput())
    const taxed = computePurchasingPower(baseInput({ householdTaxImpulse: 20 }))
    expect(taxed).toBeLessThan(baseline)
  })

  it('does not apply the full annual real income growth rate in one turn', () => {
    const next = computePurchasingPower(baseInput({ nominalIncomeGrowth: 8, inflation: 2 }))
    // Annual real growth here is 6pp; a full-year application would add 6 points, one turn should add close to 1.
    expect(next).toBeLessThan(2)
    expect(next).toBeGreaterThan(0)
  })
})
