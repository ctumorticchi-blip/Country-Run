import { describe, expect, it } from 'vitest'
import {
  budgetLabelForYearStartTurn,
  formatTurnPeriod,
  isMandateEndTurn,
  isMidtermTurn,
  isYearEndTurn,
  isYearStartTurn,
  MANDATE_END_TURN,
  MANDATE_TURNS,
  MANDATE_YEARS,
  MIDTERM_TURN,
  turnToDate,
  turnToGameplayYear,
} from './calendar.ts'

describe('MANDATE_TURNS / MANDATE_YEARS (M5 §2, §66)', () => {
  it('the mandate is exactly 5 years of 6 turns each — 30 turns total', () => {
    expect(MANDATE_YEARS).toBe(5)
    expect(MANDATE_TURNS).toBe(30)
    expect(MANDATE_END_TURN).toBe(30)
  })
})

describe('turnToDate — exact turn-to-date table (M5 §2, §66)', () => {
  it('turn 1 is May-Jun 2027', () => {
    expect(turnToDate(1)).toEqual({ startMonth: 5, startYear: 2027, endMonth: 6, endYear: 2027 })
  })

  it('turn 6 is Mar-Apr 2028 (end of Year 1)', () => {
    expect(turnToDate(6)).toEqual({ startMonth: 3, startYear: 2028, endMonth: 4, endYear: 2028 })
  })

  it('turn 7 is May-Jun 2028 (start of Year 2)', () => {
    expect(turnToDate(7)).toEqual({ startMonth: 5, startYear: 2028, endMonth: 6, endYear: 2028 })
  })

  it('turn 18 is Mar-Apr 2030 (end of Year 3 / midterm)', () => {
    expect(turnToDate(18)).toEqual({ startMonth: 3, startYear: 2030, endMonth: 4, endYear: 2030 })
  })

  it('turn 30 is Mar-Apr 2032 (mandate end)', () => {
    expect(turnToDate(30)).toEqual({ startMonth: 3, startYear: 2032, endMonth: 4, endYear: 2032 })
  })

  it('every turn from 1 to 30 has a consistent, strictly advancing 2-month span with no gaps or overlaps', () => {
    let previousEndYear = 2027
    let previousEndMonth = 4 // April — one month before turn 1's start (May)
    for (let turn = 1; turn <= MANDATE_TURNS; turn++) {
      const { startMonth, startYear, endMonth, endYear } = turnToDate(turn)
      // Start must be exactly one month after the previous turn's end.
      const expectedStartMonth = (previousEndMonth % 12) + 1
      const expectedStartYear = previousEndMonth === 12 ? previousEndYear + 1 : previousEndYear
      expect(startMonth).toBe(expectedStartMonth)
      expect(startYear).toBe(expectedStartYear)
      // End must be exactly one month after start.
      const expectedEndMonth = (startMonth % 12) + 1
      const expectedEndYear = startMonth === 12 ? startYear + 1 : startYear
      expect(endMonth).toBe(expectedEndMonth)
      expect(endYear).toBe(expectedEndYear)
      previousEndMonth = endMonth
      previousEndYear = endYear
    }
  })
})

describe('formatTurnPeriod', () => {
  it('formats a same-year span as "Mois–Mois Année"', () => {
    expect(formatTurnPeriod(1)).toBe('Mai–Juin 2027')
  })

  it('every turn boundary in this calendar lands on an even month, so no single turn ever crosses a year within its own span — verified across the whole mandate', () => {
    for (let turn = 1; turn <= 30; turn++) {
      const { startYear, endYear } = turnToDate(turn)
      expect(endYear).toBe(startYear)
    }
    expect(formatTurnPeriod(4)).toBe('Novembre–Décembre 2027')
    expect(formatTurnPeriod(5)).toBe('Janvier–Février 2028')
  })
})

describe('turnToGameplayYear', () => {
  it('turns 1-6 are Year 1, 7-12 are Year 2, ..., 25-30 are Year 5', () => {
    const expectations: [number, number][] = [
      [1, 1], [6, 1], [7, 2], [12, 2], [13, 3], [18, 3], [19, 4], [24, 4], [25, 5], [30, 5],
    ]
    for (const [turn, year] of expectations) {
      expect(turnToGameplayYear(turn)).toBe(year)
    }
  })
})

describe('isYearStartTurn / isYearEndTurn', () => {
  it('exactly turns 1, 7, 13, 19, 25 are year-start turns', () => {
    const starts = Array.from({ length: MANDATE_TURNS }, (_, i) => i + 1).filter(isYearStartTurn)
    expect(starts).toEqual([1, 7, 13, 19, 25])
  })

  it('exactly turns 6, 12, 18, 24, 30 are year-end turns', () => {
    const ends = Array.from({ length: MANDATE_TURNS }, (_, i) => i + 1).filter(isYearEndTurn)
    expect(ends).toEqual([6, 12, 18, 24, 30])
  })
})

describe('isMidtermTurn / isMandateEndTurn', () => {
  it('turn 18 (end of Year 3) is the sole midterm turn', () => {
    expect(MIDTERM_TURN).toBe(18)
    const midterms = Array.from({ length: MANDATE_TURNS }, (_, i) => i + 1).filter(isMidtermTurn)
    expect(midterms).toEqual([18])
  })

  it('turn 30 is the sole mandate-end turn', () => {
    const ends = Array.from({ length: MANDATE_TURNS }, (_, i) => i + 1).filter(isMandateEndTurn)
    expect(ends).toEqual([30])
  })
})

describe('budgetLabelForYearStartTurn', () => {
  it('labels Year 1-5 budgets 2028 through 2032', () => {
    expect(budgetLabelForYearStartTurn(1)).toBe('Budget 2028')
    expect(budgetLabelForYearStartTurn(7)).toBe('Budget 2029')
    expect(budgetLabelForYearStartTurn(13)).toBe('Budget 2030')
    expect(budgetLabelForYearStartTurn(19)).toBe('Budget 2031')
    expect(budgetLabelForYearStartTurn(25)).toBe('Budget 2032')
  })
})
