/**
 * M6.5 §24-32: NATIONAL PROJECTS — make large public investment decisions
 * VISIBLE and CONCRETE, distinct from an abstract delayed macro
 * coefficient. Deliberately a presentation/tracking layer: `totalCost`/
 * `annualCost` are COPIED from the triggering bill's own already-charged
 * `fiscalCost` for display only — this module never appends a fiscal
 * ledger entry or an `EconomicPolicyInput` effect of its own (§27's "the
 * fiscal ledger remains the accounting source of truth"; see
 * `projectEngine.test.ts`'s explicit no-double-counting tests). The real
 * economic effect a project's underlying bill has is entirely the
 * existing, already-tested `economicPolicyEffect`/`implementationDelay`
 * mechanism — a project simply narrates it (§29's construction vs
 * completion framing lives in `economicEffects`/`serviceEffects`' text,
 * which the UI swaps based on `status`).
 */
export type NationalProjectStatus = 'PLANNED' | 'UNDER_CONSTRUCTION' | 'DELAYED' | 'COMPLETED' | 'CANCELLED'

export type NationalProjectCategory =
  | 'TRANSPORT'
  | 'ENERGY'
  | 'HEALTH'
  | 'RESEARCH'
  | 'INDUSTRY'
  | 'HOUSING'
  | 'DEFENSE'
  | 'DIGITAL'
  | 'CLIMATE'

export interface NationalProject {
  id: string
  /** The catalog template id this instance was launched from (`projectCatalog.ts`). */
  catalogId: string
  name: string
  category: NationalProjectCategory
  description: string
  /** Display only — copied from the triggering bill's `fiscalCost` at launch. Never re-charged. */
  totalCost: number
  annualCost: number
  startTurn: number
  expectedCompletionTurn: number
  /** [0, 100]. */
  progress: number
  status: NationalProjectStatus
  economicEffectsDuringConstruction: string[]
  economicEffectsOnCompletion: string[]
  serviceEffectsOnCompletion: string[]
  riskTags: string[]
  eventTags: string[]
  /** What launched this instance — a bill id or an event:choice id, for History/causal-language purposes. */
  source: string
}
