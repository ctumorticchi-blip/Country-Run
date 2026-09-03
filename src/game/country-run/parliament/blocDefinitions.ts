import type { ParliamentBlocDefinition } from './blocTypes.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M4 §2-4). 7 entirely fictional blocs — no real
 * French party is named or implied. Every affinity/reliability/weight
 * number is a gameplay-design choice, not sourced political science.
 *
 * `PRESIDENTIAL_BLOC` is the player's own coalition: it always votes with
 * the government (see `parliament/supportEstimate.ts`), so its
 * `policyAffinity` is intentionally flat/unused — it exists here mainly so
 * every bloc id shown to the player resolves through the same lookup.
 */
export const PARLIAMENT_BLOC_DEFINITIONS: ParliamentBlocDefinition[] = [
  {
    id: 'PRESIDENTIAL_BLOC',
    name: 'Majorité Présidentielle',
    shortName: 'Majorité',
    description: 'Votre propre coalition — elle vous suit par défaut.',
    policyAffinity: {},
    negotiationStyle: 'LOYAL',
    reliability: 1,
    baseGovernmentSupport: 1,
    redLines: [],
    preferredConcessions: [],
    politicalTags: [],
    seatWeight: 0,
  },
  {
    id: 'REFORM_CENTER',
    name: 'Centre Réformateur',
    shortName: 'Centre',
    description: 'Pragmatiques, favorables à la réforme si les comptes restent tenus.',
    policyAffinity: {
      publicSpending: -0.1,
      fiscalDiscipline: 0.5,
      businessTax: -0.2,
      householdTax: -0.1,
      environment: 0.2,
      health: 0.3,
      education: 0.3,
      defense: 0.2,
      pensions: 0,
      housing: 0.2,
      laborMarket: 0.4,
      publicInvestment: 0.3,
    },
    negotiationStyle: 'TRANSACTIONAL',
    reliability: 0.8,
    baseGovernmentSupport: 0.3,
    // M6.5 §13 audit note: a hard redLine on `businessTax` was considered here (brief's "business-tax
    // increases" example) but `hitsRedLine` (supportEstimate.ts) fires on a dimension value <= -0.5 for
    // EVERY dimension — correct for "cuts to a good thing" dimensions (pensions/health/environment/
    // defense), but WRONG for `businessTax`/`householdTax` (where -1 means "cuts that tax", the
    // opposite of what a pro-business bloc would object to). Generalizing `hitsRedLine` to be
    // per-dimension-direction-aware would risk changing the already-tested NATIONAL_POPULISTS/
    // householdTax red line's behavior. Business-tax-increase aversion is instead carried by this
    // bloc's own (M6.5-strengthened, see supportEstimate.ts's `base` weighting) continuous
    // `policyAffinity.businessTax` — real and meaningful, just not a hard cap.
    redLines: [],
    preferredConcessions: ['REDUCE_SPENDING_CAP', 'CUT_BUSINESS_TAX'],
    politicalTags: ['reform', 'fiscalDiscipline'],
    seatWeight: 1.1,
  },
  {
    id: 'SOCIAL_LEFT',
    name: 'Gauche Sociale',
    shortName: 'Sociaux',
    description: 'Défendent la dépense sociale, les services publics et les retraites.',
    policyAffinity: {
      publicSpending: 0.8,
      fiscalDiscipline: -0.5,
      businessTax: 0.5,
      householdTax: -0.2,
      environment: 0.4,
      health: 0.7,
      education: 0.6,
      defense: -0.2,
      pensions: 0.6,
      housing: 0.5,
      laborMarket: -0.4,
      publicInvestment: 0.5,
    },
    negotiationStyle: 'PRINCIPLED',
    reliability: 0.7,
    baseGovernmentSupport: -0.1,
    redLines: ['pensions', 'health'],
    preferredConcessions: ['INCREASE_HEALTH_FUNDING', 'INCREASE_HOUSING_FUNDING'],
    politicalTags: ['socialProtection'],
    seatWeight: 1.0,
  },
  {
    id: 'ECOLOGISTS',
    name: 'Écologistes',
    shortName: 'Écologistes',
    description: 'Priorité à la transition environnementale et à l’investissement d’avenir.',
    policyAffinity: {
      publicSpending: 0.4,
      fiscalDiscipline: -0.2,
      businessTax: 0.3,
      householdTax: 0,
      environment: 0.9,
      health: 0.3,
      education: 0.4,
      defense: -0.3,
      pensions: 0.2,
      housing: 0.3,
      laborMarket: 0.2,
      publicInvestment: 0.6,
    },
    negotiationStyle: 'PRINCIPLED',
    reliability: 0.65,
    baseGovernmentSupport: -0.15,
    redLines: ['environment'],
    preferredConcessions: ['INCREASE_GREEN_INVESTMENT'],
    politicalTags: ['environment', 'investment'],
    seatWeight: 0.6,
  },
  {
    id: 'CONSERVATIVE_RIGHT',
    name: 'Droite Conservatrice',
    shortName: 'Droite',
    description: 'Discipline budgétaire, baisse des charges, fermeté régalienne.',
    policyAffinity: {
      publicSpending: -0.5,
      fiscalDiscipline: 0.7,
      businessTax: -0.5,
      householdTax: -0.3,
      environment: -0.1,
      health: 0,
      education: 0,
      defense: 0.6,
      pensions: 0.1,
      housing: 0,
      laborMarket: 0.4,
      publicInvestment: -0.1,
    },
    negotiationStyle: 'TRANSACTIONAL',
    reliability: 0.75,
    baseGovernmentSupport: 0.1,
    // M6.5 §13: fiscalDiscipline (large deficits) was already a red line — defense cuts added, this bloc's own example from the brief and directionally safe (defense follows the standard "+1 = more" convention, unlike the tax dimensions — see the REFORM_CENTER comment above).
    redLines: ['fiscalDiscipline', 'defense'],
    preferredConcessions: ['CUT_BUSINESS_TAX', 'REDUCE_SPENDING_CAP'],
    politicalTags: ['fiscalDiscipline', 'security'],
    seatWeight: 1.0,
  },
  {
    id: 'NATIONAL_POPULISTS',
    name: 'Populistes Nationaux',
    shortName: 'Populistes',
    description: 'Protection du pouvoir d’achat et des retraites, hostiles par défaut au pouvoir en place.',
    policyAffinity: {
      publicSpending: 0.3,
      fiscalDiscipline: -0.2,
      businessTax: 0.2,
      householdTax: -0.5,
      environment: -0.4,
      health: 0.2,
      education: -0.1,
      defense: 0.3,
      pensions: 0.7,
      housing: 0.2,
      laborMarket: -0.2,
      publicInvestment: -0.3,
    },
    negotiationStyle: 'OPPORTUNISTIC',
    reliability: 0.5,
    baseGovernmentSupport: -0.4,
    redLines: ['householdTax', 'pensions'],
    preferredConcessions: ['REDUCE_SPENDING_CAP', 'INCREASE_TERRITORIAL_SUPPORT'],
    politicalTags: ['socialProtection', 'security'],
    seatWeight: 0.9,
  },
  {
    id: 'NON_ATTACHED',
    name: 'Non-Inscrits',
    shortName: 'Non-Inscrits',
    description: 'Élus isolés, sans ligne commune — leur vote est le plus volatile.',
    policyAffinity: {
      publicSpending: 0.1,
      fiscalDiscipline: 0.1,
      businessTax: 0,
      householdTax: 0,
      environment: 0.1,
      health: 0.1,
      education: 0.1,
      defense: 0,
      pensions: 0.1,
      housing: 0.1,
      laborMarket: 0,
      publicInvestment: 0.1,
    },
    negotiationStyle: 'OPPORTUNISTIC',
    reliability: 0.4,
    baseGovernmentSupport: 0.15,
    redLines: [],
    preferredConcessions: ['INCREASE_TERRITORIAL_SUPPORT'],
    politicalTags: [],
    seatWeight: 0.25,
  },
]

export function getBlocDefinition(id: string): ParliamentBlocDefinition {
  const bloc = PARLIAMENT_BLOC_DEFINITIONS.find((b) => b.id === id)
  if (!bloc) throw new Error(`Unknown parliament bloc: ${id}`)
  return bloc
}

/** Every bloc except the player's own coalition — the ones seats are actually split across in `parliamentComposition.ts`. */
export const OPPOSITION_BLOC_DEFINITIONS = PARLIAMENT_BLOC_DEFINITIONS.filter((b) => b.id !== 'PRESIDENTIAL_BLOC')
