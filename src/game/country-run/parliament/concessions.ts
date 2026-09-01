import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import type { ConcessionType, PolicyAffinity, PolicyDimension } from './politicalTypes.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M4 §12, §23). Exactly 6 reusable concession
 * types — deliberately few, applicable to any bill that lists them in
 * `concessionsAvailable`, rather than dozens of bespoke ones.
 *
 * `fiscalDeltaPerYear` is always signed as "Md€/year worse for the
 * deficit" (a spending increase AND a tax cut are both positive here),
 * for a single consistent sign convention across concession types.
 */
export type ConcessionKind = 'POLICY' | 'BUDGET'

export interface ConcessionDefinition {
  id: ConcessionType
  kind: ConcessionKind
  label: string
  description: string
  fiscalDeltaPerYear: number
  economicPolicyEffectDelta: Partial<EconomicPolicyInput>
  policyTagDelta: PolicyAffinity
}

const CONCESSION_LIST: ConcessionDefinition[] = [
  {
    id: 'INCREASE_HOUSING_FUNDING',
    kind: 'BUDGET',
    label: 'Financement du logement',
    description: '+4 Md€/an pour la construction et la rénovation de logements.',
    fiscalDeltaPerYear: 4,
    economicPolicyEffectDelta: { publicInvestmentChanges: 4 },
    policyTagDelta: { housing: 0.4 },
  },
  {
    id: 'INCREASE_HEALTH_FUNDING',
    kind: 'BUDGET',
    label: 'Financement de la santé',
    description: '+5 Md€/an pour les hôpitaux et le personnel soignant.',
    fiscalDeltaPerYear: 5,
    economicPolicyEffectDelta: { currentSpendingChanges: 5 },
    policyTagDelta: { health: 0.4 },
  },
  {
    id: 'INCREASE_GREEN_INVESTMENT',
    kind: 'BUDGET',
    label: 'Investissement vert',
    description: '+4 Md€/an pour la transition environnementale.',
    fiscalDeltaPerYear: 4,
    economicPolicyEffectDelta: { publicInvestmentChanges: 4 },
    policyTagDelta: { environment: 0.5 },
  },
  {
    id: 'INCREASE_TERRITORIAL_SUPPORT',
    kind: 'BUDGET',
    label: 'Soutien aux territoires',
    description: '+3 Md€/an de dotations aux collectivités.',
    fiscalDeltaPerYear: 3,
    economicPolicyEffectDelta: { publicInvestmentChanges: 3 },
    policyTagDelta: { publicSpending: 0.3 },
  },
  {
    id: 'CUT_BUSINESS_TAX',
    kind: 'POLICY',
    label: 'Baisse ciblée de la fiscalité des entreprises',
    description: '-3 Md€/an de recettes, pour rallier les blocs favorables aux entreprises.',
    fiscalDeltaPerYear: 3,
    economicPolicyEffectDelta: { businessTaxImpulse: -3 },
    policyTagDelta: { businessTax: -0.5 },
  },
  {
    id: 'REDUCE_SPENDING_CAP',
    kind: 'POLICY',
    label: 'Plafond de dépenses renforcé',
    description: '-4 Md€/an de dépenses, pour rassurer les blocs soucieux de discipline budgétaire.',
    fiscalDeltaPerYear: -4,
    economicPolicyEffectDelta: { currentSpendingChanges: -4 },
    policyTagDelta: { fiscalDiscipline: 0.4, publicSpending: -0.3 },
  },
]

const CONCESSION_BY_ID: Record<ConcessionType, ConcessionDefinition> = Object.fromEntries(
  CONCESSION_LIST.map((c) => [c.id, c]),
) as Record<ConcessionType, ConcessionDefinition>

export function getConcessionDefinition(id: ConcessionType): ConcessionDefinition {
  return CONCESSION_BY_ID[id]
}

export const CONCESSION_DEFINITIONS: readonly ConcessionDefinition[] = CONCESSION_LIST

/** Adds a concession to the applied list — a true no-op (same array reference) if already present, so a concession can never apply twice (M4 §38). */
export function addConcession(current: readonly ConcessionType[], id: ConcessionType): ConcessionType[] {
  if (current.includes(id)) return current as ConcessionType[]
  return [...current, id]
}

function mergeEconomicPolicyEffectDelta(
  base: Partial<EconomicPolicyInput>,
  delta: Partial<EconomicPolicyInput>,
): Partial<EconomicPolicyInput> {
  const merged: Partial<EconomicPolicyInput> = { ...base }
  for (const key of Object.keys(delta) as (keyof EconomicPolicyInput)[]) {
    merged[key] = (base[key] ?? 0) + (delta[key] ?? 0)
  }
  return merged
}

function mergePolicyTagDelta(base: PolicyAffinity, delta: PolicyAffinity): PolicyAffinity {
  const merged: PolicyAffinity = { ...base }
  for (const key of Object.keys(delta) as PolicyDimension[]) {
    const next = (base[key] ?? 0) + (delta[key] ?? 0)
    merged[key] = Math.min(1, Math.max(-1, next))
  }
  return merged
}

/**
 * The bill definition with its applied concessions merged in — the ONE
 * place a `PoliticalBillDefinition` and an `ActiveBillState.appliedConcessionIds`
 * list are combined (see `billTypes.ts`'s 3-layer split doc comment).
 * Every caller (support estimate, vote resolution, the eventual economic
 * simulation) computes this fresh from the same inputs rather than storing
 * its own mutated copy — this is what makes a concession's effect apply
 * exactly once, however many times `EffectiveBill` is recomputed.
 */
export interface EffectiveBill {
  definition: PoliticalBillDefinition
  fiscalCost: number
  economicPolicyEffect: Partial<EconomicPolicyInput>
  policyTags: PolicyAffinity
  appliedConcessions: readonly ConcessionType[]
}

export function applyConcessionsToBill(definition: PoliticalBillDefinition, appliedConcessionIds: readonly ConcessionType[]): EffectiveBill {
  let fiscalCost = definition.fiscalCost
  let economicPolicyEffect = definition.economicPolicyEffect
  let policyTags = definition.policyTags

  for (const id of appliedConcessionIds) {
    const concession = getConcessionDefinition(id)
    fiscalCost += concession.fiscalDeltaPerYear
    economicPolicyEffect = mergeEconomicPolicyEffectDelta(economicPolicyEffect, concession.economicPolicyEffectDelta)
    policyTags = mergePolicyTagDelta(policyTags, concession.policyTagDelta)
  }

  return { definition, fiscalCost, economicPolicyEffect, policyTags, appliedConcessions: appliedConcessionIds }
}
