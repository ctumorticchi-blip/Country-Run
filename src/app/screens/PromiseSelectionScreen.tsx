import { PROMISE_CATALOG } from '../../game/country-run/promises/promiseCatalog.ts'
import { REQUIRED_PROMISE_COUNT } from '../../game/country-run/promises/promiseSelection.ts'
import type { PromiseCategory, PromiseDifficulty } from '../../game/country-run/promises/promiseTypes.ts'

interface PromiseSelectionScreenProps {
  selectedPromiseIds: readonly string[]
  onToggle: (promiseId: string) => void
  onConfirm: () => void
}

const CATEGORY_LABEL: Record<PromiseCategory, string> = {
  purchasingPower: 'Pouvoir d’achat',
  employment: 'Emploi',
  publicFinances: 'Finances publiques',
  health: 'Santé',
  education: 'Éducation',
  security: 'Sécurité',
  environment: 'Environnement',
  housing: 'Logement',
  pensions: 'Retraites',
  taxation: 'Fiscalité',
  publicServices: 'Services publics',
  investment: 'Investissement',
}

const DIFFICULTY_DOTS: Record<PromiseDifficulty, string> = {
  LOW: '●○○',
  MEDIUM: '●●○',
  HIGH: '●●●',
}

/** Exactly 5 promises, no more, no fewer (M3 §3) — selection/unselection only, nothing here blocks contradictory combinations. */
export function PromiseSelectionScreen({ selectedPromiseIds, onToggle, onConfirm }: PromiseSelectionScreenProps) {
  const count = selectedPromiseIds.length
  const atMax = count >= REQUIRED_PROMISE_COUNT

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Programme de campagne</p>
          <h1 className="cr-title">CHOISISSEZ 5 ENGAGEMENTS</h1>
          <p className="cr-body-text">
            Rien ne vous empêche de choisir un programme difficile à financer — mais Bercy vous le fera savoir.
          </p>
        </div>

        <div className="cr-choice-grid cr-choice-grid--3">
          {PROMISE_CATALOG.map((promise) => {
            const selected = selectedPromiseIds.includes(promise.id)
            const disabled = !selected && atMax
            return (
              <button
                key={promise.id}
                type="button"
                className={`cr-choice cr-promise-card${selected ? ' cr-promise-card--selected' : ''}`}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => { onToggle(promise.id) }}
              >
                <span className="cr-choice__title">{promise.title}</span>
                <span className="cr-choice__copy">{promise.shortDescription}</span>
                <div className="cr-promise-card__meta">
                  <span>{CATEGORY_LABEL[promise.category]}</span>
                  <span title={`Difficulté : ${promise.difficulty}`}>{DIFFICULTY_DOTS[promise.difficulty]}</span>
                </div>
                {promise.estimatedAnnualCost > 0 ? (
                  <span className="cr-promise-card__cost">≈ {promise.estimatedAnnualCost} Md€/an</span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="cr-summary">
          <div className="cr-summary__row">
            <dt>Engagements choisis</dt>
            <dd>{count} / {REQUIRED_PROMISE_COUNT}</dd>
          </div>
          <div className="cr-button-row">
            <button type="button" className="cr-button cr-button--primary" disabled={count !== REQUIRED_PROMISE_COUNT} onClick={onConfirm}>
              CONFIRMER MON PROGRAMME
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
