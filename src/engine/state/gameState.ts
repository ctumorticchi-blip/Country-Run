import type { DelayedEffect } from '../effects/delayedEffect.ts'

/** A deterministic PRNG seed. Same seed => same game trajectory. */
export type Seed = string

/** Turn counter. One turn = 2 in-fiction months (see GameMeta). */
export type Turn = number

/**
 * Coarse lifecycle phase of a run. Deliberately minimal for M0 — this is a
 * placeholder extended in M1+ as campaign/government/election phases are
 * built (see Product Bible §3, §13).
 */
export type GamePhase = 'setup' | 'in_progress' | 'ended'

export interface GameMeta {
  seed: Seed
  turn: Turn
  year: number
  month: number
  phase: GamePhase
}

/**
 * Headline economic indicators (Product Bible §4 "Indicateurs principaux").
 * M0 only carries the numbers themselves — the Economic Engine that computes
 * their evolution turn over turn is out of scope (see docs/ARCHITECTURE.md).
 */
export interface EconomicState {
  gdp: number
  growth: number
  inflation: number
  unemployment: number
  deficitRatio: number
  debt: number
  debtRatio: number
  purchasingPower: number
}

export interface PoliticalState {
  popularity: number
  parliamentSeats: number
  politicalCredibility: number
}

export interface SocialState {
  socialTension: number
}

export interface PolicyState {
  /** IDs of currently active policies/reforms, e.g. "pension_reform". */
  activePolicies: string[]
}

export interface GameState {
  meta: GameMeta
  economic: EconomicState
  political: PoliticalState
  social: SocialState
  policy: PolicyState
  delayedEffects: DelayedEffect[]
}
