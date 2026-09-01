import type { PoliticalTag } from '../promises/promiseTypes.ts'
import type { ConcessionType, NegotiationStyle, PolicyAffinity, PolicyDimension } from './politicalTypes.ts'

/**
 * Static content describing one of the 7 canonical blocs (M4 §2-3) — like
 * `promiseCatalog.ts`/`governmentProfiles.ts`, this is data-as-code, never
 * part of serializable game state. The PER-PLAYTHROUGH seat count for each
 * bloc stays exactly where M3 put it: `ParliamentComposition.blocs`
 * (`prototype/parliamentComposition.ts`), generated once at the legislative
 * election and looked up by `id` here for everything else (affinity,
 * negotiation style...).
 */
export interface ParliamentBlocDefinition {
  id: string
  name: string
  shortName: string
  description: string
  policyAffinity: PolicyAffinity
  negotiationStyle: NegotiationStyle
  /** [0, 1] — how consistently this bloc votes its stated affinity vs. drifting on deterministic noise at vote time. */
  reliability: number
  /** [-1, 1] — baseline disposition toward a presidential bill before policyAffinity is even considered. */
  baseGovernmentSupport: number
  /** Dimensions where a strongly opposed bill value (<= -0.5) caps support near-zero regardless of concessions. */
  redLines: PolicyDimension[]
  preferredConcessions: ConcessionType[]
  politicalTags: PoliticalTag[]
  /** Generation-only input for `parliamentComposition.ts`'s seat split — not part of the brief's suggested field list, but needed so seat sizes stay data-driven per bloc rather than hardcoded in the generator. */
  seatWeight: number
}
