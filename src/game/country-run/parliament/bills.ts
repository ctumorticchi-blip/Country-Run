import { ABSOLUTE_MAJORITY } from '../prototype/parliament.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M4 §30-31). The 4 discretionary "Conseil des
 * Ministres" bills — the player brings forward at most ONE of these per
 * Year 1, in addition to the mandatory Budget Bill (derived at runtime by
 * `budgetBillDerivation.ts`, not listed here since it depends on the
 * player's actual Budget Builder choices rather than being static content).
 * Every fiscal/political number is a gameplay-design choice, not sourced.
 */
export const BILL_CATALOG: PoliticalBillDefinition[] = [
  {
    id: 'hospital-plan-bill',
    title: 'PLAN HÔPITAL',
    description: 'Renforcer durablement les moyens de l’hôpital public.',
    policyTags: { health: 0.9, publicSpending: 0.4 },
    economicPolicyEffect: { currentSpendingChanges: 10 },
    fiscalCost: 10,
    reformIntensity: 0.3,
    controversy: 0.15,
    promiseLinks: ['hospital-plan'],
    requiredPoliticalCapital: 6,
    urgency: 'MEDIUM',
    negotiability: 0.7,
    concessionsAvailable: ['INCREASE_HEALTH_FUNDING', 'INCREASE_TERRITORIAL_SUPPORT', 'REDUCE_SPENDING_CAP'],
    voteThreshold: ABSOLUTE_MAJORITY,
    implementationDelay: 1,
  },
  {
    id: 'education-investment-bill',
    title: 'INVESTISSEMENT ÉDUCATION',
    description: 'Investir durablement dans l’école et l’enseignement supérieur.',
    policyTags: { education: 0.9, publicInvestment: 0.3 },
    economicPolicyEffect: { educationInvestment: 8 },
    fiscalCost: 8,
    reformIntensity: 0.3,
    controversy: 0.1,
    promiseLinks: ['invest-education'],
    requiredPoliticalCapital: 5,
    urgency: 'MEDIUM',
    negotiability: 0.75,
    concessionsAvailable: ['INCREASE_TERRITORIAL_SUPPORT', 'REDUCE_SPENDING_CAP'],
    voteThreshold: ABSOLUTE_MAJORITY,
    implementationDelay: 1,
  },
  {
    id: 'business-tax-cut-bill',
    title: 'BAISSE DE LA FISCALITÉ DES ENTREPRISES',
    description: 'Réduire la fiscalité pesant sur les entreprises pour soutenir l’investissement.',
    policyTags: { businessTax: -0.8, fiscalDiscipline: -0.2 },
    economicPolicyEffect: { businessTaxImpulse: -6 },
    fiscalCost: 6,
    reformIntensity: 0.4,
    controversy: 0.35,
    promiseLinks: ['cut-business-taxes'],
    requiredPoliticalCapital: 10,
    urgency: 'MEDIUM',
    negotiability: 0.6,
    concessionsAvailable: ['REDUCE_SPENDING_CAP', 'INCREASE_TERRITORIAL_SUPPORT'],
    voteThreshold: ABSOLUTE_MAJORITY,
    implementationDelay: 1,
  },
  {
    id: 'energy-transition-bill',
    title: 'TRANSITION ÉNERGÉTIQUE',
    description: 'Accélérer l’investissement dans la transition énergétique.',
    policyTags: { environment: 0.9, publicInvestment: 0.5 },
    economicPolicyEffect: { publicInvestmentChanges: 8 },
    fiscalCost: 8,
    reformIntensity: 0.5,
    controversy: 0.3,
    promiseLinks: ['energy-transition'],
    requiredPoliticalCapital: 9,
    urgency: 'MEDIUM',
    negotiability: 0.65,
    concessionsAvailable: ['INCREASE_GREEN_INVESTMENT', 'INCREASE_TERRITORIAL_SUPPORT', 'REDUCE_SPENDING_CAP'],
    voteThreshold: ABSOLUTE_MAJORITY,
    implementationDelay: 2,
  },
]

export function getBillDefinition(id: string): PoliticalBillDefinition {
  const bill = BILL_CATALOG.find((b) => b.id === id)
  if (!bill) throw new Error(`Unknown bill: ${id}`)
  return bill
}
