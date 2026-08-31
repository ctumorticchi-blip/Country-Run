import type { EconomicPolicyInput, ExternalShock } from '../../../engine/economy/types.ts'
import type { BudgetSelections } from '../budget/budgetTypes.ts'

/** The Year 1 vertical slice's screen sequence (Product Bible §13, scoped to M2). */
export type ScreenId =
  | 'landing'
  | 'election'
  | 'bercyAudit'
  | 'energyShock'
  | 'budgetBuilder'
  | 'parliament'
  | 'yearReport'

export interface DecisionChoicePreview {
  label: string
  direction: 'up' | 'down' | 'strongUp' | 'strongDown' | 'neutral' | 'mixed'
}

/** One selectable option within a prototype decision (Bercy audit, energy shock). */
export interface DecisionChoice {
  id: string
  title: string
  copy: string
  previews: DecisionChoicePreview[]
  /** Real engine effect — merged into the accumulated policy stance (see policyDelta.ts, "Policy input units"). */
  policyDelta?: Partial<EconomicPolicyInput>
  /** Prototype-only popularity nudge (see popularity.ts) — never fed to the generic engine. */
  popularityDelta: number
  /** Prototype-only politicalCredibility nudge (GameState.political.politicalCredibility). */
  credibilityDelta?: number
}

export interface DecisionConfig {
  id: string
  title: string
  text: string
  choices: DecisionChoice[]
  /** Only the energy-shock decision carries an ExternalShock — applied regardless of the player's choice. */
  shock?: ExternalShock
}

export interface ParliamentChoiceConfig {
  id: 'negotiate' | 'maintain' | 'concede'
  title: string
  copy: string
  passProbability: number
  concession: Partial<EconomicPolicyInput>
  popularityDelta: number
}

export type ParliamentOutcome = 'adopted' | 'rejected'

/** Accumulated player choices for the run — enough to replay deterministically from the same seed. */
export interface PlayerChoices {
  bercyChoiceId: string | null
  energyChoiceId: string | null
  budgetSelections: BudgetSelections
  parliamentChoiceId: ParliamentChoiceConfig['id'] | null
}
