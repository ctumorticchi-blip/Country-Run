import type { PolicyAffinity } from './politicalTypes.ts'
import type { ConcessionType } from './politicalTypes.ts'

/**
 * An explicit record of one negotiated agreement with a bloc (M4 §15) —
 * plain, serializable data, visible in `GamePrototypeState.politicalDeals`
 * (history), never a class instance.
 */
export interface PoliticalDeal {
  id: string
  blocId: string
  billId: string
  turn: number
  concessions: ConcessionType[]
  /** The bloc's estimated seat contribution at the time the deal was struck (a snapshot of the support estimate, not re-derived later). */
  expectedVotes: number
  relationshipEffect: number
  fiscalImpact: number
  policyImpact: PolicyAffinity
  /** Set once the vote resolves — true if this bloc's seats actually favored the bill (M4 §16 "fulfilled" tracking). */
  fulfilled: boolean
}

export function createDeal(params: Omit<PoliticalDeal, 'id' | 'fulfilled'>): PoliticalDeal {
  return { ...params, id: `${params.billId}:${params.blocId}:t${String(params.turn)}`, fulfilled: false }
}

export function markDealFulfilled(deal: PoliticalDeal, fulfilled: boolean): PoliticalDeal {
  return { ...deal, fulfilled }
}
