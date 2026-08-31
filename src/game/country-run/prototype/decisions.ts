import type { DecisionConfig } from './types.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M2 vertical slice, Year 1 only). French copy per
 * the M2 brief. Numeric effects are gameplay-tuned, not sourced — economic
 * fields feed the real M1.5 engine via policyDelta; popularity/credibility
 * fields are prototype-only (popularity.ts).
 */
export const BERCY_AUDIT: DecisionConfig = {
  id: 'bercy-audit',
  title: 'BERCY VOUS PRÉSENTE L’ADDITION',
  text: 'Vos premières promesses représenteraient environ 35 Md€ de dépenses supplémentaires par an. Le ministère des Finances vous demande de définir une ligne avant la préparation du budget.',
  choices: [
    {
      id: 'assume-deficit',
      title: 'ASSUMER LE DÉFICIT',
      copy: 'Financer temporairement les nouvelles mesures par davantage de déficit.',
      previews: [
        { label: 'Dépenses', direction: 'up' },
        { label: 'Croissance court terme', direction: 'up' },
        { label: 'Déficit', direction: 'strongUp' },
        { label: 'Popularité', direction: 'up' },
        { label: 'Confiance des marchés', direction: 'down' },
      ],
      policyDelta: { currentSpendingChanges: 18 },
      popularityDelta: 3,
    },
    {
      id: 'find-savings',
      title: 'TROUVER 20 MD€ D’ÉCONOMIES',
      copy: 'Demander aux ministères de réduire leurs dépenses avant le budget.',
      previews: [
        { label: 'Dépenses', direction: 'down' },
        { label: 'Déficit', direction: 'down' },
        { label: 'Croissance court terme', direction: 'down' },
        { label: 'Risque social', direction: 'up' },
      ],
      policyDelta: { currentSpendingChanges: -20 },
      popularityDelta: -2,
    },
    {
      id: 'scale-back',
      title: 'RÉDUIRE LE PROGRAMME',
      copy: 'Reporter une partie des engagements de campagne.',
      previews: [
        { label: 'Déficit', direction: 'down' },
        { label: 'Économie', direction: 'neutral' },
        { label: 'Popularité', direction: 'down' },
        { label: 'Crédibilité budgétaire', direction: 'up' },
      ],
      policyDelta: { currentSpendingChanges: -8 },
      popularityDelta: -3,
      credibilityDelta: 3,
    },
  ],
}

export const ENERGY_SHOCK: DecisionConfig = {
  id: 'energy-shock',
  title: 'LE PÉTROLE BONDIT DE 28 %',
  text: 'Une crise internationale provoque une hausse brutale des prix de l’énergie. Les ménages et les entreprises commencent à ressentir le choc.',
  shock: {
    id: 'energy-shock-2027',
    world: { oilPriceIndex: 28 },
    directGrowthEffect: -0.3,
    confidence: { consumerConfidence: -5, businessConfidence: -3 },
  },
  choices: [
    {
      id: 'energy-shield',
      title: 'BOUCLIER ÉNERGÉTIQUE',
      copy: 'Coût budgétaire annuel : environ +15 Md€.',
      previews: [
        { label: 'Pouvoir d’achat', direction: 'up' },
        { label: 'Déficit', direction: 'up' },
        { label: 'Impact inflation', direction: 'down' },
        { label: 'Popularité', direction: 'up' },
      ],
      policyDelta: { transfersChanges: 15 },
      popularityDelta: 3,
    },
    {
      id: 'targeted-aid',
      title: 'AIDE CIBLÉE',
      copy: 'Coût budgétaire annuel : environ +6 Md€.',
      previews: [
        { label: 'Protection', direction: 'mixed' },
        { label: 'Déficit', direction: 'up' },
        { label: 'Popularité', direction: 'up' },
      ],
      policyDelta: { transfersChanges: 6 },
      popularityDelta: 1.5,
    },
    {
      id: 'let-prices-adjust',
      title: 'LAISSER LES PRIX S’AJUSTER',
      copy: 'Coût budgétaire : 0.',
      previews: [
        { label: 'Déficit', direction: 'neutral' },
        { label: 'Pouvoir d’achat / inflation', direction: 'strongDown' },
        { label: 'Popularité', direction: 'down' },
        { label: 'Confiance des marchés', direction: 'up' },
      ],
      popularityDelta: -3,
    },
  ],
}
