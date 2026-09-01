import { describe, expect, it } from 'vitest'
import { getGovernmentProfile } from '../government/governmentProfiles.ts'
import type { GovernmentModifiers } from '../government/governmentTypes.ts'
import type { ParliamentComposition } from '../prototype/parliamentComposition.ts'
import { getBlocDefinition } from './blocDefinitions.ts'
import { applyConcessionsToBill } from './concessions.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'
import { classifyStance, computeBlocSupportProbability, estimateBillSupport } from './supportEstimate.ts'

const NEUTRAL: GovernmentModifiers = {
  economicExecution: 1,
  fiscalForecastAccuracy: 1,
  reformEffectiveness: 1,
  parliamentNegotiation: 1,
  popularityResilience: 1,
  marketCredibility: 1,
  implementationSpeed: 1,
}

const COMPOSITION: ParliamentComposition = {
  playerSeats: 260,
  majorityOutcome: 'MAJORITÉ_RELATIVE',
  blocs: [
    { id: 'PRESIDENTIAL_BLOC', name: 'Majorité', seats: 260, isPlayerCoalition: true, affinityTags: [] },
    { id: 'REFORM_CENTER', name: 'Centre', seats: 90, isPlayerCoalition: false, affinityTags: [] },
    { id: 'SOCIAL_LEFT', name: 'Sociaux', seats: 80, isPlayerCoalition: false, affinityTags: [] },
    { id: 'ECOLOGISTS', name: 'Écolos', seats: 40, isPlayerCoalition: false, affinityTags: [] },
    { id: 'CONSERVATIVE_RIGHT', name: 'Droite', seats: 60, isPlayerCoalition: false, affinityTags: [] },
    { id: 'NATIONAL_POPULISTS', name: 'Populistes', seats: 37, isPlayerCoalition: false, affinityTags: [] },
    { id: 'NON_ATTACHED', name: 'Non-Inscrits', seats: 10, isPlayerCoalition: false, affinityTags: [] },
  ],
}

const HEALTH_BILL: PoliticalBillDefinition = {
  id: 'health-bill',
  title: 'Health Bill',
  description: '',
  policyTags: { health: 0.9, publicSpending: 0.4 },
  economicPolicyEffect: { currentSpendingChanges: 10 },
  fiscalCost: 10,
  reformIntensity: 0.3,
  controversy: 0.15,
  promiseLinks: [],
  requiredPoliticalCapital: 6,
  urgency: 'MEDIUM',
  negotiability: 0.7,
  concessionsAvailable: ['INCREASE_HEALTH_FUNDING'],
  voteThreshold: 289,
  implementationDelay: 1,
}

const TAX_CUT_BILL: PoliticalBillDefinition = {
  id: 'tax-cut-bill',
  title: 'Tax Cut',
  description: '',
  policyTags: { householdTax: -0.9, fiscalDiscipline: -0.3 },
  economicPolicyEffect: { householdTaxImpulse: -5 },
  fiscalCost: 5,
  reformIntensity: 0.4,
  controversy: 0.3,
  promiseLinks: [],
  requiredPoliticalCapital: 8,
  urgency: 'MEDIUM',
  negotiability: 0.5,
  concessionsAvailable: [],
  voteThreshold: 289,
  implementationDelay: 1,
}

describe('computeBlocSupportProbability — bounded [0.03, 0.97]', () => {
  it('never leaves its documented bounds across a spread of blocs and bills', () => {
    const effectiveHealth = applyConcessionsToBill(HEALTH_BILL, [])
    for (const bloc of COMPOSITION.blocs) {
      if (bloc.isPlayerCoalition) continue
      const probability = computeBlocSupportProbability({
        bill: effectiveHealth,
        blocDef: getBlocDefinition(bloc.id),
        relationScore: 0,
        popularity: 50,
        governmentModifiers: NEUTRAL,
        courted: false,
        capitalSpentThisNegotiation: 0,
        promiseLinked: false,
      })
      expect(probability).toBeGreaterThanOrEqual(0.03)
      expect(probability).toBeLessThanOrEqual(0.97)
    }
  })

  it('a bloc red line caps support near-zero regardless of other bonuses', () => {
    // NATIONAL_POPULISTS has householdTax as a red line; TAX_CUT_BILL has householdTax = -0.9 <= -0.5.
    const effective = applyConcessionsToBill(TAX_CUT_BILL, [])
    const probability = computeBlocSupportProbability({
      bill: effective,
      blocDef: getBlocDefinition('NATIONAL_POPULISTS'),
      relationScore: 100, // even a maximal relationship shouldn't rescue a red-line bill
      popularity: 90,
      governmentModifiers: NEUTRAL,
      courted: true,
      capitalSpentThisNegotiation: 100,
      promiseLinked: true,
    })
    expect(probability).toBeLessThanOrEqual(0.15)
  })

  it('courting, capital, and a positive relationship all increase support relative to a neutral baseline', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const blocDef = getBlocDefinition('CONSERVATIVE_RIGHT')
    const baseline = computeBlocSupportProbability({
      bill: effective,
      blocDef,
      relationScore: 0,
      popularity: 50,
      governmentModifiers: NEUTRAL,
      courted: false,
      capitalSpentThisNegotiation: 0,
      promiseLinked: false,
    })
    const boosted = computeBlocSupportProbability({
      bill: effective,
      blocDef,
      relationScore: 80,
      popularity: 50,
      governmentModifiers: NEUTRAL,
      courted: true,
      capitalSpentThisNegotiation: 20,
      promiseLinked: true,
    })
    expect(boosted).toBeGreaterThan(baseline)
  })

  it('popularity has a modest effect — swinging from 0 to 100 never moves support by more than a few points', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const blocDef = getBlocDefinition('SOCIAL_LEFT')
    const low = computeBlocSupportProbability({
      bill: effective, blocDef, relationScore: 0, popularity: 0, governmentModifiers: NEUTRAL, courted: false, capitalSpentThisNegotiation: 0, promiseLinked: false,
    })
    const high = computeBlocSupportProbability({
      bill: effective, blocDef, relationScore: 0, popularity: 100, governmentModifiers: NEUTRAL, courted: false, capitalSpentThisNegotiation: 0, promiseLinked: false,
    })
    expect(Math.abs(high - low)).toBeLessThanOrEqual(0.101)
  })
})

describe('classifyStance', () => {
  it('covers the full probability range with the 5 documented stances', () => {
    expect(classifyStance(0.9)).toBe('FORTEMENT_FAVORABLE')
    expect(classifyStance(0.6)).toBe('PLUTÔT_FAVORABLE')
    expect(classifyStance(0.5)).toBe('PARTAGÉ')
    expect(classifyStance(0.3)).toBe('PLUTÔT_DÉFAVORABLE')
    expect(classifyStance(0.1)).toBe('FORTEMENT_DÉFAVORABLE')
  })
})

describe('estimateBillSupport — ranges, never a single deterministic number', () => {
  it('every bloc range is non-negative and low <= high', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const support = estimateBillSupport(effective, COMPOSITION, {}, 50, NEUTRAL, null)
    for (const bloc of support.blocBreakdown) {
      expect(bloc.supportRangeLow).toBeGreaterThanOrEqual(0)
      expect(bloc.supportRangeLow).toBeLessThanOrEqual(bloc.supportRangeHigh)
      expect(bloc.supportRangeHigh).toBeLessThanOrEqual(bloc.seats)
    }
  })

  it('likelyTotalLow includes the full presidential bloc plus allies low', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const support = estimateBillSupport(effective, COMPOSITION, {}, 50, NEUTRAL, null)
    expect(support.presidentialSeats).toBe(260)
    expect(support.likelyTotalLow).toBe(260 + support.likelyAlliesLow)
    expect(support.likelyTotalHigh).toBe(260 + support.likelyAlliesHigh)
  })

  it('a promise-linked bill scores at least as well as the same bill without a promise link', () => {
    const linked: PoliticalBillDefinition = { ...HEALTH_BILL, promiseLinks: ['hospital-plan'] }
    const withLink = estimateBillSupport(applyConcessionsToBill(linked, []), COMPOSITION, {}, 50, NEUTRAL, null)
    const withoutLink = estimateBillSupport(applyConcessionsToBill(HEALTH_BILL, []), COMPOSITION, {}, 50, NEUTRAL, null)
    expect(withLink.likelyTotalLow).toBeGreaterThanOrEqual(withoutLink.likelyTotalLow)
  })
})

describe('estimateBillSupport — government modifier integration (M4 §25)', () => {
  it('Les Politiques (high parliamentNegotiation) yields more total support than Les Experts on an identical bill', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const politiques = getGovernmentProfile('politiques').modifiers
    const experts = getGovernmentProfile('experts').modifiers
    const withPolitiques = estimateBillSupport(effective, COMPOSITION, {}, 50, politiques, null)
    const withExperts = estimateBillSupport(effective, COMPOSITION, {}, 50, experts, null)
    expect(withPolitiques.likelyTotalLow).toBeGreaterThan(withExperts.likelyTotalLow)
  })

  it('a higher fiscalForecastAccuracy alone (isolated from Experts’ other modifiers) helps specifically with fiscal-discipline-tagged blocs', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const highAccuracyOnly: GovernmentModifiers = { ...NEUTRAL, fiscalForecastAccuracy: 1.1 }
    const withHighAccuracy = computeBlocSupportProbability({
      bill: effective, blocDef: getBlocDefinition('CONSERVATIVE_RIGHT'), relationScore: 0, popularity: 50, governmentModifiers: highAccuracyOnly, courted: false, capitalSpentThisNegotiation: 0, promiseLinked: false,
    })
    const neutral = computeBlocSupportProbability({
      bill: effective, blocDef: getBlocDefinition('CONSERVATIVE_RIGHT'), relationScore: 0, popularity: 50, governmentModifiers: NEUTRAL, courted: false, capitalSpentThisNegotiation: 0, promiseLinked: false,
    })
    expect(withHighAccuracy).toBeGreaterThan(neutral)

    // A bloc with NO fiscalDiscipline tag (ECOLOGISTS) should be unaffected by the same modifier change.
    const ecoWithAccuracy = computeBlocSupportProbability({
      bill: effective, blocDef: getBlocDefinition('ECOLOGISTS'), relationScore: 0, popularity: 50, governmentModifiers: highAccuracyOnly, courted: false, capitalSpentThisNegotiation: 0, promiseLinked: false,
    })
    const ecoNeutral = computeBlocSupportProbability({
      bill: effective, blocDef: getBlocDefinition('ECOLOGISTS'), relationScore: 0, popularity: 50, governmentModifiers: NEUTRAL, courted: false, capitalSpentThisNegotiation: 0, promiseLinked: false,
    })
    expect(ecoWithAccuracy).toBe(ecoNeutral)
  })
})

describe('estimateBillSupport — majority vs. minority government difficulty (M4 §24)', () => {
  it('an absolute-majority Assembly needs far fewer ally votes to clear the threshold than a fragmented one', () => {
    const effective = applyConcessionsToBill(HEALTH_BILL, [])
    const majorityComposition: ParliamentComposition = {
      ...COMPOSITION,
      playerSeats: 300,
      majorityOutcome: 'MAJORITÉ_ABSOLUE',
      blocs: COMPOSITION.blocs.map((b) => (b.isPlayerCoalition ? { ...b, seats: 300 } : { ...b, seats: b.seats - 7 })), // keep the 577 total
    }
    const fragmentedComposition: ParliamentComposition = {
      ...COMPOSITION,
      playerSeats: 230,
      majorityOutcome: 'ASSEMBLÉE_FRAGMENTÉE',
      blocs: COMPOSITION.blocs.map((b) => (b.isPlayerCoalition ? { ...b, seats: 230 } : { ...b, seats: b.seats + 5 })), // keep the 577 total
    }

    const majoritySupport = estimateBillSupport(effective, majorityComposition, {}, 50, NEUTRAL, null)
    const fragmentedSupport = estimateBillSupport(effective, fragmentedComposition, {}, 50, NEUTRAL, null)

    const majorityAlliesNeeded = Math.max(0, majoritySupport.majorityNeeded - majoritySupport.presidentialSeats)
    const fragmentedAlliesNeeded = Math.max(0, fragmentedSupport.majorityNeeded - fragmentedSupport.presidentialSeats)
    expect(majorityAlliesNeeded).toBeLessThan(fragmentedAlliesNeeded)
    expect(majorityAlliesNeeded).toBe(0) // 300 seats alone already clears 289
  })
})
