import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { computeUnemployment, type ComputeUnemploymentInput } from './unemployment.ts'

function baseInput(overrides?: Partial<ComputeUnemploymentInput>): ComputeUnemploymentInput {
  return {
    unemploymentPrev: 7.5,
    structuralUnemploymentPrev: 7.5,
    growth: 1.2,
    potentialGrowth: 1.2,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment,
    ...overrides,
  }
}

describe('computeUnemployment', () => {
  it('stays put when growth equals potential and unemployment already matches structural', () => {
    const next = computeUnemployment(baseInput())
    expect(next).toBeCloseTo(7.5)
  })

  it('growth above potential puts downward pressure on unemployment', () => {
    const next = computeUnemployment(baseInput({ growth: 3.5, potentialGrowth: 1.2 }))
    expect(next).toBeLessThan(7.5)
  })

  it('growth below potential puts upward pressure on unemployment', () => {
    const next = computeUnemployment(baseInput({ growth: -1.0, potentialGrowth: 1.2 }))
    expect(next).toBeGreaterThan(7.5)
  })

  it('cannot make unemployment collapse in a single turn (bounded per-turn change)', () => {
    // A deliberately extreme growth gap should still only move unemployment a small amount in one turn.
    const next = computeUnemployment(baseInput({ unemploymentPrev: 8, growth: 20, potentialGrowth: 1.2 }))
    expect(8 - next).toBeLessThan(2)
  })

  it('drifts slowly toward structural unemployment when growth matches potential', () => {
    const next = computeUnemployment(baseInput({ unemploymentPrev: 10, structuralUnemploymentPrev: 7 }))
    expect(next).toBeLessThan(10)
    expect(next).toBeGreaterThan(7)
  })

  it('never drops below the configured minimum', () => {
    const next = computeUnemployment(baseInput({ unemploymentPrev: 2.1, growth: 50, potentialGrowth: 0 }))
    expect(next).toBeGreaterThanOrEqual(DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment.minUnemployment)
  })

  it('never exceeds the configured maximum', () => {
    const next = computeUnemployment(baseInput({ unemploymentPrev: 19.9, growth: -50, potentialGrowth: 0 }))
    expect(next).toBeLessThanOrEqual(DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment.maxUnemployment)
  })
})
