/**
 * ⚠️ PROTOTYPE-ONLY BLOC MEMORY (M4 §14). Bloc-level political memory only
 * — never individual-character relationships. One signed score per bloc,
 * in [-100, 100], nudged by concrete negotiation outcomes. Serializable
 * (a plain object), immutable (every function returns a new object).
 */
export type BlocRelations = Partial<Record<string, number>>

export const MIN_RELATION = -100
export const MAX_RELATION = 100

export function getRelation(relations: BlocRelations, blocId: string): number {
  return relations[blocId] ?? 0
}

function clampRelation(value: number): number {
  return Math.min(MAX_RELATION, Math.max(MIN_RELATION, value))
}

export function adjustRelation(relations: BlocRelations, blocId: string, delta: number): BlocRelations {
  if (delta === 0) return relations
  return { ...relations, [blocId]: clampRelation(getRelation(relations, blocId) + delta) }
}

/**
 * Relationship deltas for concrete negotiation/vote outcomes (M4 §14) —
 * centralized here so nothing scatters a bespoke magic number elsewhere.
 */
export const RELATIONSHIP_EFFECTS = {
  /** A bloc's preferred concession was granted on a bill it ended up supporting. */
  SUCCESSFUL_AGREEMENT: 6,
  /** The bloc was courted (SEEK_SUPPORT) and then voted for the bill. */
  COURTED_AND_DELIVERED: 3,
  /** The bloc was courted, or received a targeted concession, but the bill still failed. */
  BROKEN_AGREEMENT: -8,
  /** The exceptional procedure was used against this bloc's clear opposition. */
  PROCEDURAL_FORCING: -12,
  /** A bill it strongly supported passed even without being specifically courted. */
  PASSIVE_GOODWILL: 2,
} as const
