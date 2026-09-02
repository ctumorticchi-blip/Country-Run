import type { FinanceBlockConfig, RevenueBlockId } from './financeTypes.ts'

/**
 * ⚠️ CONTENT, GAME_ESTIMATE (M6 §19-27, rebaselined M6.1 §5-7). 4
 * controllable revenue blocks — the MAIN strategic levers, not every line
 * of French taxation (M6 §19: "the player controls the main strategic
 * levers, not every block"). A 5th bucket, "other public revenue" (~122
 * Md€, non-controllable, evolves only via the engine's own growth
 * elasticity), is NOT a `RevenueBlockId` — it has no tiers and is
 * computed as a residual for display, see `financeEffects.ts`'s
 * `otherRevenueEstimate`.
 *
 * Baselines: Social Contributions 734 (~44.8% of publicRevenue),
 * Consumption/Indirect Taxes 328 (~20.0%), Household Taxation 293
 * (~17.9%), Business Taxation 161 (~9.8%), Other Revenue 122 (residual,
 * ~7.4%) — sum 1,638, exactly the FRANCE 2027 BASELINE `publicRevenue` in
 * `data/initialState.ts` (M6.1 §1-3, do not silently replace the
 * documented baseline). The 4 controllable shares are the SAME relative
 * composition M6 originally used (a proportional carry-forward, not a
 * re-derivation — France's revenue mix by source has been broadly stable
 * year to year, unlike the expenditure functional split, so this is not
 * the "blind proportional scale-up" M6.1 §5 warns against for spending).
 *
 * THE M6 REVENUE FIX (M6 §1, isolated/documented per the brief's own
 * instruction — see `docs/ECONOMY_BUDGET_M6.md`): every tier below sets
 * BOTH `taxChanges` (the field `engine/economy/fiscal.ts`'s
 * `computePublicRevenue` actually reads) AND the matching `*TaxImpulse`
 * field (confidence/inflation side effect). Before M6, every tax-related
 * effect in this codebase (reform bills, events, concessions) set only the
 * impulse field, so tax policy had literally ZERO effect on public
 * revenue/deficit/debt — see the M6 audit note in
 * docs/ECONOMY_BUDGET_M6.md for the full trace. `bills.ts`, `concessions.ts`
 * and `eventCatalog.ts` are retrofitted the same way in this milestone.
 */
export const REVENUE_BLOCKS: Record<RevenueBlockId, FinanceBlockConfig<RevenueBlockId>> = {
  householdTax: {
    id: 'householdTax',
    label: 'Fiscalité des ménages',
    baseline: 293,
    provenance: 'GAME_ESTIMATE',
    tiers: [
      {
        id: 'majorCut',
        label: 'BAISSE MAJEURE',
        annualFiscalDelta: -15,
        policyEffect: { taxChanges: -15, householdTaxImpulse: -15 },
        description: 'Une baisse d’ampleur de l’impôt sur le revenu et des prélèvements sur les ménages.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Soutien marqué au pouvoir d’achat et à la confiance des ménages.', 'Recettes publiques en net recul — pas un effet 1-pour-1 sur la croissance.'],
        politicalTags: ['taxCut'],
        promiseLinks: ['cut-household-taxes'],
        riskDescription: 'Creuse le déficit si non compensé.',
      },
      {
        id: 'targetedCut',
        label: 'BAISSE CIBLÉE',
        annualFiscalDelta: -6,
        policyEffect: { taxChanges: -6, householdTaxImpulse: -6 },
        description: 'Un allégement ciblé de la fiscalité des ménages.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Soutien modéré au pouvoir d’achat.'],
        politicalTags: ['taxCut'],
        promiseLinks: ['cut-household-taxes'],
      },
      {
        id: 'maintain',
        label: 'MAINTIEN',
        annualFiscalDelta: 0,
        policyEffect: {},
        description: 'Maintien de la fiscalité des ménages actuelle.',
        implementationTiming: 0,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Aucun effet supplémentaire.'],
      },
      {
        id: 'targetedIncrease',
        label: 'HAUSSE CIBLÉE',
        annualFiscalDelta: 6,
        policyEffect: { taxChanges: 6, householdTaxImpulse: 6 },
        description: 'Une hausse ciblée de la fiscalité des ménages.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes supplémentaires, pèse sur le pouvoir d’achat et la confiance des ménages.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts.',
      },
      {
        id: 'majorIncrease',
        label: 'HAUSSE MAJEURE',
        annualFiscalDelta: 15,
        policyEffect: { taxChanges: 15, householdTaxImpulse: 15 },
        description: 'Une hausse significative de la fiscalité des ménages.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes publiques en nette hausse, coût politique et social élevé.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts ; risque de contestation.',
      },
    ],
  },

  businessTax: {
    id: 'businessTax',
    label: 'Fiscalité des entreprises',
    baseline: 161,
    provenance: 'GAME_ESTIMATE',
    tiers: [
      {
        id: 'majorCut',
        label: 'BAISSE MAJEURE',
        annualFiscalDelta: -12,
        policyEffect: { taxChanges: -12, businessTaxImpulse: -12 },
        description: 'Un allégement majeur de la fiscalité des entreprises.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Soutien marqué à la confiance des entreprises et au climat d’investissement.', 'Recettes publiques en net recul.'],
        politicalTags: ['taxCut'],
        promiseLinks: ['cut-business-taxes'],
      },
      {
        id: 'targetedCut',
        label: 'BAISSE CIBLÉE',
        annualFiscalDelta: -5,
        policyEffect: { taxChanges: -5, businessTaxImpulse: -5 },
        description: 'Un allégement ciblé de la fiscalité des entreprises.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Soutien modéré à la confiance des entreprises.'],
        politicalTags: ['taxCut'],
        promiseLinks: ['cut-business-taxes'],
      },
      {
        id: 'maintain',
        label: 'MAINTIEN',
        annualFiscalDelta: 0,
        policyEffect: {},
        description: 'Maintien de la fiscalité des entreprises actuelle.',
        implementationTiming: 0,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Aucun effet supplémentaire.'],
      },
      {
        id: 'targetedIncrease',
        label: 'HAUSSE CIBLÉE',
        annualFiscalDelta: 5,
        policyEffect: { taxChanges: 5, businessTaxImpulse: 5 },
        description: 'Une hausse ciblée de la fiscalité des entreprises.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes supplémentaires, pèse sur la confiance des entreprises.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts.',
      },
      {
        id: 'majorIncrease',
        label: 'HAUSSE MAJEURE',
        annualFiscalDelta: 12,
        policyEffect: { taxChanges: 12, businessTaxImpulse: 12 },
        description: 'Une hausse significative de la fiscalité des entreprises.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes publiques en nette hausse, dégrade le climat d’investissement.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts.',
      },
    ],
  },

  consumptionTax: {
    id: 'consumptionTax',
    label: 'Fiscalité de la consommation (TVA, taxes indirectes)',
    baseline: 328,
    provenance: 'GAME_ESTIMATE',
    temporaryInflationChannel: true,
    tiers: [
      {
        id: 'cut',
        label: 'BAISSE',
        annualFiscalDelta: -8,
        policyEffect: { taxChanges: -8 },
        description: 'Baisser la fiscalité indirecte sur certains produits.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes en recul.', 'Effet transitoire (environ un an) sur le niveau des prix — pas un effet permanent sur l’inflation.'],
      },
      {
        id: 'maintain',
        label: 'MAINTIEN',
        annualFiscalDelta: 0,
        policyEffect: {},
        description: 'Maintien de la fiscalité de la consommation actuelle.',
        implementationTiming: 0,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Aucun effet supplémentaire.'],
      },
      {
        id: 'targetedIncrease',
        label: 'HAUSSE CIBLÉE',
        annualFiscalDelta: 6,
        policyEffect: { taxChanges: 6 },
        description: 'Relever ciblément la fiscalité indirecte.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes supplémentaires.', 'Effet transitoire (environ un an) sur le niveau des prix, répercuté sur les ménages.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts.',
      },
      {
        id: 'majorIncrease',
        label: 'HAUSSE MAJEURE',
        annualFiscalDelta: 14,
        policyEffect: { taxChanges: 14 },
        description: 'Une hausse significative de la fiscalité indirecte.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes en nette hausse.', 'Choc de prix transitoire plus marqué, répercuté sur les ménages.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts ; pèse sur le pouvoir d’achat à court terme.',
      },
    ],
  },

  socialContributions: {
    id: 'socialContributions',
    label: 'Cotisations sociales',
    baseline: 734,
    provenance: 'GAME_ESTIMATE',
    tiers: [
      {
        id: 'majorCut',
        label: 'BAISSE MAJEURE',
        annualFiscalDelta: -15,
        policyEffect: { taxChanges: -15, businessTaxImpulse: -7.5 },
        description: 'Alléger fortement les cotisations sociales patronales.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Baisse du coût du travail, soutien modéré à l’emploi.', 'Recettes publiques en net recul.'],
        politicalTags: ['taxCut'],
      },
      {
        id: 'targetedCut',
        label: 'BAISSE CIBLÉE',
        annualFiscalDelta: -6,
        policyEffect: { taxChanges: -6, businessTaxImpulse: -3 },
        description: 'Alléger ciblément les cotisations sociales.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Soutien modeste au coût du travail et à l’emploi.'],
      },
      {
        id: 'maintain',
        label: 'MAINTIEN',
        annualFiscalDelta: 0,
        policyEffect: {},
        description: 'Maintien des cotisations sociales actuelles.',
        implementationTiming: 0,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Aucun effet supplémentaire.'],
      },
      {
        id: 'targetedIncrease',
        label: 'HAUSSE CIBLÉE',
        annualFiscalDelta: 6,
        policyEffect: { taxChanges: 6, businessTaxImpulse: 3 },
        description: 'Relever ciblément les cotisations sociales.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes supplémentaires, pèse modérément sur le coût du travail.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts.',
      },
      {
        id: 'majorIncrease',
        label: 'HAUSSE MAJEURE',
        annualFiscalDelta: 15,
        policyEffect: { taxChanges: 15, businessTaxImpulse: 7.5 },
        description: 'Une hausse significative des cotisations sociales.',
        implementationTiming: 1,
        temporaryOrPermanent: 'PERMANENT',
        economicEffects: ['Recettes en nette hausse, pèse sur le coût du travail et la confiance des entreprises.'],
        riskDescription: 'Rompt tout engagement de non-augmentation des impôts.',
      },
    ],
  },
}

export const REVENUE_BLOCK_ORDER: RevenueBlockId[] = ['householdTax', 'businessTax', 'consumptionTax', 'socialContributions']

/** Reference envelope for the non-controllable "other public revenue" bucket — display only, see `financeEffects.ts`'s `otherRevenueEstimate` for how the LIVE figure is derived each turn. */
export const OTHER_REVENUE_BASELINE = 122

export function getRevenueTier(blockId: RevenueBlockId, tierId: string) {
  const tier = REVENUE_BLOCKS[blockId].tiers.find((t) => t.id === tierId)
  if (!tier) throw new Error(`Unknown tier "${tierId}" for revenue block "${blockId}"`)
  return tier
}

export const NEUTRAL_REVENUE_LEVELS: Record<RevenueBlockId, string> = {
  householdTax: 'maintain',
  businessTax: 'maintain',
  consumptionTax: 'maintain',
  socialContributions: 'maintain',
}
