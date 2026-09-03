import { describe, expect, it } from 'vitest'
import {
  GOVERNMENT_CRISIS_CAPITAL_PENALTY,
  GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE,
  GOVERNMENT_CRISIS_POPULARITY_PENALTY,
  GOVERNMENT_CRISIS_RELATION_PENALTY,
  GOVERNMENT_CRISIS_TENSION_THRESHOLD,
  governmentCrisisConsequence,
  governmentCrisisTriggered,
} from './governmentCrisis.ts'

describe('governmentCrisisTriggered — tension threshold', () => {
  it('fires only on the turn tension crosses the threshold, not before or while it stays high', () => {
    expect(
      governmentCrisisTriggered({
        tensionBefore: GOVERNMENT_CRISIS_TENSION_THRESHOLD - 5,
        tensionAfter: GOVERNMENT_CRISIS_TENSION_THRESHOLD + 2,
        exceptionalProcedureUsageCountBefore: 0,
        exceptionalProcedureUsageCountAfter: 0,
      }),
    ).toBe(true)

    // Already above threshold both turns — does not re-fire every turn.
    expect(
      governmentCrisisTriggered({
        tensionBefore: GOVERNMENT_CRISIS_TENSION_THRESHOLD + 2,
        tensionAfter: GOVERNMENT_CRISIS_TENSION_THRESHOLD + 3,
        exceptionalProcedureUsageCountBefore: 0,
        exceptionalProcedureUsageCountAfter: 0,
      }),
    ).toBe(false)

    // Never crosses.
    expect(
      governmentCrisisTriggered({
        tensionBefore: 10,
        tensionAfter: 20,
        exceptionalProcedureUsageCountBefore: 0,
        exceptionalProcedureUsageCountAfter: 0,
      }),
    ).toBe(false)
  })
})

describe('governmentCrisisTriggered — repeated exceptional procedure', () => {
  it('fires when usage count reaches a new multiple of GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE', () => {
    expect(
      governmentCrisisTriggered({
        tensionBefore: 0,
        tensionAfter: 0,
        exceptionalProcedureUsageCountBefore: GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE - 1,
        exceptionalProcedureUsageCountAfter: GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE,
      }),
    ).toBe(true)
  })

  it('does not fire again on the next use within the same multiple bracket', () => {
    expect(
      governmentCrisisTriggered({
        tensionBefore: 0,
        tensionAfter: 0,
        exceptionalProcedureUsageCountBefore: GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE,
        exceptionalProcedureUsageCountAfter: GOVERNMENT_CRISIS_EXCEPTIONAL_PROCEDURE_MULTIPLE + 1,
      }),
    ).toBe(false)
  })
})

describe('governmentCrisisConsequence', () => {
  it('returns the documented negative penalties', () => {
    const c = governmentCrisisConsequence()
    expect(c.politicalCapitalDelta).toBe(-GOVERNMENT_CRISIS_CAPITAL_PENALTY)
    expect(c.popularityDelta).toBe(GOVERNMENT_CRISIS_POPULARITY_PENALTY)
    expect(c.relationDeltaAllBlocs).toBe(GOVERNMENT_CRISIS_RELATION_PENALTY)
  })
})
