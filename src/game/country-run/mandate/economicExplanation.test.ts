import { describe, expect, it } from 'vitest'
import type { EconomicDiagnostics } from '../../../engine/economy/types.ts'
import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'
import { explainGrowthChange, explainInflationChange, explainUnemploymentChange } from './economicExplanation.ts'

function diagnostics(overrides: Partial<EconomicDiagnostics> = {}): EconomicDiagnostics {
  return {
    growthContributions: {
      potentialGrowth: 0,
      fiscalImpulse: 0,
      externalEffect: 0,
      confidenceEffect: 0,
      productivityEffect: 0,
      crisisEffect: 0,
      noise: 0,
    },
    inflationContributions: { inertia: 0, demandPressure: 0, external: 0, energy: 0, tax: 0, noise: 0 },
    confidenceContributions: { consumer: 0, business: 0, market: 0 },
    revenueSurprise: 0,
    interestRateChange: 0,
    unemploymentChange: 0,
    ...overrides,
  }
}

describe('explainGrowthChange (M5 §14 — CE QUI A CHANGÉ)', () => {
  it('a single dominant contribution is the sole primary driver with HIGH confidence', () => {
    const d = diagnostics({ growthContributions: { potentialGrowth: 1.2, fiscalImpulse: 0, externalEffect: 0, confidenceEffect: 0, productivityEffect: 0, crisisEffect: 0, noise: 0.05 } })
    const explanation = explainGrowthChange(1.0, 1.3, d, [], 5)
    expect(explanation.indicator).toBe('growth')
    expect(explanation.primaryDrivers).toEqual(['Croissance potentielle de l’économie'])
    expect(explanation.confidence).toBe('HIGH')
  })

  it('a purely noise-driven change never names noise as a primary driver, and confidence is LOW', () => {
    const d = diagnostics({ growthContributions: { potentialGrowth: 0, fiscalImpulse: 0, externalEffect: 0, confidenceEffect: 0, productivityEffect: 0, crisisEffect: 0, noise: 0.4 } })
    const explanation = explainGrowthChange(1.0, 1.4, d, [], 5)
    expect(explanation.primaryDrivers).toEqual([])
    expect(explanation.confidence).toBe('LOW')
  })

  it('multiple meaningful contributions produce both primary and secondary drivers', () => {
    const d = diagnostics({ growthContributions: { potentialGrowth: 0.6, fiscalImpulse: 0.4, externalEffect: 0, confidenceEffect: 0, productivityEffect: 0, crisisEffect: 0, noise: 0.05 } })
    const explanation = explainGrowthChange(1.0, 2.0, d, [], 5)
    expect(explanation.primaryDrivers).toEqual(['Croissance potentielle de l’économie'])
    expect(explanation.secondaryDrivers).toEqual(['Impact de la politique budgétaire'])
  })

  it('a policy decision recorded this turn is always surfaced as a driver, ahead of diagnostics ranking', () => {
    const d = diagnostics({ growthContributions: { potentialGrowth: 1, fiscalImpulse: 0, externalEffect: 0, confidenceEffect: 0, productivityEffect: 0, crisisEffect: 0, noise: 0 } })
    const history: PolicyHistoryEntry[] = [{ turn: 5, sourceId: 'budget:health', label: 'Budget 2029 — Santé', category: 'health', amount: 10 }]
    const explanation = explainGrowthChange(1.0, 1.5, d, history, 5)
    expect(explanation.primaryDrivers[0]).toBe('Budget 2029 — Santé')
  })

  it('a zero-contribution diagnostics reports LOW confidence and no drivers', () => {
    const explanation = explainGrowthChange(1.0, 1.0, diagnostics(), [], 5)
    expect(explanation.primaryDrivers).toEqual([])
    expect(explanation.confidence).toBe('LOW')
  })
})

describe('explainInflationChange', () => {
  it('ranks energy as the primary driver when it dominates', () => {
    const d = diagnostics({ inflationContributions: { inertia: 0.1, demandPressure: 0, external: 0, energy: 0.9, tax: 0, noise: 0 } })
    const explanation = explainInflationChange(2.0, 3.0, d)
    expect(explanation.indicator).toBe('inflation')
    expect(explanation.primaryDrivers).toEqual(['Prix de l’énergie'])
    expect(explanation.confidence).toBe('HIGH')
  })
})

describe('explainUnemploymentChange', () => {
  it('surfaces a labor-market policy decision recorded this turn as the primary driver', () => {
    const history: PolicyHistoryEntry[] = [{ turn: 5, sourceId: 'bill:labor-market-reform-bill', label: 'Réforme du marché du travail' }]
    const explanation = explainUnemploymentChange(7.5, 7.2, diagnostics({ unemploymentChange: -0.3 }), history, 5)
    expect(explanation.primaryDrivers).toEqual(['Réforme du marché du travail'])
    expect(explanation.confidence).toBe('MEDIUM')
  })

  it('falls back to a generic activity-driven explanation when growth moved but no policy was recorded this turn', () => {
    const d = diagnostics({
      growthContributions: { potentialGrowth: 1, fiscalImpulse: 0, externalEffect: 0, confidenceEffect: 0, productivityEffect: 0, crisisEffect: 0, noise: 0 },
      unemploymentChange: -0.2,
    })
    const explanation = explainUnemploymentChange(7.5, 7.3, d, [], 5)
    expect(explanation.primaryDrivers).toEqual(['Dynamique de l’activité économique'])
  })

  it('reports no drivers and LOW confidence when nothing explains a change', () => {
    const explanation = explainUnemploymentChange(7.5, 7.5, diagnostics(), [], 5)
    expect(explanation.primaryDrivers).toEqual([])
    expect(explanation.confidence).toBe('LOW')
  })
})
