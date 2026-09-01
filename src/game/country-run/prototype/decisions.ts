import type { DecisionConfig } from './types.ts'

/**
 * ⚠️ PROTOTYPE CONTENT (M2 vertical slice, Year 1 only). French copy per
 * the M2 brief. Numeric effects are gameplay-tuned, not sourced — economic
 * fields feed the real M1.5 engine via policyDelta; popularity/credibility
 * fields are prototype-only (popularity.ts).
 */
/**
 * Bercy's audit text is a function of the player's ACTUAL 5 selected
 * promises (M3 §11), not a fixed figure — replacing M2's hardcoded
 * "35 Md€". `BERCY_AUDIT.text` below is only a generic fallback for
 * contexts with no promise selection (e.g. a decision-card preview); the
 * real Year 1 screen always calls this with the campaign's actual cost.
 */
export function bercyAuditText(totalAnnualCostBn: number, isDifficult: boolean): string {
  const costLabel = totalAnnualCostBn > 0 ? `environ ${String(totalAnnualCostBn)} Md€` : 'peu de dépenses nouvelles'
  const warning = isDifficult
    ? ' ⚠️ Ce programme est difficile à financer sans arbitrages significatifs.'
    : ''
  return `Vos 5 engagements de campagne représenteraient ${costLabel} de dépenses supplémentaires par an. Le ministère des Finances vous demande de définir une ligne avant la préparation du budget.${warning}`
}

export const BERCY_AUDIT: DecisionConfig = {
  id: 'bercy-audit',
  title: 'BERCY VOUS PRÉSENTE L’ADDITION',
  text: bercyAuditText(0, false),
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

/**
 * M5 §11: the old fixed "Energy Shock" pre-mandate decision is GONE from
 * here — migrated into `events/eventCatalog.ts`'s `'energy-shock'` entry
 * (a high-probability early-mandate event, turns 1-12) rather than kept
 * duplicated in both places. See that file's header comment.
 */
