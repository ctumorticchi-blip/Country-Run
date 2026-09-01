import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { appendPolicyHistory, type PolicyHistoryEntry } from '../prototype/policyHistory.ts'
import { getPromiseDefinition, PROMISE_CATALOG } from './promiseCatalog.ts'
import type { PromiseEvaluationContext } from './promiseTypes.ts'

const gameState = createInitialGameState('catalog-test-seed')

function contextAt(currentTurn: number, policyHistory: readonly PolicyHistoryEntry[] = []): PromiseEvaluationContext {
  return { initialEconomic: gameState.economic, currentEconomic: gameState.economic, currentTurn, policyHistory }
}

describe('PROMISE_CATALOG — content shape', () => {
  it('has exactly 15 promises with unique ids', () => {
    expect(PROMISE_CATALOG).toHaveLength(15)
    expect(new Set(PROMISE_CATALOG.map((p) => p.id)).size).toBe(15)
  })

  it('getPromiseDefinition finds every catalog entry and throws on an unknown id', () => {
    for (const promise of PROMISE_CATALOG) {
      expect(getPromiseDefinition(promise.id)).toBe(promise)
    }
    expect(() => getPromiseDefinition('not-a-real-promise')).toThrow()
  })

  it('every promise with a trackable lever starts NOT_STARTED at turn 0', () => {
    // The 4 "no lever exists yet" promises (evaluateUnavailableLever) are honestly IN_PROGRESS at every
    // turn including 0 — there is nothing to "not start" when nothing can be tracked at all (see
    // promiseEvaluators.ts's evaluateUnavailableLever doc comment).
    const noLeverIds = new Set(['cut-household-taxes', 'cut-business-taxes', 'no-tax-increase', 'protect-pensions'])
    for (const promise of PROMISE_CATALOG) {
      if (noLeverIds.has(promise.id)) {
        expect(promise.evaluate(contextAt(0)).status).toBe('IN_PROGRESS')
      } else {
        expect(promise.evaluate(contextAt(0)).status).toBe('NOT_STARTED')
      }
    }
  })
})

describe('promise evaluators — correctness', () => {
  it('evaluateThreshold (reduce-deficit) reports ON_TRACK once the metric moves toward target before the deadline', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const improved = { ...gameState.economic, deficitRatio: gameState.economic.deficitRatio - 0.5 }
    const evaluation = promise.evaluate({ initialEconomic: gameState.economic, currentEconomic: improved, currentTurn: 3, policyHistory: [] })
    expect(evaluation.status).toBe('ON_TRACK')
  })

  it('evaluateThreshold (reduce-deficit) reports BROKEN if the target is missed by the deadline', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const worse = { ...gameState.economic, deficitRatio: gameState.economic.deficitRatio + 1 }
    const evaluation = promise.evaluate({ initialEconomic: gameState.economic, currentEconomic: worse, currentTurn: 18, policyHistory: [] })
    expect(evaluation.status).toBe('BROKEN')
  })

  it('evaluatePolicyCommitment (hospital-plan) reports KEPT once the commitment is delivered by the deadline', () => {
    const promise = getPromiseDefinition('hospital-plan')
    const history: PolicyHistoryEntry[] = [{ turn: 0, sourceId: 'budget:health', label: 'Santé — invest', category: 'health', amount: 10 }]
    const evaluation = promise.evaluate(contextAt(12, history))
    expect(evaluation.status).toBe('KEPT')
  })

  it('evaluatePolicyCommitment (hospital-plan) reports AT_RISK when nothing was delivered before the deadline', () => {
    const promise = getPromiseDefinition('hospital-plan')
    const evaluation = promise.evaluate(contextAt(6, []))
    expect(evaluation.status).toBe('AT_RISK')
  })

  it('evaluateUnavailableLever promises (e.g. protect-pensions) never resolve to KEPT or BROKEN', () => {
    const promise = getPromiseDefinition('protect-pensions')
    for (const turn of [0, 1, 6, 12, 30]) {
      const status = promise.evaluate(contextAt(turn)).status
      expect(status).not.toBe('KEPT')
      expect(status).not.toBe('BROKEN')
    }
  })

  it('temporary evaluators are all explicitly flagged', () => {
    const temporaryIds = ['cut-household-taxes', 'cut-business-taxes', 'energy-transition', 'build-housing', 'no-tax-increase', 'protect-pensions', 'restore-public-services']
    for (const id of temporaryIds) {
      expect(getPromiseDefinition(id).temporaryEvaluator).toBe(true)
    }
  })
})

describe('promise selection — conflicting promises are allowed (No Free Lunch, M3 §10)', () => {
  it('a fiscally contradictory set of 5 promises (spend big + cut taxes + cut deficit) evaluates without throwing', () => {
    const contradictory = ['grand-investment-plan', 'cut-household-taxes', 'cut-business-taxes', 'reduce-deficit', 'reduce-debt']
    let history: PolicyHistoryEntry[] = []
    history = appendPolicyHistory(history, { turn: 0, sourceId: 'budget:investment', label: 'Investissement — invest', category: 'investment', amount: 15 })
    for (const id of contradictory) {
      expect(() => getPromiseDefinition(id).evaluate(contextAt(6, history))).not.toThrow()
    }
  })
})
