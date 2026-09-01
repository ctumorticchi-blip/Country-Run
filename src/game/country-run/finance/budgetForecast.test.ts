import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../../../engine/economy/config/defaultConfig.ts'
import { NEUTRAL_POLICY_INPUT } from '../../../engine/economy/types.ts'
import { createInitialGameState } from '../data/initialState.ts'
import { createInitialWorldState } from '../data/initialWorldState.ts'
import { forecastNextYear } from './budgetForecast.ts'

const state = createInitialGameState('forecast-test-seed')
const worldState = createInitialWorldState()

describe('M6 §32-33 forecast engine — pure, ranged, never a fake single-point number', () => {
  it('never mutates the GameState/WorldState it is given', () => {
    const before = JSON.stringify(state)
    forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-purity-seed')
    expect(JSON.stringify(state)).toBe(before)
  })

  it('every indicator is returned as low <= central <= high, never a bare number', () => {
    const forecast = forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-range-seed')
    for (const range of [forecast.growth, forecast.unemployment, forecast.inflation, forecast.deficitRatio, forecast.debtRatio, forecast.interestCost, forecast.purchasingPowerDelta]) {
      expect(range.low).toBeLessThanOrEqual(range.central)
      expect(range.central).toBeLessThanOrEqual(range.high)
      expect(Number.isFinite(range.low)).toBe(true)
      expect(Number.isFinite(range.high)).toBe(true)
    }
  })

  it('the same inputs and seed reproduce an identical forecast (deterministic)', () => {
    const a = forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-determinism-seed')
    const b = forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-determinism-seed')
    expect(a).toEqual(b)
  })

  it('a widthMultiplier below 0.85 reports HIGH confidence; above 1.3 reports LOW', () => {
    const precise = forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-confidence-seed', 0.5)
    const vague = forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-confidence-seed', 1.5)
    expect(precise.confidence).toBe('HIGH')
    expect(vague.confidence).toBe('LOW')
  })

  it('a materially expansionary sustained policy forecasts a worse deficit ratio than a neutral one', () => {
    const neutral = forecastNextYear(state, worldState, DEFAULT_ECONOMIC_ENGINE_CONFIG, NEUTRAL_POLICY_INPUT, NEUTRAL_POLICY_INPUT, 'forecast-policy-seed')
    const expansionary = forecastNextYear(
      state,
      worldState,
      DEFAULT_ECONOMIC_ENGINE_CONFIG,
      { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 40 },
      NEUTRAL_POLICY_INPUT,
      'forecast-policy-seed',
    )
    expect(expansionary.deficitRatio.central).toBeGreaterThan(neutral.deficitRatio.central)
  })
})
