import { TURNS_PER_YEAR } from '../state/calendar.ts'

/**
 * Two distinct turn-scaling conversions are used throughout the Economic
 * Engine — mixing them up is exactly the "applying a full annual rate every
 * 2-month turn" bug the engine must avoid (Product Bible §6). Both are
 * exercised directly by tests (annualization.test.ts) precisely so that bug
 * class is caught immediately if it's ever reintroduced.
 *
 * 1. `annualPercentToPerTurnFraction` — for compounding a LEVEL (GDP,
 *    revenue, spending) by a percentage growth RATE. A rate of `g`% per
 *    year does not mean multiplying the level by `(1 + g/100)` every turn —
 *    that would compound the full annual rate 6 times a year. Instead this
 *    returns the linear per-turn share of that rate, as a fraction ready to
 *    multiply a level by `(1 + fraction)`.
 *
 * 2. `annualRateToPerTurnRate` — for accumulating a percentage-POINT INDEX
 *    (e.g. `purchasingPower`) by a percentage-point annual rate. Both sides
 *    are already in "percent" units, so this only divides by the number of
 *    turns per year — no `/100` involved, unlike (1).
 *
 * Both use a simple linear (not compounding) approximation of "1/6th of the
 * year's rate per turn". That's intentionally not compounding-exact — this
 * is a gameplay model, not a financial calculator — but it is small,
 * predictable, and the same convention is used everywhere in the engine.
 */

/**
 * Converts an annualized percentage growth rate (e.g. `2.4` meaning
 * 2.4%/year) into the fractional multiplier for ONE turn, e.g. for
 * `nextLevel = level * (1 + annualPercentToPerTurnFraction(rate))`.
 */
export function annualPercentToPerTurnFraction(annualPercent: number): number {
  return annualPercent / 100 / TURNS_PER_YEAR
}

/**
 * Converts an annualized percentage-point rate into the per-turn
 * percentage-point increment, e.g. for accumulating an index via
 * `nextIndex = index + annualRateToPerTurnRate(annualPercent)`.
 */
export function annualRateToPerTurnRate(annualPercent: number): number {
  return annualPercent / TURNS_PER_YEAR
}

/**
 * Converts an annualized Md€/year flow into the Md€ slice that actually
 * elapses in one turn — used for stock accumulation (e.g. the debt stock
 * only accumulates 1/6th of the annual deficit per turn), never for
 * updating another annualized run-rate figure (those flow deltas apply to
 * the run-rate directly and in full — see docs/ECONOMIC_ENGINE.md).
 */
export function annualFlowToPerTurnFlow(annualFlow: number): number {
  return annualFlow / TURNS_PER_YEAR
}
