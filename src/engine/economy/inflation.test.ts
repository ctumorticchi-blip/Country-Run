import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { computeInflation, type ComputeInflationInput } from './inflation.ts'
import type { WorldState } from './types.ts'

const NEUTRAL_WORLD: WorldState = {
  eurozoneGrowth: 0,
  ecbRate: 3,
  oilPriceIndex: 100,
  globalTradeGrowth: 0,
  externalInflation: 2.0,
}

function baseInput(overrides?: Partial<ComputeInflationInput>): ComputeInflationInput {
  return {
    inflationPrev: 2.0,
    growth: 1.2,
    potentialGrowth: 1.2,
    gdp: 2800,
    world: NEUTRAL_WORLD,
    taxImpulse: 0,
    rng: new SeededRng('inflation-test'),
    config: { ...DEFAULT_ECONOMIC_ENGINE_CONFIG.inflation, noiseStdDev: 0 },
    ...overrides,
  }
}

describe('computeInflation', () => {
  it('holds steady at its own equilibrium when nothing changes turn over turn', () => {
    // With externalPassthrough=1.0 (M1.5), the model's steady state is externalInflation
    // itself (2.0 in this fixture's world default) — full pass-through of imported inflation
    // absent any domestic demand/energy/tax pressure. Starting there should reproduce it.
    const { inflation } = computeInflation(baseInput({ inflationPrev: 2.0 }))
    expect(inflation).toBeCloseTo(2.0, 1)
  })

  it('an energy shock (oil price spike) raises inflation', () => {
    const baseline = computeInflation(baseInput())
    const shocked = computeInflation(baseInput({ world: { ...NEUTRAL_WORLD, oilPriceIndex: 140 } }))
    expect(shocked.inflation).toBeGreaterThan(baseline.inflation)
    expect(shocked.contributions.energy).toBeGreaterThan(0)
  })

  it('growth above potential (demand pressure) raises inflation', () => {
    const baseline = computeInflation(baseInput())
    const overheating = computeInflation(baseInput({ growth: 4, potentialGrowth: 1.2 }))
    expect(overheating.inflation).toBeGreaterThan(baseline.inflation)
  })

  it('has inertia: a single-turn external inflation change does not fully pass through immediately', () => {
    const { inflation } = computeInflation(baseInput({ world: { ...NEUTRAL_WORLD, externalInflation: 8 } }))
    // Full immediate pass-through of a 6pp jump would push inflation near 8; inertia should keep it well below that.
    expect(inflation).toBeLessThan(6)
    expect(inflation).toBeGreaterThan(2)
  })

  it('never produces an absurd single-turn swing from a moderate input change', () => {
    const baseline = computeInflation(baseInput())
    const nudged = computeInflation(baseInput({ world: { ...NEUTRAL_WORLD, externalInflation: 2.5 } }))
    expect(Math.abs(nudged.inflation - baseline.inflation)).toBeLessThan(1)
  })

  it('is clamped within configured bounds', () => {
    const { inflation } = computeInflation(baseInput({ world: { ...NEUTRAL_WORLD, oilPriceIndex: 100000 } }))
    expect(inflation).toBeLessThanOrEqual(DEFAULT_ECONOMIC_ENGINE_CONFIG.inflation.maxInflation)
  })

  it('is deterministic for the same seed and inputs', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.inflation
    const run = () => computeInflation(baseInput({ rng: new SeededRng('replay'), config })).inflation
    expect(run()).toBe(run())
  })
})
