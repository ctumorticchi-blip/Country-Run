import { describe, expect, it } from 'vitest'
import { annualFlowToPerTurnFlow, annualPercentToPerTurnFraction, annualRateToPerTurnRate } from './annualization.ts'

describe('annualPercentToPerTurnFraction', () => {
  it('divides an annual percentage rate into 6 equal per-turn fractions', () => {
    const fraction = annualPercentToPerTurnFraction(6)
    expect(fraction).toBeCloseTo(0.01) // 6% / 100 / 6 turns = 0.01 per turn
  })

  it('does NOT apply the full annual rate in one turn', () => {
    const level = 1000
    const annualPercent = 12 // a deliberately large rate to make the bug obvious if reintroduced
    const next = level * (1 + annualPercentToPerTurnFraction(annualPercent))
    // The full annual rate would take level to 1120; one turn's worth must land far short of that.
    expect(next).toBeLessThan(1021)
    expect(next).toBeGreaterThan(1019)
  })

  it('compounding one full year of turns approximates (not equals) the annual rate', () => {
    const annualPercent = 6
    let level = 1000
    for (let i = 0; i < 6; i++) {
      level *= 1 + annualPercentToPerTurnFraction(annualPercent)
    }
    // Linear-per-turn compounding over a year lands close to, but not exactly
    // equal to, simple annual growth (1060) — compounding effects diverge slightly.
    expect(level).toBeGreaterThan(1059)
    expect(level).toBeLessThan(1063)
  })
})

describe('annualRateToPerTurnRate', () => {
  it('divides an annual percentage-point rate by the number of turns per year', () => {
    expect(annualRateToPerTurnRate(6)).toBeCloseTo(1)
  })

  it('has no /100 scaling, unlike annualPercentToPerTurnFraction', () => {
    expect(annualRateToPerTurnRate(12)).toBeCloseTo(2)
  })
})

describe('annualFlowToPerTurnFlow', () => {
  it('divides an annualized Md€ flow into 6 equal per-turn slices', () => {
    expect(annualFlowToPerTurnFlow(120)).toBeCloseTo(20)
  })

  it('accumulating 6 turns of the per-turn slice reconstructs the annual flow', () => {
    const annual = 90
    const perTurn = annualFlowToPerTurnFlow(annual)
    expect(perTurn * 6).toBeCloseTo(annual)
  })
})
