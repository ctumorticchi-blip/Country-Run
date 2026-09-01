import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { NEUTRAL_SERVICE_INDICES } from '../finance/financeTypes.ts'
import { appendPolicyHistory, type PolicyHistoryEntry } from '../prototype/policyHistory.ts'
import { getPromiseDefinition, PROMISE_CATALOG } from './promiseCatalog.ts'
import type { PromiseEvaluationContext } from './promiseTypes.ts'

const gameState = createInitialGameState('catalog-test-seed')

function contextAt(currentTurn: number, policyHistory: readonly PolicyHistoryEntry[] = [], serviceIndices = NEUTRAL_SERVICE_INDICES): PromiseEvaluationContext {
  return { initialEconomic: gameState.economic, currentEconomic: gameState.economic, currentTurn, policyHistory, serviceIndices }
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

  it('every promise starts NOT_STARTED at turn 0 — M6 rewired every promise onto a real lever', () => {
    for (const promise of PROMISE_CATALOG) {
      expect(promise.evaluate(contextAt(0)).status, promise.id).toBe('NOT_STARTED')
    }
  })
})

describe('promise evaluators — correctness', () => {
  it('evaluateThreshold (reduce-deficit) reports ON_TRACK once the metric moves toward target before the deadline', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const improved = { ...gameState.economic, deficitRatio: gameState.economic.deficitRatio - 0.5 }
    const evaluation = promise.evaluate({ initialEconomic: gameState.economic, currentEconomic: improved, currentTurn: 3, policyHistory: [], serviceIndices: NEUTRAL_SERVICE_INDICES })
    expect(evaluation.status).toBe('ON_TRACK')
  })

  it('evaluateThreshold (reduce-deficit) reports BROKEN if the target is missed by the deadline', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const worse = { ...gameState.economic, deficitRatio: gameState.economic.deficitRatio + 1 }
    const evaluation = promise.evaluate({ initialEconomic: gameState.economic, currentEconomic: worse, currentTurn: 18, policyHistory: [], serviceIndices: NEUTRAL_SERVICE_INDICES })
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

  it('protect-pensions reports KEPT if pensions were never cut, BROKEN if they were (M6 §49)', () => {
    const promise = getPromiseDefinition('protect-pensions')
    expect(promise.evaluate(contextAt(30, [])).status).toBe('KEPT')
    const cutHistory: PolicyHistoryEntry[] = [{ turn: 6, sourceId: 'budget:pensions:Budget 2028', label: 'Retraites — Réforme ciblée', category: 'pensions', amount: -12 }]
    expect(promise.evaluate(contextAt(30, cutHistory)).status).toBe('BROKEN')
  })

  it('no-tax-increase is a ratchet: an increase later reversed still counts as BROKEN (M6 §48)', () => {
    const promise = getPromiseDefinition('no-tax-increase')
    const raisedThenCut: PolicyHistoryEntry[] = [
      { turn: 6, sourceId: 'budget:householdTax:Budget 2028', label: 'Fiscalité des ménages — hausse', category: 'taxation', amount: 6 },
      { turn: 12, sourceId: 'budget:householdTax:Budget 2029', label: 'Fiscalité des ménages — baisse', category: 'taxation', amount: -6 },
    ]
    expect(promise.evaluate(contextAt(30, raisedThenCut)).status).toBe('BROKEN')
    expect(promise.evaluate(contextAt(30, [])).status).toBe('KEPT')
  })

  it('cut-household-taxes and cut-business-taxes report KEPT once a sufficient cut is adopted', () => {
    const household = getPromiseDefinition('cut-household-taxes')
    const business = getPromiseDefinition('cut-business-taxes')
    const householdCut: PolicyHistoryEntry[] = [{ turn: 6, sourceId: 'budget:householdTax:Budget 2028', label: '', category: 'taxation', amount: -6 }]
    const businessCut: PolicyHistoryEntry[] = [{ turn: 6, sourceId: 'budget:businessTax:Budget 2028', label: '', category: 'taxation', amount: -5 }]
    expect(household.evaluate(contextAt(30, householdCut)).status).toBe('KEPT')
    expect(business.evaluate(contextAt(30, businessCut)).status).toBe('KEPT')
    expect(household.evaluate(contextAt(30, [])).status).toBe('BROKEN')
  })

  it('restore-public-services reads the composite service index, not a health/education proxy', () => {
    const promise = getPromiseDefinition('restore-public-services')
    const improved = { health: 106, education: 104, security: 103, administration: 102 }
    expect(promise.evaluate(contextAt(18, [], improved)).status).toBe('KEPT')
    const degraded = { health: 92, education: 94, security: 96, administration: 95 }
    expect(promise.evaluate(contextAt(18, [], degraded)).status).toBe('BROKEN')
  })

  it('temporary evaluators are limited to the 2 promises still sharing the generic investment lever', () => {
    const temporaryIds = ['energy-transition', 'build-housing']
    for (const promise of PROMISE_CATALOG) {
      expect(promise.temporaryEvaluator ?? false, promise.id).toBe(temporaryIds.includes(promise.id))
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
