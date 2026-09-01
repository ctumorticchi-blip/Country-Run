import { TURNS_PER_YEAR } from '../../../engine/state/calendar.ts'

/**
 * ⚠️ CANONICAL M5 MANDATE CALENDAR (M5 §2). The single source of truth for
 * "what date is turn N" — no screen/component may hardcode a date.
 *
 * The mandate runs May 2027 → May 2032, 30 turns of `TURNS_PER_YEAR` (6,
 * engine/state/calendar.ts) 2-month turns each. Turn 1 = May-Jun 2027;
 * turn 30 = Mar-Apr 2032; "mandate conclusion" (May 2032) is the moment
 * AFTER turn 30, not itself a turn.
 *
 * "Gameplay year" here means a 6-turn block starting turn 1 (Year 1 =
 * turns 1-6, spanning May 2027 → Apr 2028), not a calendar year — M5 §3's
 * year-by-year narrative (onboarding, full governing year, midterm...) is
 * flavor/event-weighting guidance keyed to this block structure, not a
 * strict calendar-year alignment (see docs/MANDATE_M5.md).
 */
export const MANDATE_YEARS = 5
export const MANDATE_TURNS = TURNS_PER_YEAR * MANDATE_YEARS

export const MANDATE_START_YEAR = 2027
export const MANDATE_START_MONTH = 5 // May
export const MANDATE_END_LABEL = 'Mai 2032'

const MONTH_LABELS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export interface TurnDate {
  /** The turn's first month, 1-12. */
  startMonth: number
  startYear: number
  /** The turn's second (last) month, 1-12. */
  endMonth: number
  endYear: number
}

/** The calendar month/year pair a given turn's 2-month span starts and ends on. Turn 1 = May-Jun 2027. */
export function turnToDate(turn: number): TurnDate {
  const totalMonthsFromStart = (turn - 1) * 2
  const startMonthIndex = (MANDATE_START_MONTH - 1 + totalMonthsFromStart) % 12
  const startYear = MANDATE_START_YEAR + Math.floor((MANDATE_START_MONTH - 1 + totalMonthsFromStart) / 12)
  const endMonthIndex = (startMonthIndex + 1) % 12
  const endYear = startMonthIndex === 11 ? startYear + 1 : startYear
  return { startMonth: startMonthIndex + 1, startYear, endMonth: endMonthIndex + 1, endYear }
}

/** e.g. "Mai–Juin 2027", or "Décembre 2027 – Janvier 2028" across a year boundary. */
export function formatTurnPeriod(turn: number): string {
  const { startMonth, startYear, endMonth, endYear } = turnToDate(turn)
  const start = MONTH_LABELS_FR[startMonth - 1]
  const end = MONTH_LABELS_FR[endMonth - 1]
  if (startYear === endYear) return `${start}–${end} ${String(startYear)}`
  return `${start} ${String(startYear)} – ${end} ${String(endYear)}`
}

/** 1-indexed gameplay year for a turn: turns 1-6 => year 1, 7-12 => year 2, etc. */
export function turnToGameplayYear(turn: number): number {
  return Math.ceil(turn / TURNS_PER_YEAR)
}

/** True for the LAST turn of a gameplay year (6, 12, 18, 24, 30) — when the year review fires. */
export function isYearEndTurn(turn: number): boolean {
  return turn % TURNS_PER_YEAR === 0
}

/** True for the first turn of a gameplay year (1, 7, 13, 19, 25) — when that year's budget cycle begins. */
export function isYearStartTurn(turn: number): boolean {
  return turn % TURNS_PER_YEAR === 1
}

export const MIDTERM_TURN = 18 // end of gameplay Year 3 — M5 §48
export const MANDATE_END_TURN = MANDATE_TURNS // 30

export function isMidtermTurn(turn: number): boolean {
  return turn === MIDTERM_TURN
}

export function isMandateEndTurn(turn: number): boolean {
  return turn === MANDATE_END_TURN
}

/** The budget cycle's label for the gameplay year STARTING at `turn` (M5 §28: "Budget 2028" prepared at the mandate's very first turn, one per following year). */
export function budgetLabelForYearStartTurn(turn: number): string {
  const gameplayYear = turnToGameplayYear(turn)
  return `Budget ${String(MANDATE_START_YEAR + gameplayYear)}`
}
