import type { BudgetCategoryConfig, BudgetCategoryId, BudgetLevels } from './budgetTypes.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M2, expanded M5 §30-31). Fictional Md€ magnitudes
 * picked to feel meaningful at Country Run's GDP scale (~2800 Md€), not
 * sourced budget figures — game-control envelopes, not exhaustive COFOG
 * accounting. Every tier's `value` is an ANNUALIZED ABSOLUTE LEVEL
 * (Md€/year vs. a true zero baseline), fed to the economic engine as a
 * policy level the turn it's enacted — the engine's own
 * `computePolicyDelta` (M1.5) is what keeps a sustained, unchanged level
 * from re-adding itself turn after turn or year after year.
 */
export const BUDGET_CATEGORIES: Record<BudgetCategoryId, BudgetCategoryConfig> = {
  health: {
    id: 'health',
    label: 'Santé',
    baseline: 260,
    engineField: 'currentSpendingChanges',
    tiers: [
      { id: 'cuts', label: 'ÉCONOMIES', value: -10, copy: 'Économies : -10 Md€/an. Améliore le déficit, mais pèse sur la qualité du service public.' },
      { id: 'controlled', label: 'MAÎTRISÉ', value: -4, copy: 'Effort mesuré : -4 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du budget santé actuel.' },
      { id: 'hospitalPlan', label: 'PLAN HÔPITAL', value: 10, copy: 'Plan hôpital : +10 Md€/an. Améliore progressivement la qualité du service.' },
    ],
  },
  education: {
    id: 'education',
    label: 'Éducation',
    baseline: 150,
    engineField: 'educationInvestment',
    tiers: [
      { id: 'cuts', label: 'ÉCONOMIES', value: -8, copy: 'Économies : -8 Md€/an. Pèse sur la productivité future.' },
      { id: 'controlled', label: 'MAÎTRISÉ', value: -3, copy: 'Effort mesuré : -3 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du budget éducation actuel.' },
      { id: 'invest', label: 'INVESTIR', value: 8, copy: 'Investir dans l’école : +8 Md€/an. Bénéfice de productivité différé.' },
    ],
  },
  publicInvestment: {
    id: 'publicInvestment',
    label: 'Investissement public',
    baseline: 130,
    engineField: 'publicInvestmentChanges',
    tiers: [
      { id: 'cuts', label: 'ÉCONOMIES', value: -10, copy: 'Réduire les investissements : -10 Md€/an. Pèse sur l’activité future.' },
      { id: 'controlled', label: 'MAÎTRISÉ', value: -4, copy: 'Effort mesuré : -4 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du budget investissement actuel.' },
      { id: 'grandPlan', label: 'GRAND PLAN', value: 15, copy: 'Grand plan d’investissement : +15 Md€/an. Ne se finance jamais tout seul.' },
    ],
  },
  defense: {
    id: 'defense',
    label: 'Défense',
    baseline: 55,
    engineField: 'currentSpendingChanges',
    tiers: [
      { id: 'cuts', label: 'ÉCONOMIES', value: -5, copy: 'Réduire : -5 Md€/an.' },
      { id: 'controlled', label: 'MAÎTRISÉ', value: -2, copy: 'Effort mesuré : -2 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du budget défense actuel.' },
      { id: 'reinforce', label: 'RÉARMEMENT', value: 10, copy: 'Réarmement : +10 Md€/an.' },
    ],
  },
  housingTerritories: {
    id: 'housingTerritories',
    label: 'Logement & territoires',
    baseline: 90,
    engineField: 'publicInvestmentChanges',
    tiers: [
      { id: 'cuts', label: 'ÉCONOMIES', value: -6, copy: 'Réduire les dotations : -6 Md€/an.' },
      { id: 'controlled', label: 'MAÎTRISÉ', value: -2, copy: 'Effort mesuré : -2 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du budget logement/territoires actuel.' },
      { id: 'invest', label: 'PLAN LOGEMENT', value: 8, copy: 'Plan logement et soutien territorial : +8 Md€/an.' },
    ],
  },
  greenTransition: {
    id: 'greenTransition',
    label: 'Transition écologique',
    baseline: 40,
    engineField: 'infrastructureInvestment',
    tiers: [
      { id: 'cuts', label: 'ÉCONOMIES', value: -4, copy: 'Ralentir la transition : -4 Md€/an.' },
      { id: 'controlled', label: 'MAÎTRISÉ', value: -1, copy: 'Effort mesuré : -1 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du budget transition écologique actuel.' },
      { id: 'accelerate', label: 'ACCÉLÉRER', value: 8, copy: 'Accélérer la transition énergétique : +8 Md€/an.' },
    ],
  },
  administrationEfficiency: {
    id: 'administrationEfficiency',
    label: 'Administration & efficacité',
    baseline: 180,
    engineField: 'currentSpendingChanges',
    tiers: [
      { id: 'drastic', label: 'PLAN DRASTIQUE', value: -12, copy: 'Réduction drastique du train de vie de l’État : -12 Md€/an. Risque social élevé.' },
      { id: 'targeted', label: 'ÉCONOMIES CIBLÉES', value: -5, copy: 'Économies ciblées sur le fonctionnement : -5 Md€/an.' },
      { id: 'maintain', label: 'MAINTIEN', value: 0, copy: 'Maintien du fonctionnement actuel de l’administration.' },
    ],
  },
}

export const BUDGET_CATEGORY_ORDER: BudgetCategoryId[] = [
  'health',
  'education',
  'publicInvestment',
  'defense',
  'housingTerritories',
  'greenTransition',
  'administrationEfficiency',
]

/** Every category starts at its neutral (0 Md€/year) tier — the mandate's very first budget cycle drafts from here. */
export const NEUTRAL_BUDGET_LEVELS: BudgetLevels = {
  health: 0,
  education: 0,
  publicInvestment: 0,
  defense: 0,
  housingTerritories: 0,
  greenTransition: 0,
  administrationEfficiency: 0,
}

/** Every category's default DRAFT tier ('maintain', present on every category) — used to initialize a fresh `BudgetSelections` each budget cycle. */
export const NEUTRAL_BUDGET_SELECTIONS: Record<BudgetCategoryId, string> = {
  health: 'maintain',
  education: 'maintain',
  publicInvestment: 'maintain',
  defense: 'maintain',
  housingTerritories: 'maintain',
  greenTransition: 'maintain',
  administrationEfficiency: 'maintain',
}

export function getTier(categoryId: BudgetCategoryId, tierId: string) {
  const tier = BUDGET_CATEGORIES[categoryId].tiers.find((t) => t.id === tierId)
  if (!tier) throw new Error(`Unknown tier "${tierId}" for budget category "${categoryId}"`)
  return tier
}

/** The draft tier ids that would reproduce `levels` exactly — used to pre-select each category's tier when a new budget cycle opens with the prior year's enacted levels (falls back to 'maintain' if the level doesn't match any tier, e.g. after a concession). */
export function selectionsFromLevels(levels: BudgetLevels): Record<BudgetCategoryId, string> {
  const selections = { ...NEUTRAL_BUDGET_SELECTIONS }
  for (const categoryId of BUDGET_CATEGORY_ORDER) {
    const match = BUDGET_CATEGORIES[categoryId].tiers.find((t) => t.value === levels[categoryId])
    selections[categoryId] = match?.id ?? 'maintain'
  }
  return selections
}
