import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../../../engine/economy/config/defaultConfig.ts'
import { NEUTRAL_POLICY_INPUT } from '../../../engine/economy/types.ts'
import { createInitialGameState } from '../data/initialState.ts'
import { createInitialWorldState } from '../data/initialWorldState.ts'
import type { EventDefinition } from '../events/eventTypes.ts'
import type { ScheduledImplementation } from '../parliament/implementationSchedule.ts'
import {
  applyEventChoice,
  applyEventWorldEffect,
  applyYearEndDrift,
  beginMandateTurn,
  mergeMandatePolicy,
  popularityDeltaFromNewPromiseResolutions,
  turnTransitionFlags,
  type MandatePolicyComponents,
} from './turnController.ts'
import type { PromiseDefinition } from '../promises/promiseTypes.ts'
import type { PromiseResolution } from '../promises/promiseResolution.ts'

const state = createInitialGameState('turn-controller-test-seed')
const worldState = createInitialWorldState()
const emptyPolicyComponents: MandatePolicyComponents = {
  bercyPolicy: {},
  energyPolicy: {},
  enactedBudgetPolicy: {},
  implementedReformPolicies: {},
}

function baseBeginInput(overrides: Partial<Parameters<typeof beginMandateTurn>[0]> = {}) {
  return {
    state,
    worldState,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG,
    seed: 'turn-controller-test-seed',
    policyComponents: emptyPolicyComponents,
    previousMergedPolicy: NEUTRAL_POLICY_INPUT,
    scheduledImplementations: [],
    firedEventIds: [],
    selectedPromiseIds: [],
    governmentProfileId: null,
    policyHistory: [],
    governmentTension: 20,
    politicalCapital: 50,
    ...overrides,
  }
}

describe('mergeMandatePolicy', () => {
  it('sums all 4 named components via the already-tested mergePolicyDeltas', () => {
    const merged = mergeMandatePolicy({
      bercyPolicy: { currentSpendingChanges: 5 },
      energyPolicy: { currentSpendingChanges: 2 },
      enactedBudgetPolicy: { taxChanges: 3 },
      implementedReformPolicies: { taxChanges: 1 },
    })
    expect(merged.currentSpendingChanges).toBe(7)
    expect(merged.taxChanges).toBe(4)
  })
})

describe('beginMandateTurn (M5 §38)', () => {
  it('advances the calendar turn by exactly one', () => {
    const result = beginMandateTurn(baseBeginInput())
    expect(result.nextState.meta.turn).toBe(state.meta.turn + 1)
  })

  it('is deterministic — the same seed and inputs always produce the same next state and event roll', () => {
    const a = beginMandateTurn(baseBeginInput())
    const b = beginMandateTurn(baseBeginInput())
    expect(a.nextState).toEqual(b.nextState)
    expect(a.diagnostics).toEqual(b.diagnostics)
    expect(a.firedEvent?.id).toBe(b.firedEvent?.id)
  })

  it('folds a due scheduled implementation into implementedReformPolicies exactly once and removes it from the queue', () => {
    const due: ScheduledImplementation = {
      sourceId: 'test-bill',
      label: 'Test Bill',
      adoptedTurn: 0,
      scheduledTurn: state.meta.turn + 1,
      policyEffect: { currentSpendingChanges: 10 },
    }
    const result = beginMandateTurn(baseBeginInput({ scheduledImplementations: [due] }))
    expect(result.appliedImplementations).toHaveLength(1)
    expect(result.scheduledImplementations).toHaveLength(0)
    expect(result.policyComponents.implementedReformPolicies.currentSpendingChanges).toBe(10)
  })

  it('leaves a not-yet-due implementation untouched in the queue', () => {
    const notYetDue: ScheduledImplementation = {
      sourceId: 'test-bill',
      label: 'Test Bill',
      adoptedTurn: 0,
      scheduledTurn: state.meta.turn + 5,
      policyEffect: { currentSpendingChanges: 10 },
    }
    const result = beginMandateTurn(baseBeginInput({ scheduledImplementations: [notYetDue] }))
    expect(result.appliedImplementations).toHaveLength(0)
    expect(result.scheduledImplementations).toHaveLength(1)
    expect(result.policyComponents.implementedReformPolicies.currentSpendingChanges ?? 0).toBe(0)
  })

  it('never fires an event outside its eligibility window', () => {
    const neverEligible: EventDefinition = {
      id: 'never',
      title: 'Never',
      category: 'ECONOMY',
      description: '',
      earliestTurn: 999,
      latestTurn: 999,
      baseProbability: 1,
      choices: [{ id: 'ok', title: 'OK', description: '', immediateFeedback: '' }],
    }
    const result = beginMandateTurn(baseBeginInput({ events: [neverEligible] }))
    expect(result.firedEvent).toBeNull()
  })

  it('fires a guaranteed-eligible, guaranteed-probability event', () => {
    const alwaysFires: EventDefinition = {
      id: 'always',
      title: 'Always',
      category: 'ECONOMY',
      description: '',
      earliestTurn: 1,
      latestTurn: 30,
      baseProbability: 1,
      choices: [{ id: 'ok', title: 'OK', description: '', immediateFeedback: '' }],
    }
    const result = beginMandateTurn(baseBeginInput({ events: [alwaysFires] }))
    expect(result.firedEvent?.id).toBe('always')
  })

  it('never re-fires an event whose id is already in firedEventIds', () => {
    const oneShot: EventDefinition = {
      id: 'one-shot',
      title: 'One Shot',
      category: 'ECONOMY',
      description: '',
      earliestTurn: 1,
      latestTurn: 30,
      baseProbability: 1,
      choices: [{ id: 'ok', title: 'OK', description: '', immediateFeedback: '' }],
    }
    const result = beginMandateTurn(baseBeginInput({ events: [oneShot], firedEventIds: ['one-shot'] }))
    expect(result.firedEvent).toBeNull()
  })
})

describe('applyEventChoice', () => {
  const event: EventDefinition = {
    id: 'test-event',
    title: 'Test Event',
    category: 'ECONOMY',
    description: '',
    earliestTurn: 1,
    latestTurn: 30,
    baseProbability: 1,
    choices: [],
  }

  it('folds an immediate economicPolicyEffect into implementedReformPolicies', () => {
    const choice = { id: 'a', title: 'A', description: '', economicPolicyEffect: { taxChanges: 4 }, immediateFeedback: '' }
    const result = applyEventChoice(5, event, choice, emptyPolicyComponents, [])
    expect(result.policyComponents.implementedReformPolicies.taxChanges).toBe(4)
  })

  it('schedules each delayedEffects entry at turn + turnsLater', () => {
    const choice = {
      id: 'a',
      title: 'A',
      description: '',
      delayedEffects: [{ turnsLater: 3, policyEffect: { researchInvestment: 5 } }],
      immediateFeedback: '',
    }
    const result = applyEventChoice(5, event, choice, emptyPolicyComponents, [])
    expect(result.scheduledImplementations).toHaveLength(1)
    expect(result.scheduledImplementations[0].scheduledTurn).toBe(8)
    expect(result.scheduledImplementations[0].policyEffect).toEqual({ researchInvestment: 5 })
  })

  it('a choice with no effects at all leaves the merged policy and schedule unchanged', () => {
    const choice = { id: 'a', title: 'A', description: '', immediateFeedback: '' }
    const result = applyEventChoice(5, event, choice, emptyPolicyComponents, [])
    expect(mergeMandatePolicy(result.policyComponents)).toEqual(mergeMandatePolicy(emptyPolicyComponents))
    expect(result.scheduledImplementations).toEqual([])
  })
})

describe('applyEventWorldEffect', () => {
  it('adds the delta to the named WorldState field', () => {
    const next = applyEventWorldEffect(worldState, { id: 'a', title: 'A', description: '', worldEffect: { oilPriceIndex: 20 }, immediateFeedback: '' })
    expect(next.oilPriceIndex).toBe(worldState.oilPriceIndex + 20)
  })

  it('returns the same object reference when there is no worldEffect', () => {
    const next = applyEventWorldEffect(worldState, { id: 'a', title: 'A', description: '', immediateFeedback: '' })
    expect(next).toBe(worldState)
  })

  it('never touches fields not named in worldEffect', () => {
    const next = applyEventWorldEffect(worldState, { id: 'a', title: 'A', description: '', worldEffect: { oilPriceIndex: 20 }, immediateFeedback: '' })
    expect(next.ecbRate).toBe(worldState.ecbRate)
    expect(next.eurozoneGrowth).toBe(worldState.eurozoneGrowth)
  })
})

describe('popularityDeltaFromNewPromiseResolutions', () => {
  const promise: PromiseDefinition = {
    id: 'p1',
    category: 'employment',
    title: 'Test',
    shortDescription: '',
    campaignPitch: '',
    targetMetricLabel: '',
    deadlineTurn: 18,
    deadlineLabel: '',
    estimatedAnnualCost: 0,
    difficulty: 'HIGH',
    politicalTags: [],
    evaluate: () => ({ status: 'KEPT', progressLabel: '' }),
  }

  it('sums the weighted delta for every resolution frozen this turn', () => {
    const resolutions: PromiseResolution[] = [{ promiseId: 'p1', finalStatus: 'KEPT', resolvedTurn: 18, progressLabel: '' }]
    const delta = popularityDeltaFromNewPromiseResolutions(resolutions, [promise])
    expect(delta).toBeGreaterThan(0)
  })

  it('ignores a resolution whose promise id is unknown', () => {
    const resolutions: PromiseResolution[] = [{ promiseId: 'unknown', finalStatus: 'KEPT', resolvedTurn: 18, progressLabel: '' }]
    expect(popularityDeltaFromNewPromiseResolutions(resolutions, [promise])).toBe(0)
  })

  it('an empty list contributes nothing', () => {
    expect(popularityDeltaFromNewPromiseResolutions([], [promise])).toBe(0)
  })
})

describe('turnTransitionFlags', () => {
  it('flags turn 1 as a year start only', () => {
    expect(turnTransitionFlags(1)).toEqual({ isYearStart: true, isYearEnd: false, isMidterm: false, isMandateEnd: false })
  })

  it('flags turn 18 as year end AND midterm', () => {
    expect(turnTransitionFlags(18)).toEqual({ isYearStart: false, isYearEnd: true, isMidterm: true, isMandateEnd: false })
  })

  it('flags turn 30 as year end AND mandate end', () => {
    expect(turnTransitionFlags(30)).toEqual({ isYearStart: false, isYearEnd: true, isMidterm: false, isMandateEnd: true })
  })

  it('flags a mid-year turn as none of the above', () => {
    expect(turnTransitionFlags(3)).toEqual({ isYearStart: false, isYearEnd: false, isMidterm: false, isMandateEnd: false })
  })
})

describe('applyYearEndDrift', () => {
  it('never resets political capital — always returns a delta-adjusted value, bounded, never a fixed reset', () => {
    const result = applyYearEndDrift({
      popularityAtYearStart: 50,
      popularityAtYearEnd: 60,
      growthDelta: 0.2,
      governmentTension: 30,
      politicalCapital: 40,
    })
    expect(result.politicalCapital).not.toBe(0)
    expect(result.politicalCapital).toBeGreaterThanOrEqual(0)
    expect(result.politicalCapital).toBeLessThanOrEqual(100)
  })

  it('high final popularity relieves government tension', () => {
    const result = applyYearEndDrift({ popularityAtYearStart: 50, popularityAtYearEnd: 70, growthDelta: 0, governmentTension: 40, politicalCapital: 40 })
    expect(result.governmentTension).toBeLessThan(40)
  })
})

describe('policy input never accumulates twice for an unchanged budget across turns (M1.5 anti-regression)', () => {
  it('running beginMandateTurn twice with the SAME enactedBudgetPolicy both times does not double its effect', () => {
    const components: MandatePolicyComponents = { ...emptyPolicyComponents, enactedBudgetPolicy: { currentSpendingChanges: 20 } }
    const first = beginMandateTurn(baseBeginInput({ policyComponents: components }))
    const second = beginMandateTurn(
      baseBeginInput({ state: first.nextState, policyComponents: first.policyComponents, previousMergedPolicy: first.mergedPolicy }),
    )
    expect(mergeMandatePolicy(second.policyComponents).currentSpendingChanges).toBe(20)
    expect(mergeMandatePolicy(first.policyComponents).currentSpendingChanges).toBe(20)
  })

  it('a budget CHANGE between two turns (mergedPolicy threaded correctly) IS felt as a fresh delta, not silently absorbed', () => {
    const neutral: MandatePolicyComponents = emptyPolicyComponents
    const raised: MandatePolicyComponents = { ...emptyPolicyComponents, enactedBudgetPolicy: { currentSpendingChanges: 20 } }

    const first = beginMandateTurn(baseBeginInput({ policyComponents: neutral }))
    const changed = beginMandateTurn(
      baseBeginInput({ state: first.nextState, policyComponents: raised, previousMergedPolicy: first.mergedPolicy }),
    )
    const unchanged = beginMandateTurn(
      baseBeginInput({ state: first.nextState, policyComponents: neutral, previousMergedPolicy: first.mergedPolicy }),
    )
    expect(changed.nextState.economic).not.toEqual(unchanged.nextState.economic)
  })
})
