/**
 * Content for the France Briefing screen (M3 §5): every headline indicator
 * the player sees at mandate start, tagged with where the number comes
 * from. `'OBSERVED'` exists in the type for when a real, sourced dataset
 * lands (Product Bible §19) — this milestone's whole dataset is still the
 * documented fictional placeholder from `data/initialState.ts` /
 * `data/initialWorldState.ts`, so nothing here is honestly labelled
 * OBSERVED yet. Using it prematurely would misrepresent a made-up number as
 * real data, which this project's docs explicitly forbid.
 */
export type IndicatorProvenance = 'OBSERVED' | 'FORECAST' | 'GAME_ESTIMATE'

export const PROVENANCE_LABEL: Record<IndicatorProvenance, string> = {
  OBSERVED: 'Donnée observée',
  FORECAST: 'Prévision',
  GAME_ESTIMATE: 'Estimation de jeu',
}

export interface BriefingIndicatorContent {
  id: string
  label: string
  provenance: IndicatorProvenance
  explanation: string
}

export const FRANCE_BRIEFING_INDICATORS: BriefingIndicatorContent[] = [
  {
    id: 'growth',
    label: 'Croissance',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Rythme annualisé de progression du PIB. Point de départ fictif calibré pour ce prototype — pas une donnée officielle.',
  },
  {
    id: 'unemployment',
    label: 'Chômage',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Part de la population active sans emploi. Point de départ fictif, calibré sur un ordre de grandeur plausible.',
  },
  {
    id: 'inflation',
    label: 'Inflation',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Hausse annualisée des prix. Point de départ fictif pour ce prototype.',
  },
  {
    id: 'deficit',
    label: 'Déficit public',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Écart entre recettes et dépenses publiques, en % du PIB. Point de départ fictif.',
  },
  {
    id: 'debt',
    label: 'Dette publique',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Stock de dette publique cumulée, en % du PIB. Point de départ fictif.',
  },
  {
    id: 'purchasingPower',
    label: 'Pouvoir d’achat',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Indice 100 = point de départ de votre mandat. Suit le pouvoir d’achat moyen des ménages au fil du temps.',
  },
  {
    id: 'oilPrice',
    label: 'Prix de l’énergie (monde)',
    provenance: 'GAME_ESTIMATE',
    explanation: 'Indice mondial du prix du pétrole, 100 = niveau au début de votre mandat. Un contexte extérieur que vous ne contrôlez pas.',
  },
  {
    id: 'marketConfidence',
    label: 'Confiance des marchés',
    provenance: 'FORECAST',
    explanation: 'Anticipation des marchés financiers sur la trajectoire de vos finances publiques — évolue avec vos décisions et le profil de gouvernement choisi.',
  },
]
