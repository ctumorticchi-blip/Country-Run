import { describe, expect, it } from 'vitest'
import {
  applyCapitalDelta,
  canAffordCapital,
  classifyReformDifficulty,
  computeInitialPoliticalCapital,
  MAX_POLITICAL_CAPITAL,
  MIN_POLITICAL_CAPITAL,
  politicalCapitalCostRange,
  politicalCapitalDeltaFromBillOutcome,
  politicalCapitalDeltaFromYearEnd,
  recoverCapital,
  spendCapital,
} from './politicalCapital.ts'
import type { EffectiveBill } from '../parliament/concessions.ts'
import type { PoliticalBillDefinition } from '../parliament/billTypes.ts'

function billWith(controversy: number, reformIntensity: number): EffectiveBill {
  const definition: PoliticalBillDefinition = {
    id: 'test-bill',
    title: 'Test',
    description: '',
    policyTags: {},
    economicPolicyEffect: {},
    fiscalCost: 0,
    reformIntensity,
    controversy,
    promiseLinks: [],
    requiredPoliticalCapital: 5,
    urgency: 'MEDIUM',
    negotiability: 0.5,
    concessionsAvailable: [],
    voteThreshold: 289,
    implementationDelay: 0,
  }
  return { definition, fiscalCost: 0, economicPolicyEffect: {}, policyTags: {}, appliedConcessions: [] }
}

describe('computeInitialPoliticalCapital — bounded [0, 100]', () => {
  it('never leaves [MIN_POLITICAL_CAPITAL, MAX_POLITICAL_CAPITAL] across the full input space', () => {
    for (const scorePct of [50.5, 51, 52, 53, 54]) {
      for (const majority of ['MAJORITÉ_ABSOLUE', 'MAJORITÉ_RELATIVE', 'ASSEMBLÉE_FRAGMENTÉE'] as const) {
        for (const coherence of [0, 0.25, 0.5, 0.75, 1]) {
          const capital = computeInitialPoliticalCapital(scorePct, majority, coherence)
          expect(capital).toBeGreaterThanOrEqual(MIN_POLITICAL_CAPITAL)
          expect(capital).toBeLessThanOrEqual(MAX_POLITICAL_CAPITAL)
        }
      }
    }
  })

  it('an absolute majority yields more capital than a fragmented assembly, all else equal', () => {
    const absolute = computeInitialPoliticalCapital(52, 'MAJORITÉ_ABSOLUE', 0.5)
    const fragmented = computeInitialPoliticalCapital(52, 'ASSEMBLÉE_FRAGMENTÉE', 0.5)
    expect(absolute).toBeGreaterThan(fragmented)
  })
})

describe('canAffordCapital / spendCapital / recoverCapital / applyCapitalDelta (M4 §9-10)', () => {
  it('canAffordCapital is false once the amount exceeds current capital', () => {
    expect(canAffordCapital(10, 10)).toBe(true)
    expect(canAffordCapital(10, 11)).toBe(false)
    expect(canAffordCapital(10, -1)).toBe(false)
  })

  it('spendCapital never goes negative even past what canAffordCapital would allow', () => {
    expect(spendCapital(5, 20)).toBe(MIN_POLITICAL_CAPITAL)
  })

  it('recoverCapital never exceeds MAX_POLITICAL_CAPITAL', () => {
    expect(recoverCapital(95, 20)).toBe(MAX_POLITICAL_CAPITAL)
  })

  it('applyCapitalDelta is bounded in both directions', () => {
    expect(applyCapitalDelta(2, -10)).toBe(MIN_POLITICAL_CAPITAL)
    expect(applyCapitalDelta(98, 10)).toBe(MAX_POLITICAL_CAPITAL)
    expect(applyCapitalDelta(50, 5)).toBe(55)
  })
})

describe('classifyReformDifficulty / politicalCapitalCostRange (M4 §9)', () => {
  it('maps controversy to the 4 documented tiers', () => {
    expect(classifyReformDifficulty(0.1)).toBe('EASY')
    expect(classifyReformDifficulty(0.3)).toBe('MODERATE')
    expect(classifyReformDifficulty(0.6)).toBe('DIFFICULT')
    expect(classifyReformDifficulty(0.9)).toBe('VERY_CONTROVERSIAL')
  })

  it('the cost range grows monotonically with difficulty', () => {
    const [easyLow, easyHigh] = politicalCapitalCostRange(0.1)
    const [veryLow, veryHigh] = politicalCapitalCostRange(0.9)
    expect(easyLow).toBe(0)
    expect(easyHigh).toBeLessThanOrEqual(veryLow)
    expect(veryHigh).toBe(30)
  })
})

describe('politicalCapitalDeltaFromBillOutcome (M4 §10)', () => {
  it('a passed bill recovers capital; recovery scales with reform intensity', () => {
    const easy = politicalCapitalDeltaFromBillOutcome(billWith(0.1, 0.1), true)
    const hard = politicalCapitalDeltaFromBillOutcome(billWith(0.1, 0.9), true)
    expect(easy).toBeGreaterThan(0)
    expect(hard).toBeGreaterThan(easy)
  })

  it('a rejected bill costs capital; the penalty scales with controversy', () => {
    const mild = politicalCapitalDeltaFromBillOutcome(billWith(0.1, 0.5), false)
    const severe = politicalCapitalDeltaFromBillOutcome(billWith(0.9, 0.5), false)
    expect(mild).toBeLessThan(0)
    expect(severe).toBeLessThan(mild)
  })
})

describe('politicalCapitalDeltaFromYearEnd (M4 §10) — modest, bounded drift', () => {
  it('stays within a small bounded range regardless of extreme inputs', () => {
    const best = politicalCapitalDeltaFromYearEnd(50, 100, 5)
    const worst = politicalCapitalDeltaFromYearEnd(50, 0, -5)
    expect(best).toBeLessThanOrEqual(5)
    expect(worst).toBeGreaterThanOrEqual(-5)
  })

  it('a better mandate yields a higher delta than a worse one', () => {
    const good = politicalCapitalDeltaFromYearEnd(50, 60, 0.5)
    const bad = politicalCapitalDeltaFromYearEnd(50, 40, -0.5)
    expect(good).toBeGreaterThan(bad)
  })
})
