/**
 * Core Parliament constants, shared by the legislative-election generator
 * (`parliamentComposition.ts`) and the M4 bill/negotiation system
 * (`parliament/`). M4 §21 explicitly replaced M2's old single seeded
 * coin-flip negotiate/maintain/concede Budget vote (previously here) with
 * the full bloc-negotiation pipeline — see `parliament/voteResolution.ts`.
 */
export const TOTAL_SEATS = 577
export const ABSOLUTE_MAJORITY = 289

/** Used when a bill (currently only the mandatory Budget Bill) is forced through as a watered-down compromise after exhausting its vote attempts without passing (M4 §19). */
export const COMPROMISE_SCALE_ON_REJECTION = 0.5
