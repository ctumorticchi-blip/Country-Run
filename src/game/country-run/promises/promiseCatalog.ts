import { evaluatePolicyCommitment, evaluateThreshold, evaluateUnavailableLever } from './promiseEvaluators.ts'
import type { PromiseDefinition } from './promiseTypes.ts'

const pct = (value: number) => `${value.toFixed(1)}%`
const index = (value: number) => value.toFixed(1)

/**
 * ⚠️ PROTOTYPE CONTENT (M3, Product Bible §9's promise library, scoped to
 * the Year 1 vertical slice). Exactly 15 promises, deliberately spanning
 * different priorities with no left/right label anywhere (M3 §2). Every
 * `estimatedAnnualCost` and coefficient here is a gameplay-design number,
 * not a sourced fiscal estimate.
 *
 * Deadlines are expressed in turns (6 turns/year, `engine/state/calendar.ts`):
 * Year 1 = turn 6, Year 2 = turn 12, Year 3 = turn 18, mandate end = turn 30.
 * M3 only plays through Year 1 (turn 6) — promises with a later deadline
 * simply show a trajectory-based status (ON_TRACK/AT_RISK), never
 * KEPT/BROKEN, until the game actually reaches their deadline turn in a
 * future milestone.
 *
 * A few promises (`energyTransition`, `buildHousing`, `restorePublicServices`)
 * use a documented TEMPORARY evaluator (M3 §8 explicitly allows this for
 * "restaurer les services publics") because the current gameplay has no
 * dedicated lever for them yet — they piggyback on the closest existing
 * lever (public investment, or a composite of health/education choices)
 * rather than faking a purpose-built one. Three tax-related promises
 * (`noTaxIncrease`, `cutHouseholdTaxes`, `cutBusinessTaxes`) and
 * `protectPensions` have NO lever at all yet in M2/M3's gameplay (no
 * decision currently changes taxes or pensions) — their evaluator is
 * honest about that rather than resolving to a fake KEPT/BROKEN.
 */
export const PROMISE_CATALOG: PromiseDefinition[] = [
  {
    id: 'reduce-deficit',
    category: 'publicFinances',
    title: 'REVENIR SOUS 4 % DE DÉFICIT',
    shortDescription: 'Ramener le déficit public sous 4 % du PIB.',
    campaignPitch: 'La France doit renouer avec des finances publiques soutenables.',
    targetMetricLabel: 'Déficit public',
    deadlineTurn: 18,
    deadlineLabel: 'Fin d’année 3',
    estimatedAnnualCost: 0,
    difficulty: 'HIGH',
    politicalTags: ['fiscalDiscipline'],
    evaluate: (ctx) =>
      evaluateThreshold({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 18,
        baseline: ctx.initialEconomic.deficitRatio,
        target: 4,
        current: ctx.currentEconomic.deficitRatio,
        lowerIsBetter: true,
        formatValue: pct,
      }),
  },
  {
    id: 'reduce-unemployment',
    category: 'employment',
    title: 'RAMENER LE CHÔMAGE SOUS 7 %',
    shortDescription: 'Faire baisser le chômage sous 7 % de la population active.',
    campaignPitch: 'Chaque Français qui veut travailler doit pouvoir trouver un emploi.',
    targetMetricLabel: 'Chômage',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 0,
    difficulty: 'HIGH',
    politicalTags: ['reform'],
    evaluate: (ctx) =>
      evaluateThreshold({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 30,
        baseline: ctx.initialEconomic.unemployment,
        target: 7,
        current: ctx.currentEconomic.unemployment,
        lowerIsBetter: true,
        formatValue: pct,
      }),
  },
  {
    id: 'increase-purchasing-power',
    category: 'purchasingPower',
    title: 'AUGMENTER LE POUVOIR D’ACHAT',
    shortDescription: 'Porter l’indice de pouvoir d’achat à au moins 104.',
    campaignPitch: 'Le travail doit mieux payer et les fins de mois doivent être plus faciles.',
    targetMetricLabel: 'Pouvoir d’achat (indice)',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 0,
    difficulty: 'MEDIUM',
    politicalTags: ['socialProtection'],
    evaluate: (ctx) =>
      evaluateThreshold({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 30,
        baseline: 100 + ctx.initialEconomic.purchasingPower,
        target: 104,
        current: 100 + ctx.currentEconomic.purchasingPower,
        lowerIsBetter: false,
        formatValue: index,
      }),
  },
  {
    id: 'hospital-plan',
    category: 'health',
    title: 'PLAN HÔPITAL',
    shortDescription: 'Renforcer durablement les moyens de l’hôpital public.',
    campaignPitch: 'Nos soignants et nos hôpitaux ont besoin de moyens supplémentaires.',
    targetMetricLabel: 'Budget santé',
    deadlineTurn: 12,
    deadlineLabel: 'Fin d’année 2',
    estimatedAnnualCost: 10,
    difficulty: 'MEDIUM',
    politicalTags: ['socialProtection'],
    evaluate: (ctx) =>
      evaluatePolicyCommitment({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 12,
        policyHistory: ctx.policyHistory,
        category: 'health',
        minAnnualAmount: 10,
      }),
  },
  {
    id: 'invest-education',
    category: 'education',
    title: 'INVESTIR DANS L’ÉCOLE',
    shortDescription: 'Investir au moins 8 Md€/an supplémentaires dans l’éducation.',
    campaignPitch: 'L’avenir se joue à l’école — les effets prendront du temps à se voir.',
    targetMetricLabel: 'Investissement éducation',
    deadlineTurn: 12,
    deadlineLabel: 'Fin d’année 2',
    estimatedAnnualCost: 8,
    difficulty: 'MEDIUM',
    politicalTags: ['investment'],
    evaluate: (ctx) =>
      evaluatePolicyCommitment({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 12,
        policyHistory: ctx.policyHistory,
        category: 'education',
        minAnnualAmount: 8,
      }),
  },
  {
    id: 'grand-investment-plan',
    category: 'investment',
    title: 'GRAND PLAN D’INVESTISSEMENT',
    shortDescription: 'Lancer un grand plan d’investissement public d’au moins 15 Md€/an.',
    campaignPitch: 'La France doit investir dans ses infrastructures et sa compétitivité.',
    targetMetricLabel: 'Investissement public',
    deadlineTurn: 12,
    deadlineLabel: 'Fin d’année 2',
    estimatedAnnualCost: 15,
    difficulty: 'MEDIUM',
    politicalTags: ['investment'],
    evaluate: (ctx) =>
      evaluatePolicyCommitment({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 12,
        policyHistory: ctx.policyHistory,
        category: 'investment',
        minAnnualAmount: 15,
      }),
  },
  {
    id: 'reduce-debt',
    category: 'publicFinances',
    title: 'RÉDUIRE LA DETTE',
    shortDescription: 'Terminer le mandat avec une dette publique (% PIB) inférieure au point de départ.',
    campaignPitch: 'Nous ne pouvons pas indéfiniment reporter la facture sur nos enfants.',
    targetMetricLabel: 'Dette publique',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 0,
    difficulty: 'HIGH',
    politicalTags: ['fiscalDiscipline'],
    evaluate: (ctx) =>
      evaluateThreshold({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 30,
        baseline: ctx.initialEconomic.debtRatio,
        target: ctx.initialEconomic.debtRatio - 0.01, // strictly below the starting ratio
        current: ctx.currentEconomic.debtRatio,
        lowerIsBetter: true,
        formatValue: (v) => `${pct(v)} du PIB`,
      }),
  },
  {
    id: 'cut-household-taxes',
    category: 'taxation',
    title: 'BAISSER LES IMPÔTS DES MÉNAGES',
    shortDescription: 'Réduire la fiscalité qui pèse sur les ménages.',
    campaignPitch: 'Le travail et l’effort méritent d’être moins taxés.',
    targetMetricLabel: 'Fiscalité des ménages',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 8,
    difficulty: 'MEDIUM',
    politicalTags: ['taxCut'],
    temporaryEvaluator: true,
    evaluate: () =>
      evaluateUnavailableLever('Aucune mesure fiscale ménages n’est encore disponible dans cette version du jeu.'),
  },
  {
    id: 'cut-business-taxes',
    category: 'taxation',
    title: 'BAISSER LES IMPÔTS DES ENTREPRISES',
    shortDescription: 'Alléger la fiscalité des entreprises pour soutenir l’investissement.',
    campaignPitch: 'Les entreprises qui investissent et embauchent doivent être encouragées.',
    targetMetricLabel: 'Fiscalité des entreprises',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 6,
    difficulty: 'MEDIUM',
    politicalTags: ['taxCut', 'investment'],
    temporaryEvaluator: true,
    evaluate: () =>
      evaluateUnavailableLever('Aucune mesure fiscale entreprises n’est encore disponible dans cette version du jeu.'),
  },
  {
    id: 'strengthen-defense',
    category: 'security',
    title: 'RENFORCER LA DÉFENSE',
    shortDescription: 'Augmenter durablement les moyens de la défense nationale.',
    campaignPitch: 'Dans un monde plus incertain, la France doit investir dans sa sécurité.',
    targetMetricLabel: 'Budget défense',
    deadlineTurn: 12,
    deadlineLabel: 'Fin d’année 2',
    estimatedAnnualCost: 10,
    difficulty: 'LOW',
    politicalTags: ['security'],
    evaluate: (ctx) =>
      evaluatePolicyCommitment({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 12,
        policyHistory: ctx.policyHistory,
        category: 'security',
        minAnnualAmount: 10,
      }),
  },
  {
    id: 'energy-transition',
    category: 'environment',
    title: 'ACCÉLÉRER LA TRANSITION ÉNERGÉTIQUE',
    shortDescription: 'Investir dans la transition énergétique pour réduire notre exposition aux chocs futurs.',
    campaignPitch: 'Notre dépendance aux énergies fossiles est aussi un risque économique.',
    targetMetricLabel: 'Investissement transition énergétique',
    deadlineTurn: 18,
    deadlineLabel: 'Fin d’année 3',
    estimatedAnnualCost: 8,
    difficulty: 'HIGH',
    politicalTags: ['environment', 'investment'],
    temporaryEvaluator: true,
    evaluate: (ctx) =>
      // TEMPORARY (M3 §8): no dedicated "energy transition" lever exists yet — piggybacks on the
      // public investment category, since energy infrastructure is a form of public investment.
      evaluatePolicyCommitment({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 18,
        policyHistory: ctx.policyHistory,
        category: 'investment',
        minAnnualAmount: 8,
      }),
  },
  {
    id: 'build-housing',
    category: 'housing',
    title: 'CONSTRUIRE PLUS DE LOGEMENTS',
    shortDescription: 'Soutenir la construction de logements par l’investissement public.',
    campaignPitch: 'Trop de Français peinent à se loger décemment.',
    targetMetricLabel: 'Investissement logement',
    deadlineTurn: 18,
    deadlineLabel: 'Fin d’année 3',
    estimatedAnnualCost: 8,
    difficulty: 'MEDIUM',
    politicalTags: ['investment', 'socialProtection'],
    temporaryEvaluator: true,
    evaluate: (ctx) =>
      // TEMPORARY (M3 §8): shares the public investment lever with the grand investment plan and
      // energy transition promises — no dedicated housing budget category exists yet.
      evaluatePolicyCommitment({
        currentTurn: ctx.currentTurn,
        deadlineTurn: 18,
        policyHistory: ctx.policyHistory,
        category: 'investment',
        minAnnualAmount: 8,
      }),
  },
  {
    id: 'no-tax-increase',
    category: 'taxation',
    title: 'NE PAS AUGMENTER LES IMPÔTS',
    shortDescription: 'S’interdire toute hausse d’impôt pendant le mandat.',
    campaignPitch: 'Les Français paient déjà trop — pas un euro d’impôt de plus.',
    targetMetricLabel: 'Fiscalité globale',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 0,
    difficulty: 'HIGH',
    politicalTags: ['taxCut', 'fiscalDiscipline'],
    temporaryEvaluator: true,
    evaluate: () =>
      evaluateUnavailableLever('Aucune décision de ce jeu n’augmente encore les impôts — engagement non testable pour l’instant.'),
  },
  {
    id: 'protect-pensions',
    category: 'pensions',
    title: 'PROTÉGER LES RETRAITES',
    shortDescription: 'Ne pas réduire les pensions ni le pouvoir d’achat des retraités.',
    campaignPitch: 'Nos retraités ont cotisé toute leur vie — leurs pensions ne sont pas une variable d’ajustement.',
    targetMetricLabel: 'Pouvoir d’achat des retraités',
    deadlineTurn: 30,
    deadlineLabel: 'Fin de mandat',
    estimatedAnnualCost: 0,
    difficulty: 'MEDIUM',
    politicalTags: ['socialProtection'],
    temporaryEvaluator: true,
    evaluate: () => evaluateUnavailableLever('Aucune décision de ce jeu ne touche encore les retraites — engagement non testable pour l’instant.'),
  },
  {
    id: 'restore-public-services',
    category: 'publicServices',
    title: 'RESTAURER LES SERVICES PUBLICS',
    shortDescription: 'Améliorer la qualité perçue des services publics du quotidien.',
    campaignPitch: 'L’État doit redevenir présent et efficace partout sur le territoire.',
    targetMetricLabel: 'Qualité des services publics (composite)',
    deadlineTurn: 18,
    deadlineLabel: 'Fin d’année 3',
    estimatedAnnualCost: 0,
    difficulty: 'MEDIUM',
    politicalTags: ['socialProtection'],
    temporaryEvaluator: true,
    evaluate: (ctx) => {
      // TEMPORARY (M3 §8, explicitly allowed): a composite proxy from health/education choices,
      // until a dedicated "public services quality" indicator exists.
      const investedInServices = ctx.policyHistory.some(
        (entry) => (entry.category === 'health' || entry.category === 'education') && (entry.amount ?? 0) > 0,
      )
      const cutServices = ctx.policyHistory.some(
        (entry) => (entry.category === 'health' || entry.category === 'education') && (entry.amount ?? 0) < 0,
      )
      if (ctx.currentTurn === 0) return { status: 'NOT_STARTED', progressLabel: 'Composite santé + éducation' }
      if (investedInServices && !cutServices) return { status: 'ON_TRACK', progressLabel: 'Moyens renforcés (santé/éducation)' }
      if (cutServices && !investedInServices) return { status: 'AT_RISK', progressLabel: 'Moyens réduits (santé/éducation)' }
      return { status: 'IN_PROGRESS', progressLabel: 'Trajectoire mixte' }
    },
  },
]

export function getPromiseDefinition(id: string): PromiseDefinition {
  const promise = PROMISE_CATALOG.find((p) => p.id === id)
  if (!promise) throw new Error(`Unknown promise: ${id}`)
  return promise
}
