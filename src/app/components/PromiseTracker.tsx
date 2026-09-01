import { getPromiseDefinition } from '../../game/country-run/promises/promiseCatalog.ts'
import { displayStatusForPromise, type PromiseResolution } from '../../game/country-run/promises/promiseResolution.ts'
import type { PromiseEvaluationContext, PromiseStatus } from '../../game/country-run/promises/promiseTypes.ts'

interface PromiseTrackerProps {
  selectedPromiseIds: readonly string[]
  context: PromiseEvaluationContext
  /** Frozen deadline outcomes (M5 §15-16) — once present for a promise, its status never oscillates again. */
  resolutions?: readonly PromiseResolution[]
}

const STATUS_LABEL: Record<PromiseStatus, string> = {
  NOT_STARTED: 'Pas commencé',
  IN_PROGRESS: 'En cours',
  ON_TRACK: 'Sur la bonne voie',
  AT_RISK: 'En danger',
  KEPT: 'Tenu',
  PARTIAL: 'Partiellement tenu',
  BROKEN: 'Rompu',
}

const STATUS_TREND: Record<PromiseStatus, 'up' | 'down' | 'neutral'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'neutral',
  ON_TRACK: 'up',
  AT_RISK: 'down',
  KEPT: 'up',
  PARTIAL: 'neutral',
  BROKEN: 'down',
}

/**
 * Shown on every gameplay screen from mandate start onward (M3 §22-25).
 * Status is computed via `displayStatusForPromise`: a fresh derived read
 * from `context` before the promise's deadline, or the frozen
 * `PromiseResolution` after — never re-derived from live state past its
 * deadline (see promiseResolution.ts for why oscillation must stop there).
 */
export function PromiseTracker({ selectedPromiseIds, context, resolutions = [] }: PromiseTrackerProps) {
  return (
    <div className="cr-card cr-promise-tracker">
      <p className="cr-eyebrow">Mes 5 engagements</p>
      <ul className="cr-promise-tracker__list">
        {selectedPromiseIds.map((id) => {
          const promise = getPromiseDefinition(id)
          const evaluation = displayStatusForPromise(promise, resolutions, context)
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
