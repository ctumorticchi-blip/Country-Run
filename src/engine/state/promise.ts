import type { Turn } from './gameState.ts'

export type PromiseStatus = 'pending' | 'kept' | 'partially_kept' | 'broken'

/**
 * A campaign promise: a quantified target with a deadline, tracked to a
 * final kept/partially_kept/broken status (Product Bible §9, "Suivi des
 * promesses").
 *
 * Named `GamePromise` rather than `Promise` — the bare name would shadow the
 * built-in `Promise` type everywhere it's imported.
 */
export interface GamePromise {
  id: string
  title: string
  /** Path or label of the metric this promise targets, e.g. "economic.deficitRatio". */
  target: string
  targetValue?: number
  deadlineTurn?: Turn
  status: PromiseStatus
}
