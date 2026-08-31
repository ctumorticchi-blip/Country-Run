import type { StatePath } from '../../shared/types/path.ts'

type Comparable = number | string | boolean

interface EqualsCondition {
  type: 'eq'
  path: StatePath
  value: Comparable
}

interface NotEqualsCondition {
  type: 'neq'
  path: StatePath
  value: Comparable
}

interface GreaterThanCondition {
  type: 'gt'
  path: StatePath
  value: number
}

interface GreaterThanOrEqualCondition {
  type: 'gte'
  path: StatePath
  value: number
}

interface LessThanCondition {
  type: 'lt'
  path: StatePath
  value: number
}

interface LessThanOrEqualCondition {
  type: 'lte'
  path: StatePath
  value: number
}

/** True when `state.policy.activePolicies` contains `policyId`. */
interface HasPolicyCondition {
  type: 'hasPolicy'
  policyId: string
}

interface AndCondition {
  type: 'and'
  conditions: Condition[]
}

interface OrCondition {
  type: 'or'
  conditions: Condition[]
}

interface NotCondition {
  type: 'not'
  condition: Condition
}

/**
 * A data-driven, composable predicate over a GameState.
 *
 * Comparison conditions (`eq`/`neq`/`gt`/`gte`/`lt`/`lte`) read a value from
 * the state via a dot-separated `path` (see StatePath) and compare it to a
 * literal. `and`/`or`/`not` combine conditions. `hasPolicy` is a dedicated
 * predicate because policies live in an array, not a single comparable
 * field.
 *
 * Content authors compose these instead of writing bespoke boolean logic,
 * e.g. `unemployment > 9` becomes
 * `{ type: 'gt', path: 'economic.unemployment', value: 9 }`.
 */
export type Condition =
  | EqualsCondition
  | NotEqualsCondition
  | GreaterThanCondition
  | GreaterThanOrEqualCondition
  | LessThanCondition
  | LessThanOrEqualCondition
  | HasPolicyCondition
  | AndCondition
  | OrCondition
  | NotCondition
