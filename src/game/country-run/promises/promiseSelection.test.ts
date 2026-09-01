import { describe, expect, it } from 'vitest'
import {
  coherenceScore,
  dominantTags,
  FISCAL_WARNING_THRESHOLD_BN,
  isCompleteSelection,
  isFiscallyDifficult,
  REQUIRED_PROMISE_COUNT,
  tallyPoliticalTags,
  totalEstimatedAnnualCost,
} from './promiseSelection.ts'

const FIVE = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'build-housing']

describe('isCompleteSelection — exactly 5, no duplicates', () => {
  it('requires exactly REQUIRED_PROMISE_COUNT (5) ids', () => {
    expect(REQUIRED_PROMISE_COUNT).toBe(5)
    expect(isCompleteSelection(FIVE)).toBe(true)
    expect(isCompleteSelection(FIVE.slice(0, 4))).toBe(false)
    expect(isCompleteSelection([...FIVE, 'reduce-debt'])).toBe(false)
  })

  it('rejects a selection with a duplicated id even if it has 5 entries', () => {
    expect(isCompleteSelection([...FIVE.slice(0, 4), FIVE[0]])).toBe(false)
  })
})

describe('totalEstimatedAnnualCost / isFiscallyDifficult', () => {
  it('sums each promise’s own estimatedAnnualCost', () => {
    // hospital-plan 10 + invest-education 8 + grand-investment-plan 15 + energy-transition 8 + build-housing 8 = 49
    expect(totalEstimatedAnnualCost(FIVE)).toBe(49)
  })

  it('flags a selection above FISCAL_WARNING_THRESHOLD_BN as difficult', () => {
    expect(totalEstimatedAnnualCost(FIVE)).toBeGreaterThan(FISCAL_WARNING_THRESHOLD_BN)
    expect(isFiscallyDifficult(FIVE)).toBe(true)
  })

  it('a low-cost selection is not flagged as difficult', () => {
    const cheap = ['reduce-deficit', 'reduce-debt', 'no-tax-increase', 'increase-purchasing-power', 'protect-pensions']
    expect(isFiscallyDifficult(cheap)).toBe(false)
  })

  it('never blocks a fiscally difficult selection from being valid (No Free Lunch)', () => {
    expect(isCompleteSelection(FIVE)).toBe(true)
  })
})

describe('coherenceScore / dominantTags / tallyPoliticalTags', () => {
  it('is 0 for an empty selection', () => {
    expect(coherenceScore([])).toBe(0)
    expect(dominantTags([])).toEqual([])
  })

  it('is 1 when every promise shares a single tag', () => {
    const singleTag = ['reduce-deficit', 'reduce-debt'] // both fiscalDiscipline only
    expect(coherenceScore(singleTag)).toBe(1)
  })

  it('tallies each political tag mention across the selection', () => {
    const tally = tallyPoliticalTags(['reduce-deficit', 'reduce-debt'])
    expect(tally.fiscalDiscipline).toBe(2)
  })
})
