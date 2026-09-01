import { getPromiseDefinition } from '../../game/country-run/promises/promiseCatalog.ts'
import { isFiscallyDifficult, totalEstimatedAnnualCost } from '../../game/country-run/promises/promiseSelection.ts'

interface PromiseConfirmationScreenProps {
  selectedPromiseIds: readonly string[]
  onProceed: () => void
}

/** "No Free Lunch" (M3 §10): the warning is informational only — nothing here blocks proceeding, even on a difficult programme. */
export function PromiseConfirmationScreen({ selectedPromiseIds, onProceed }: PromiseConfirmationScreenProps) {
  const totalCost = totalEstimatedAnnualCost(selectedPromiseIds)
  const difficult = isFiscallyDifficult(selectedPromiseIds)

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Votre programme</p>
          <h1 className="cr-title">VOTRE PROGRAMME DE CAMPAGNE</h1>
        </div>

        <div className="cr-report-grid">
          {selectedPromiseIds.map((id) => {
            const promise = getPromiseDefinition(id)
            return (
              <div className="cr-report-row" key={id}>
                <span className="cr-report-row__label">{promise.title}</span>
                <span className="cr-report-row__value">{promise.estimatedAnnualCost > 0 ? `${promise.estimatedAnnualCost} Md€/an` : '—'}</span>
              </div>
            )
          })}
        </div>

        <div className="cr-card">
          <div className="cr-summary__row">
            <dt>Coût brut estimé</dt>
            <dd>{totalCost} Md€/an</dd>
          </div>
        </div>

        {difficult ? (
          <div className="cr-warning-banner cr-warning-banner--severe">
            ⚠️ PROGRAMME DIFFICILE À FINANCER — Bercy vous demandera des arbitrages dès votre arrivée. Rien ne vous empêche de le
            maintenir tel quel.
          </div>
        ) : null}

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onProceed}>
            LANCER LA CAMPAGNE
          </button>
        </div>
      </div>
    </div>
  )
}
