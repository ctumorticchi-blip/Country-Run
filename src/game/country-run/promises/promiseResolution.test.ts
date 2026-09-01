import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { getPromiseDefinition, PROMISE_CATALOG } from './promiseCatalog.ts'
import { displayStatusForPromise, resolveDuePromises } from './promiseResolution.ts'
import type { PromiseEvaluationContext } from './promiseTypes.ts'

const gameState = createInitialGameState('resolution-test-seed')

function contextAt(currentTurn: number, currentEconomic = gameState.economic): PromiseEvaluationContext {
  return { initialEconomic: gameState.economic, currentEconomic, currentTurn, policyHistory: [] }
}

describe('resolveDuePromises (M5 §15-16)', () => {
  it('does not resolve a promise before its deadline turn', () => {
    const promise = getPromiseDefinition('reduce-deficit') // deadlineTurn 18
    const resolutions = resolveDuePromises([promise], [promise.id], [], contextAt(10))
    expect(resolutions).toHaveLength(0)
  })

  it('resolves KEPT once the deadline is reached and the target is met', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const improved = { ...gameState.economic, deficitRatio: 3.5 }
    const resolutions = resolveDuePromises([promise], [promise.id], [], contextAt(18, improved))
    expect(resolutions).toHaveLength(1)
    expect(resolutions[0].finalStatus).toBe('KEPT')
    expect(resolutions[0].resolvedTurn).toBe(18)
  })

  it('resolves BROKEN when far from target at the deadline, PARTIAL when close', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const baseline = gameState.economic.deficitRatio
    const target = 4
    const farOff = { ...gameState.economic, deficitRatio: baseline + Math.abs(baseline - target) * 3 }
    const closeButMissed = { ...gameState.economic, deficitRatio: target + 0.01 }

    const brokenRes = resolveDuePromises([promise], [promise.id], [], contextAt(18, farOff))
    expect(brokenRes[0].finalStatus).toBe('BROKEN')

    const partialRes = resolveDuePromises([promise], [promise.id], [], contextAt(18, closeButMissed))
    expect(partialRes[0].finalStatus).toBe('PARTIAL')
  })

  it('never re-resolves a promise already present in existingResolutions (idempotent, freezes forever)', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const worse = { ...gameState.economic, deficitRatio: 10 }
    const first = resolveDuePromises([promise], [promise.id], [], contextAt(18, gameState.economic))
    expect(first).toHaveLength(1)

    const second = resolveDuePromises([promise], [promise.id], first, contextAt(25, worse))
    expect(second).toHaveLength(1)
    expect(second[0]).toEqual(first[0])
  })

  it('a temporaryEvaluator promise (e.g. protect-pensions) resolves to PARTIAL, never KEPT/BROKEN', () => {
    const promise = getPromiseDefinition('protect-pensions')
    const resolutions = resolveDuePromises([promise], [promise.id], [], contextAt(promise.deadlineTurn))
    expect(resolutions).toHaveLength(1)
    expect(resolutions[0].finalStatus).toBe('PARTIAL')
  })

  it('only resolves ids present in selectedPromiseIds', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const resolutions = resolveDuePromises(PROMISE_CATALOG, ['reduce-unemployment'], [], contextAt(30))
    expect(resolutions.find((r) => r.promiseId === promise.id)).toBeUndefined()
  })
})

describe('displayStatusForPromise', () => {
  it('shows the live evaluate() read before a resolution exists', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const evaluation = displayStatusForPromise(promise, [], contextAt(10))
    expect(evaluation).toEqual(promise.evaluate(contextAt(10)))
  })

  it('shows the frozen resolution — and stays stable — once one exists, even if later economic state would flip it back', () => {
    const promise = getPromiseDefinition('reduce-deficit')
    const improved = { ...gameState.economic, deficitRatio: 3.5 }
    const resolutions = resolveDuePromises([promise], [promise.id], [], contextAt(18, improved))

    const worseLater = { ...gameState.economic, deficitRatio: 12 }
    const displayed = displayStatusForPromise(promise, resolutions, contextAt(25, worseLater))
    expect(displayed.status).toBe('KEPT')

    const stillWorseAt29 = { ...gameState.economic, deficitRatio: 15 }
    const displayedAgain = displayStatusForPromise(promise, resolutions, contextAt(29, stillWorseAt29))
    expect(displayedAgain.status).toBe('KEPT')
  })
})
