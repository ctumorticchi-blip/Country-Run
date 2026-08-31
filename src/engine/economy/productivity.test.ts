import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { driftProductivityGrowth, scheduleStructuralDelayedEffects } from './productivity.ts'
import { NEUTRAL_POLICY_INPUT } from './types.ts'

describe('driftProductivityGrowth', () => {
  it('applies only the tiny configured per-turn drift', () => {
    const next = driftProductivityGrowth(0.8, DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity)
    expect(next).toBeCloseTo(0.8 + DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity.baseDriftPerTurn)
  })
})

describe('scheduleStructuralDelayedEffects', () => {
  it('schedules nothing for an all-neutral policy input', () => {
    const effects = scheduleStructuralDelayedEffects(
      3,
      NEUTRAL_POLICY_INPUT,
      new SeededRng('schedule-neutral'),
      DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity,
      DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment,
    )
    expect(effects).toEqual([])
  })

  it('schedules an infrastructure productivity boost at the configured horizon, not immediately', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity
    const effects = scheduleStructuralDelayedEffects(
      3,
      { ...NEUTRAL_POLICY_INPUT, infrastructureInvestment: 10 },
      new SeededRng('schedule-infra'),
      config,
      DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment,
    )
    expect(effects).toHaveLength(1)
    expect(effects[0]?.executeAtTurn).toBe(3 + config.infrastructureDelayTurns)
    expect(effects[0]?.effect).toEqual({
      type: 'add',
      path: 'economic.productivityGrowth',
      value: 10 * config.infrastructureEffectPerBillion,
    })
  })

  it('applies uncertainty to the research investment payoff, deterministically for a given seed', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity
    const run = (seed: string) =>
      scheduleStructuralDelayedEffects(
        5,
        { ...NEUTRAL_POLICY_INPUT, researchInvestment: 8 },
        new SeededRng(seed),
        config,
        DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment,
      )[0]?.effect

    const a = run('research-seed')
    const b = run('research-seed')
    expect(a).toEqual(b)

    const baseline = 8 * config.researchEffectPerBillion
    if (a.type !== 'add') throw new Error('expected an add effect')
    expect(a.value).not.toBe(baseline) // uncertainty should perturb it away from the raw linear value
  })

  it('schedules education effects at a much longer horizon than infrastructure', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity
    expect(config.educationDelayTurns).toBeGreaterThan(config.infrastructureDelayTurns)
  })

  it('labor market reform schedules a bounded reduction to structural unemployment, not an instant one', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment
    const effects = scheduleStructuralDelayedEffects(
      2,
      { ...NEUTRAL_POLICY_INPUT, laborMarketReform: 1 },
      new SeededRng('schedule-labor'),
      DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity,
      config,
    )
    const laborEffect = effects.find((e) => e.sourceId === 'laborMarketReform')
    expect(laborEffect?.executeAtTurn).toBe(2 + config.structuralReformDelayTurns)
    expect(laborEffect?.effect).toMatchObject({ type: 'subtract', path: 'economic.structuralUnemployment' })
    // A single reform at full intensity must not be able to wipe out structural unemployment (e.g. 8% -> 4%).
    expect(config.structuralReformEffectPerIntensity).toBeLessThan(4)
  })

  it('public sector reform schedules an efficiency boost capped at 100', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity
    const effects = scheduleStructuralDelayedEffects(
      2,
      { ...NEUTRAL_POLICY_INPUT, publicSectorReform: 1 },
      new SeededRng('schedule-psr'),
      config,
      DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment,
    )
    const reformEffect = effects.find((e) => e.sourceId === 'publicSectorReform')
    expect(reformEffect?.effect).toMatchObject({ type: 'add', path: 'economic.publicSectorEfficiency', max: 100 })
  })

  it('schedules an effect for every non-zero structural input at once', () => {
    const effects = scheduleStructuralDelayedEffects(
      1,
      {
        ...NEUTRAL_POLICY_INPUT,
        infrastructureInvestment: 5,
        researchInvestment: 3,
        educationInvestment: 2,
        laborMarketReform: 0.5,
        publicSectorReform: 0.5,
      },
      new SeededRng('schedule-all'),
      DEFAULT_ECONOMIC_ENGINE_CONFIG.productivity,
      DEFAULT_ECONOMIC_ENGINE_CONFIG.unemployment,
    )
    expect(effects).toHaveLength(5)
    expect(new Set(effects.map((e) => e.id)).size).toBe(5) // all IDs unique
  })
})
