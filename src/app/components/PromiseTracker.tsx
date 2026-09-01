import { getPromiseDefinition } from '../../game/country-run/promises/promiseCatalog.ts'
import type { PromiseEvaluationContext, PromiseStatus } from '../../game/country-run/promises/promiseTypes.ts'

interface PromiseTrackerProps {
  selectedPromiseIds: readonly string[]
  context: PromiseEvaluationContext
}

const STATUS_LABEL: Record<PromiseStatus, string> = {
  NOT_STARTED: 'Pas commencé',
  IN_PROGRESS: 'En cours',
  ON_TRACK: 'Sur la bonne voie',
  AT_RISK: 'En danger',
  KEPT: 'Tenu',
  BROKEN: 'Rompu',
}

const STATUS_TREND: Record<PromiseStatus, 'up' | 'down' | 'neutral'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'neutral',
  ON_TRACK: 'up',
  AT_RISK: 'down',
  KEPT: 'up',
  BROKEN: 'down',
}

/**
 * Shown on every gameplay screen from mandate start onward (M3 §22-25).
 * Status is ALWAYS computed fresh from `context` via each promise's own
 * `evaluate` closure — never stored, so it can't drift from what the
 * player actually did (see promiseTypes.ts's header for the full
 * derived-vs-stored rationale).
 */
export function PromiseTracker({ selectedPromiseIds, context }: PromiseTrackerProps) {
  return (
    <div className="cr-card cr-promise-tracker">
      <p className="cr-eyebrow">Mes 5 engagements</p>
      <ul className="cr-promise-tracker__list">
        {selectedPromiseIds.map((id) => {
          const promise = getPromiseDefinition(id)
          const evaluation = promise.evaluate(context)
          return (
            <li key={id} className="cr-promise-tracker__item">
              <div className="cr-promise-tracker__head">
                <span>{promise.title}</span>
                <span className={`cr-indicator__trend cr-indicator__trend--${STATUS_TREND[evaluation.status]}`}>
                  {STATUS_LABEL[evaluation.status]}
                </span>
              </div>
              <div className="cr-promise-tracker__progress">{evaluation.progressLabel}</div>
              <div className="cr-promise-tracker__meta">Échéance : {promise.deadlineLabel}</div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
