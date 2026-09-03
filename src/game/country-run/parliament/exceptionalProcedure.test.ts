import { describe, expect, it } from 'vitest'
import {
  applyExceptionalProcedure,
  blocsHostileToProcedure,
  canUseExceptionalProcedure,
  clampGovernmentTension,
  EXCEPTIONAL_PROCEDURE_CAPITAL_COST,
  EXCEPTIONAL_PROCEDURE_ESCALATION_PER_USE,
  EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS,
  EXCEPTIONAL_PROCEDURE_POPULARITY_PENALTY,
  EXCEPTIONAL_PROCEDURE_TENSION_INCREASE,
  exceptionalProcedureCost,
  MAX_GOVERNMENT_TENSION,
  MIN_GOVERNMENT_TENSION,
} from './exceptionalProcedure.ts'

describe('canUseExceptionalProcedure', () => {
  it('requires at least EXCEPTIONAL_PROCEDURE_CAPITAL_COST', () => {
    expect(canUseExceptionalProcedure(EXCEPTIONAL_PROCEDURE_CAPITAL_COST)).toBe(true)
    expect(canUseExceptionalProcedure(EXCEPTIONAL_PROCEDURE_CAPITAL_COST - 1)).toBe(false)
  })
})

describe('applyExceptionalProcedure — powerful but expensive (M4 §20)', () => {
  it('deducts the full capital cost, never going negative', () => {
    const result = applyExceptionalProcedure(EXCEPTIONAL_PROCEDURE_CAPITAL_COST, 0)
    expect(result.politicalCapitalAfter).toBe(0)
  })

  it('never leaves capital negative even called below the cost (defensive)', () => {
    const result = applyExceptionalProcedure(5, 0)
    expect(result.politicalCapitalAfter).toBeGreaterThanOrEqual(0)
  })

  it('applies a fixed popularity penalty', () => {
    const result = applyExceptionalProcedure(50, 0)
    expect(result.popularityDelta).toBe(EXCEPTIONAL_PROCEDURE_POPULARITY_PENALTY)
    expect(result.popularityDelta).toBeLessThan(0)
  })

  it('increases governmentTension by the documented amount, bounded at MAX_GOVERNMENT_TENSION', () => {
    const result = applyExceptionalProcedure(50, 0)
    expect(result.governmentTensionAfter).toBe(EXCEPTIONAL_PROCEDURE_TENSION_INCREASE)
    const saturated = applyExceptionalProcedure(50, MAX_GOVERNMENT_TENSION)
    expect(saturated.governmentTensionAfter).toBe(MAX_GOVERNMENT_TENSION)
  })
})

describe('clampGovernmentTension', () => {
  it('bounds to [MIN_GOVERNMENT_TENSION, MAX_GOVERNMENT_TENSION]', () => {
    expect(clampGovernmentTension(-10)).toBe(MIN_GOVERNMENT_TENSION)
    expect(clampGovernmentTension(150)).toBe(MAX_GOVERNMENT_TENSION)
    expect(clampGovernmentTension(50)).toBe(50)
  })
})

describe('M6.5 §21 — exceptional procedure escalation on repeated use', () => {
  it('exceptionalProcedureCost rises with prior usage, capped at EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS', () => {
    expect(exceptionalProcedureCost(0)).toBe(EXCEPTIONAL_PROCEDURE_CAPITAL_COST)
    expect(exceptionalProcedureCost(1)).toBe(EXCEPTIONAL_PROCEDURE_CAPITAL_COST + EXCEPTIONAL_PROCEDURE_ESCALATION_PER_USE)
    expect(exceptionalProcedureCost(EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS)).toBe(
      EXCEPTIONAL_PROCEDURE_CAPITAL_COST + EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS * EXCEPTIONAL_PROCEDURE_ESCALATION_PER_USE,
    )
    // Never rises further past the cap — a large-but-bounded cost, never an eventual mathematical impossibility.
    expect(exceptionalProcedureCost(50)).toBe(exceptionalProcedureCost(EXCEPTIONAL_PROCEDURE_MAX_ESCALATIONS))
  })

  it('canUseExceptionalProcedure requires more capital after repeated use', () => {
    expect(canUseExceptionalProcedure(EXCEPTIONAL_PROCEDURE_CAPITAL_COST, 0)).toBe(true)
    expect(canUseExceptionalProcedure(EXCEPTIONAL_PROCEDURE_CAPITAL_COST, 1)).toBe(false)
    expect(canUseExceptionalProcedure(exceptionalProcedureCost(1), 1)).toBe(true)
  })

  it('applyExceptionalProcedure costs more capital, more popularity, and more tension on a second use', () => {
    const first = applyExceptionalProcedure(200, 0, 0)
    const second = applyExceptionalProcedure(200, 0, 1)
    expect(200 - second.politicalCapitalAfter).toBeGreaterThan(200 - first.politicalCapitalAfter)
    expect(second.popularityDelta).toBeLessThan(first.popularityDelta)
    expect(second.governmentTensionAfter).toBeGreaterThan(first.governmentTensionAfter)
  })
})

describe('blocsHostileToProcedure', () => {
  it('flags only blocs below the 0.4 support threshold', () => {
    const breakdown = [
      { blocId: 'a', supportProbability: 0.1 },
      { blocId: 'b', supportProbability: 0.5 },
      { blocId: 'c', supportProbability: 0.39 },
    ]
    expect(blocsHostileToProcedure(breakdown)).toEqual(['a', 'c'])
  })
})
