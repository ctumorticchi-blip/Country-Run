import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { createInitialWorldState } from '../data/initialWorldState.ts'
import { eligibleEvents, selectEventForTurn } from './eventSelection.ts'
import type { EventDefinition, EventEligibilityContext } from './eventTypes.ts'

const gameState = createInitialGameState('event-selection-test-seed')
const worldState = createInitialWorldState()

function ctx(overrides: Partial<EventEligibilityContext> = {}): EventEligibilityContext {
  return {
    turn: 5,
    gameState,
    worldState,
    selectedPromiseIds: [],
    governmentProfileId: null,
    policyHistory: [],
    governmentTension: 20,
    politicalCapital: 50,
    firedEventIds: [],
    ...overrides,
  }
}

function event(overrides: Partial<EventDefinition> = {}): EventDefinition {
  return {
    id: 'test-event',
    title: 'Test Event',
    category: 'ECONOMY',
    description: '',
    earliestTurn: 1,
    latestTurn: 30,
    baseProbability: 0.5,
    choices: [{ id: 'ok', title: 'OK', description: '', immediateFeedback: '' }],
    ...overrides,
  }
}

describe('eligibleEvents (M5 §7-10, §24)', () => {
  it('excludes an event before its earliestTurn or after its latestTurn', () => {
    const early = event({ id: 'early', earliestTurn: 10, latestTurn: 20 })
    const late = event({ id: 'late', earliestTurn: 1, latestTurn: 3 })
    const inWindow = event({ id: 'in-window', earliestTurn: 1, latestTurn: 30 })
    const result = eligibleEvents([early, late, inWindow], ctx({ turn: 5 }))
    expect(result.map((e) => e.id)).toEqual(['in-window'])
  })

  it('excludes an event already in firedEventIds (one-shot)', () => {
    const e = event({ id: 'once' })
    expect(eligibleEvents([e], ctx({ firedEventIds: ['once'] }))).toHaveLength(0)
    expect(eligibleEvents([e], ctx({ firedEventIds: [] }))).toHaveLength(1)
  })

  it('at most one event per exclusiveGroup can ever be eligible again once any member of the group has fired', () => {
    const a = event({ id: 'variant-a', exclusiveGroup: 'surprise' })
    const b = event({ id: 'variant-b', exclusiveGroup: 'surprise' })
    const result = eligibleEvents([a, b], ctx({ firedEventIds: ['variant-a'] }))
    expect(result).toHaveLength(0)
  })

  it('excludes an event whose conditions() returns false, includes one that returns true', () => {
    const gated = event({ id: 'gated', conditions: () => false })
    const open = event({ id: 'open', conditions: () => true })
    const result = eligibleEvents([gated, open], ctx())
    expect(result.map((e) => e.id)).toEqual(['open'])
  })

  it('conditions() receives the real context (turn, gameState, etc.)', () => {
    const gated = event({ id: 'gated', conditions: (c) => c.turn > 20 })
    expect(eligibleEvents([gated], ctx({ turn: 5 }))).toHaveLength(0)
    expect(eligibleEvents([gated], ctx({ turn: 25 }))).toHaveLength(1)
  })
})

describe('selectEventForTurn — determinism (M5 §24)', () => {
  it('the same seed, turn, and eligible set always select the same event', () => {
    const events = [event({ id: 'a' }), event({ id: 'b' }), event({ id: 'c' })]
    const first = selectEventForTurn(events, ctx({ turn: 5 }), 'seed-x')
    const second = selectEventForTurn(events, ctx({ turn: 5 }), 'seed-x')
    expect(first?.id).toBe(second?.id)
  })

  it('a different seed can select a different event (not guaranteed every time, but the roll must actually depend on the seed)', () => {
    const events = [event({ id: 'a', baseProbability: 0.34 }), event({ id: 'b', baseProbability: 0.33 }), event({ id: 'c', baseProbability: 0.33 })]
    const results = new Set<string | null>()
    for (let i = 0; i < 20; i++) {
      results.add(selectEventForTurn(events, ctx({ turn: 5 }), `seed-${String(i)}`)?.id ?? null)
    }
    // Across 20 different seeds with 3 roughly-equal ~1/3 candidates, we should see more than one outcome.
    expect(results.size).toBeGreaterThan(1)
  })

  it('never selects an event outside the eligible set', () => {
    const ineligible = event({ id: 'ineligible', earliestTurn: 100, latestTurn: 200 })
    for (let i = 0; i < 10; i++) {
      const result = selectEventForTurn([ineligible], ctx({ turn: 5 }), `seed-${String(i)}`)
      expect(result).toBeNull()
    }
  })

  it('returns null when nothing is eligible', () => {
    expect(selectEventForTurn([], ctx(), 'any-seed')).toBeNull()
  })

  it('a baseProbability of exactly 1 with a single eligible event always fires it', () => {
    const certain = event({ id: 'certain', baseProbability: 1 })
    for (let i = 0; i < 10; i++) {
      expect(selectEventForTurn([certain], ctx({ turn: 5 }), `seed-${String(i)}`)?.id).toBe('certain')
    }
  })

  it('a baseProbability of 0 never fires, no matter the seed', () => {
    const never = event({ id: 'never', baseProbability: 0 })
    for (let i = 0; i < 20; i++) {
      expect(selectEventForTurn([never], ctx({ turn: 5 }), `seed-${String(i)}`)).toBeNull()
    }
  })

  it('probability is clamped to [0, 1] even if baseProbability * modifier would exceed 1', () => {
    const overdriven = event({ id: 'overdriven', baseProbability: 0.9, probabilityModifier: () => 5 })
    for (let i = 0; i < 10; i++) {
      expect(selectEventForTurn([overdriven], ctx({ turn: 5 }), `seed-${String(i)}`)?.id).toBe('overdriven')
    }
  })

  it('picks at most one event per turn even with many eligible high-probability candidates', () => {
    const events = Array.from({ length: 5 }, (_, i) => event({ id: `e${String(i)}`, baseProbability: 0.9 }))
    for (let i = 0; i < 10; i++) {
      const result = selectEventForTurn(events, ctx({ turn: 5 }), `seed-${String(i)}`)
      // selectEventForTurn's return type itself is a single EventDefinition | null — structurally impossible to return more than one.
      expect(result === null || events.some((e) => e.id === result.id)).toBe(true)
    }
  })

  it('over many turns/seeds, an always-eligible near-1 probability event fires close to every time it is checked (frequency bound sanity check)', () => {
    const attempts = 100
    const frequent = event({ id: 'frequent', baseProbability: 0.9, earliestTurn: 1, latestTurn: attempts })
    let fired = 0
    for (let turn = 1; turn <= attempts; turn++) {
      if (selectEventForTurn([frequent], ctx({ turn }), 'frequency-check')?.id === 'frequent') fired++
    }
    expect(fired / attempts).toBeGreaterThan(0.8)
  })

  it('a near-0 probability event fires rarely over many turns (frequency bound sanity check)', () => {
    const attempts = 200
    const rare = event({ id: 'rare', baseProbability: 0.02, earliestTurn: 1, latestTurn: attempts })
    let fired = 0
    for (let turn = 1; turn <= attempts; turn++) {
      if (selectEventForTurn([rare], ctx({ turn }), 'rare-frequency-check')?.id === 'rare') fired++
    }
    expect(fired / attempts).toBeLessThan(0.15)
  })
})
