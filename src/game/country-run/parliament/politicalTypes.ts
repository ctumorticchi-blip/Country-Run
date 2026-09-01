/**
 * Shared primitive types for the M4 political-strategy layer (parliament/),
 * kept in one file so `blocTypes.ts`, `billTypes.ts` and `concessions.ts`
 * can all import from here without a circular dependency between them.
 */

/**
 * The axes a bill or a bloc can lean on (M4 §4). Each is a signed
 * INTENSITY, not an absolute policy value: for `businessTax`/`householdTax`,
 * +1 means "this bill raises that tax", -1 means "this bill cuts it"; for
 * `laborMarket`, +1 means "deregulates/flexibilizes", -1 means "protects/
 * regulates more"; for the rest, +1 means "spends more / does more of this",
 * -1 means "cuts / does less of this". A bloc's `PolicyAffinity` on the same
 * dimension says how favorably it views a bill leaning that way.
 */
export type PolicyDimension =
  | 'publicSpending'
  | 'fiscalDiscipline'
  | 'businessTax'
  | 'householdTax'
  | 'environment'
  | 'health'
  | 'education'
  | 'defense'
  | 'pensions'
  | 'housing'
  | 'laborMarket'
  | 'publicInvestment'

/** Each present dimension is in [-1, 1] — absent means "this bloc has no strong view on that axis". */
export type PolicyAffinity = Partial<Record<PolicyDimension, number>>

/** How a bloc tends to behave in negotiation — flavor + a light effect on `reliability`/`redLines` weight, never a hidden extra multiplier. */
export type NegotiationStyle = 'PRINCIPLED' | 'TRANSACTIONAL' | 'OPPORTUNISTIC' | 'LOYAL'

/**
 * The 6 reusable concession types (M4 §12, §23) — deliberately few and
 * generic rather than "dozens" of bespoke ones. Each concession is usable
 * on any bill that lists it in `concessionsAvailable`.
 */
export type ConcessionType =
  | 'INCREASE_HOUSING_FUNDING'
  | 'INCREASE_HEALTH_FUNDING'
  | 'INCREASE_GREEN_INVESTMENT'
  | 'INCREASE_TERRITORIAL_SUPPORT'
  | 'CUT_BUSINESS_TAX'
  | 'REDUCE_SPENDING_CAP'

export type BillStatus = 'DRAFT' | 'NEGOTIATING' | 'READY_FOR_VOTE' | 'ADOPTED' | 'REJECTED' | 'WITHDRAWN'

export type BillUrgency = 'LOW' | 'MEDIUM' | 'HIGH'

export type BlocStance = 'FORTEMENT_FAVORABLE' | 'PLUTÔT_FAVORABLE' | 'PARTAGÉ' | 'PLUTÔT_DÉFAVORABLE' | 'FORTEMENT_DÉFAVORABLE'

export type SupportConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
