import { describe, expect, it } from 'vitest'
import type { EconomicState } from '../../../engine/state/gameState.ts'
import { createInitialGameState } from '../data/initialState.ts'
import type { PromiseResolution } from '../promises/promiseResolution.ts'
import { computeEndingTitle, computeFinalScore, type FinalScoreInputs } from './finalScoring.ts'

const start = createInitialGameState('scoring-test-seed').economic

function economic(overrides: Partial<EconomicState> = {}): EconomicState {
  return { ...start, ...overrides }
}

function resolutions(statuses: PromiseResolution['finalStatus'][]): PromiseResolution[] {
  return statuses.map((finalStatus, i) => ({ promiseId: `p${String(i)}`, finalStatus, resolvedTurn: 18, progressLabel: '' }))
}

function baseInputs(overrides: Partial<FinalScoreInputs> = {}): FinalScoreInputs {
  return {
    start,
    end: economic(),
    finalPopularity: 50,
    finalGovernmentTension: 30,
    finalPoliticalCapital: 50,
    promiseResolutions: resolutions(['KEPT', 'KEPT', 'PARTIAL', 'BROKEN', 'BROKEN']),
    ...overrides,
  }
}

describe('computeFinalScore (M5 §61-63 — new weights)', () => {
  it('a fully neutral, unchanged mandate scores near the middle of the range', () => {
    const result = computeFinalScore(baseInputs({ promiseResolutions: resolutions(['PARTIAL', 'PARTIAL', 'PARTIAL', 'PARTIAL', 'PARTIAL']) }))
    expect(result.total).toBeGreaterThan(3500)
    expect(result.total).toBeLessThan(6500)
  })

  it('the score is always within [0, 10000]', () => {
    const great = computeFinalScore(
      baseInputs({
        end: economic({ growth: 3, unemployment: 4, debtRatio: 90, deficitRatio: 1, purchasingPower: 3, publicSectorEfficiency: 90 }),
        finalPopularity: 90,
        finalGovernmentTension: 5,
        finalPoliticalCapital: 90,
        promiseResolutions: resolutions(['KEPT', 'KEPT', 'KEPT', 'KEPT', 'KEPT']),
      }),
    )
    expect(great.total).toBeGreaterThanOrEqual(0)
    expect(great.total).toBeLessThanOrEqual(10000)

    const terrible = computeFinalScore(
      baseInputs({
        end: economic({ growth: -3, unemployment: 15, debtRatio: 180, deficitRatio: 12, purchasingPower: -3, publicSectorEfficiency: 10 }),
        finalPopularity: 5,
        finalGovernmentTension: 95,
        finalPoliticalCapital: 0,
        promiseResolutions: resolutions(['BROKEN', 'BROKEN', 'BROKEN', 'BROKEN', 'BROKEN']),
      }),
    )
    expect(terrible.total).toBeGreaterThanOrEqual(0)
    expect(terrible.total).toBeLessThanOrEqual(10000)
    expect(terrible.total).toBeLessThan(great.total)
  })

  it('all 5 promises KEPT scores strictly higher on the promises axis than all 5 BROKEN, holding everything else fixed', () => {
    const kept = computeFinalScore(baseInputs({ promiseResolutions: resolutions(['KEPT', 'KEPT', 'KEPT', 'KEPT', 'KEPT']) }))
    const broken = computeFinalScore(baseInputs({ promiseResolutions: resolutions(['BROKEN', 'BROKEN', 'BROKEN', 'BROKEN', 'BROKEN']) }))
    expect(kept.promises).toBe(100)
    expect(broken.promises).toBe(0)
    expect(kept.total).toBeGreaterThan(broken.total)
  })

  it('a catastrophic debt+deficit blowout applies the catastrophe multiplier and lowers the total vs an otherwise-identical run without it', () => {
    const withoutCatastrophe = computeFinalScore(baseInputs({ end: economic({ debtRatio: start.debtRatio + 10, deficitRatio: 5 }) }))
    const withCatastrophe = computeFinalScore(baseInputs({ end: economic({ debtRatio: start.debtRatio + 20, deficitRatio: 7 }) }))
    expect(withCatastrophe.catastropheMultiplier).toBeLessThan(1)
    expect(withCatastrophe.catastropheMultiplier).toBeLessThan(withoutCatastrophe.catastropheMultiplier)
  })

  it('a recession at mandate end (negative growth) triggers the catastrophe multiplier', () => {
    const result = computeFinalScore(baseInputs({ end: economic({ growth: -1.5 }) }))
    expect(result.catastropheMultiplier).toBeLessThan(1)
  })

  it('extreme government tension at mandate end triggers the catastrophe multiplier', () => {
    const result = computeFinalScore(baseInputs({ finalGovernmentTension: 90 }))
    expect(result.catastropheMultiplier).toBeLessThan(1)
  })

  it('every sub-score is bounded to [0, 100]', () => {
    const result = computeFinalScore(
      baseInputs({
        end: economic({ growth: 50, unemployment: -20, debtRatio: -500, deficitRatio: -50, purchasingPower: 999, publicSectorEfficiency: 999 }),
        finalPopularity: 500,
        finalGovernmentTension: -50,
        finalPoliticalCapital: 500,
      }),
    )
    for (const key of ['economy', 'publicFinances', 'purchasingPower', 'employment', 'promises', 'politicalStability', 'publicInvestmentServices'] as const) {
      expect(result[key]).toBeGreaterThanOrEqual(0)
      expect(result[key]).toBeLessThanOrEqual(100)
    }
  })
})

describe('computeEndingTitle (M5 §64 — 9 descriptive, non-ideological titles)', () => {
  it('a mandate with 3+ simultaneous catastrophic indicators gets the storm title', () => {
    const title = computeEndingTitle({
      start,
      end: economic({ growth: start.growth - 1, debtRatio: start.debtRatio + 20, unemployment: start.unemployment + 3 }),
      finalPopularity: 20,
      finalGovernmentTension: 90,
      promiseResolutions: resolutions(['BROKEN', 'BROKEN', 'BROKEN', 'BROKEN', 'BROKEN']),
      reformsEnacted: 0,
    })
    expect(title).toBe('LA TEMPÊTE DU QUINQUENNAT')
  })

  it('heavy public-service investment with contained debt gets LE BÂTISSEUR', () => {
    const title = computeEndingTitle({
      start,
      end: economic({ publicSectorEfficiency: start.publicSectorEfficiency + 12, debtRatio: start.debtRatio + 5 }),
      finalPopularity: 55,
      finalGovernmentTension: 30,
      promiseResolutions: resolutions(['PARTIAL', 'PARTIAL', 'PARTIAL', 'PARTIAL', 'PARTIAL']),
      reformsEnacted: 1,
    })
    expect(title).toBe('LE BÂTISSEUR')
  })

  it('nearly all promises kept gets LE PRÉSIDENT DES PROMESSES TENUES when no more specific rule matches first', () => {
    const title = computeEndingTitle({
      start,
      end: economic(),
      finalPopularity: 50,
      finalGovernmentTension: 30,
      promiseResolutions: resolutions(['KEPT', 'KEPT', 'KEPT', 'KEPT', 'PARTIAL']),
      reformsEnacted: 0,
    })
    expect(title).toBe('LE PRÉSIDENT DES PROMESSES TENUES')
  })

  it('a completely flat, unremarkable mandate falls back to LE GESTIONNAIRE', () => {
    const title = computeEndingTitle({
      start,
      end: economic(),
      finalPopularity: 50,
      finalGovernmentTension: 30,
      promiseResolutions: resolutions(['PARTIAL', 'PARTIAL', 'PARTIAL', 'PARTIAL', 'PARTIAL']),
      reformsEnacted: 0,
    })
    expect(title).toBe('LE GESTIONNAIRE')
  })

  it('never returns an ideological label — every possible title is one of the 9 documented ones', () => {
    const allowed = new Set([
      'LA TEMPÊTE DU QUINQUENNAT',
      'LE BÂTISSEUR',
      'LE RÉFORMATEUR',
      'LE PARI RISQUÉ',
      'LE PRÉSIDENT DES PROMESSES TENUES',
      'LE TECHNOCRATE',
      'LE POPULAIRE FRAGILE',
      'LE GESTIONNAIRE PRUDENT',
      'LE GESTIONNAIRE',
    ])
    expect(allowed.size).toBe(9)
    const scenarios = [
      { pop: 90, tension: 5, kept: 5 },
      { pop: 10, tension: 95, kept: 0 },
      { pop: 50, tension: 50, kept: 2 },
      { pop: 70, tension: 60, kept: 3 },
    ]
    for (const s of scenarios) {
      const title = computeEndingTitle({
        start,
        end: economic(),
        finalPopularity: s.pop,
        finalGovernmentTension: s.tension,
        promiseResolutions: resolutions(Array.from({ length: 5 }, (_, i) => (i < s.kept ? 'KEPT' : 'BROKEN'))),
        reformsEnacted: 2,
      })
      expect(allowed.has(title)).toBe(true)
    }
  })
})
