import { classifyReformDifficulty } from '../../game/country-run/prototype/politicalCapital.ts'
import type { PoliticalBillDefinition } from '../../game/country-run/parliament/billTypes.ts'
import type { BillSupportEstimate } from '../../game/country-run/parliament/supportEstimate.ts'
import { formatSigned } from '../format.ts'

interface ReformCardData {
  definition: PoliticalBillDefinition
  support: BillSupportEstimate
}

interface ReformHubScreenProps {
  bills: ReformCardData[]
  politicalCapital: number
  onChoose: (billId: string) => void
  onSkip: () => void
}

/** M4 §31: "CONSEIL DES MINISTRES" — at most ONE discretionary reform per Year 1, in addition to the mandatory budget. */
export function ReformHubScreen({ bills, politicalCapital, onChoose, onSkip }: ReformHubScreenProps) {
  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Conseil des Ministres</p>
          <h1 className="cr-title">UNE RÉFORME POUR CETTE ANNÉE ?</h1>
          <p className="cr-body-text">
            Vous pouvez porter une réforme supplémentaire cette année, en plus du budget. Capital politique disponible :{' '}
            {politicalCapital} / 100.
          </p>
        </div>

        <div className="cr-choice-grid">
          {bills.map(({ definition, support }) => {
            const affordable = politicalCapital >= definition.requiredPoliticalCapital
            return (
              <button
                key={definition.id}
                type="button"
                className="cr-choice"
                disabled={!affordable}
                onClick={() => { onChoose(definition.id) }}
              >
                <span className="cr-choice__title">{definition.title}</span>
                <span className="cr-choice__copy">{definition.description}</span>
                <div className="cr-promise-card__meta">
                  <span>{formatSigned(definition.fiscalCost, 0, ' Md€/an')}</span>
                  <span>{classifyReformDifficulty(definition.controversy)}</span>
                </div>
                <p className="cr-small-text">
                  Soutien estimé : {support.likelyTotalLow}–{support.likelyTotalHigh} / {support.majorityNeeded} • Coût : {definition.requiredPoliticalCapital} capital
                </p>
              </button>
            )
          })}
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--secondary" onClick={onSkip}>
            PASSER — AUCUNE RÉFORME CETTE ANNÉE
          </button>
        </div>
      </div>
    </div>
  )
}
