import type { BudgetCategoryConfig, BudgetCategoryId } from './budgetTypes.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M2). Fictional Md€ magnitudes picked to feel
 * meaningful at Country Run's GDP scale (~2800 Md€), not sourced budget
 * figures. See docs/GAMEPLAY_M2.md.
 *
 * Every `levels` value is an ANNUALIZED LEVEL CHANGE (Md€/year), fed to the
 * economic engine as a policy DELTA the turn the budget is enacted — never
 * re-applied turn after turn (see engine/economy/types.ts, "Policy input
 * units"; this is exactly the M1.5 fix, reused here unchanged).
 */
export const BUDGET_CATEGORIES: Record<BudgetCategoryId, BudgetCategoryConfig> = {
  health: {
    id: 'health',
    label: 'Santé',
    baseline: 260,
    engineField: 'currentSpendingChanges',
    levels: { cut: -8, maintain: 0, invest: 10 },
    copy: {
      cut: 'Économies : -8 Md€/an. Améliore le déficit, mais fait pression sur la qualité du service public et comporte un risque de popularité.',
      maintain: 'Maintien du budget santé actuel.',
      invest: 'Plan santé : +10 Md€/an. Améliore progressivement la qualité du service, effet de demande modeste, potentiel de popularité.',
    },
  },
  education: {
    id: 'education',
    label: 'Éducation',
    baseline: 150,
    engineField: 'educationInvestment',
    levels: { cut: -6, maintain: 0, invest: 8 },
    copy: {
      cut: 'Économies : -6 Md€/an. Impact immédiat limité, mais pèse sur la productivité future.',
      maintain: 'Maintien du budget éducation actuel.',
      invest: 'Investir dans l’école : +8 Md€/an. Effet économique immédiat faible, bénéfice de productivité différé et potentiel de popularité.',
    },
  },
  investment: {
    id: 'investment',
    label: 'Investissement public',
    baseline: 130,
    engineField: 'publicInvestmentChanges',
    levels: { cut: -10, maintain: 0, invest: 15 },
    copy: {
      cut: 'Réduire les investissements : -10 Md€/an. Améliore le déficit à court terme, pèse sur l’activité et la productivité future.',
      maintain: 'Maintien du budget investissement actuel.',
      invest: 'Grand plan d’investissement : +15 Md€/an. Dégrade le déficit à court terme, soutient modérément l’activité, améliore la productivité avec retard — ne se finance jamais tout seul.',
    },
  },
  defense: {
    id: 'defense',
    label: 'Défense',
    baseline: 55,
    engineField: 'currentSpendingChanges',
    levels: { cut: -5, maintain: 0, invest: 10 },
    copy: {
      cut: 'Réduire : -5 Md€/an. Impact économique et politique limité dans ce prototype.',
      maintain: 'Maintien du budget défense actuel.',
      invest: 'Réarmement : +10 Md€/an. Impact économique faible et incertain, effet de popularité limité dans ce prototype.',
    },
  },
}

export const BUDGET_CATEGORY_ORDER: BudgetCategoryId[] = ['health', 'education', 'investment', 'defense']
