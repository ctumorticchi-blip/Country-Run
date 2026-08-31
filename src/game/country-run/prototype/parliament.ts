import type { SeededRng } from '../../../engine/seeded-rng/SeededRng.ts'
import type { ParliamentChoiceConfig, ParliamentOutcome } from './types.ts'

/**
 * ⚠️ PROTOTYPE-ONLY PARLIAMENT (M2 §15, "Parliament — M2 Lite"). A single
 * seeded coin flip against a probability set by the player's negotiating
 * stance — not the "modèle parlementaire exhaustif" the Product Bible
 * explicitly keeps out of scope. Lives entirely in Country Run's game
 * logic, never in the generic engine.
 */
export const TOTAL_SEATS = 577
export const ABSOLUTE_MAJORITY = 289
export const COALITION_SEATS = 263
export const SEATS_MISSING = ABSOLUTE_MAJORITY - COALITION_SEATS

export const PARLIAMENT_CHOICES: ParliamentChoiceConfig[] = [
  {
    id: 'negotiate',
    title: 'NÉGOCIER',
    copy: 'Une petite concession politique et budgétaire pour rallier des voix.',
    passProbability: 0.8,
    concession: { transfersChanges: 2 },
    popularityDelta: -1,
  },
  {
    id: 'maintain',
    title: 'MAINTENIR LE TEXTE',
    copy: 'Aucune concession. Le résultat reste incertain.',
    passProbability: 0.55,
    concession: {},
    popularityDelta: 0,
  },
  {
    id: 'concede',
    title: 'FAIRE UNE CONCESSION IMPORTANTE',
    copy: 'Le budget se dégrade légèrement, mais l’adoption devient très probable.',
    passProbability: 0.92,
    concession: { currentSpendingChanges: 5 },
    popularityDelta: -1,
  },
]

export function getParliamentChoice(id: ParliamentChoiceConfig['id']): ParliamentChoiceConfig {
  const choice = PARLIAMENT_CHOICES.find((c) => c.id === id)
  if (!choice) throw new Error(`Unknown parliament choice: ${id}`)
  return choice
}

/**
 * Deterministic for a given RNG (same seed + same player choice => same
 * outcome — see `createActionRng`, `rng.ts`). Never calls `Math.random()`.
 */
export function resolveParliamentVote(choice: ParliamentChoiceConfig, rng: SeededRng): ParliamentOutcome {
  return rng.chance(choice.passProbability) ? 'adopted' : 'rejected'
}

/**
 * "Automatically simulate a simplified compromise budget" on rejection
 * (M2 §15) — no re-vote, no government-collapse mechanic. Halves the
 * magnitude of every Md€ policy field, a blunt but simple stand-in for a
 * watered-down compromise.
 */
export const COMPROMISE_SCALE_ON_REJECTION = 0.5
