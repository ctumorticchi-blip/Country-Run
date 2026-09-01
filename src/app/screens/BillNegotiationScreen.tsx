import { classifyReformDifficulty, politicalCapitalCostRange } from '../../game/country-run/prototype/politicalCapital.ts'
import type { ActiveBillState } from '../../game/country-run/parliament/billTypes.ts'
import { CONCESSION_DEFINITIONS, type EffectiveBill } from '../../game/country-run/parliament/concessions.ts'
import type { ConcessionType, SupportConfidence } from '../../game/country-run/parliament/politicalTypes.ts'
import type { BillSupportEstimate } from '../../game/country-run/parliament/supportEstimate.ts'
import { formatMdEuros, formatSigned } from '../format.ts'

interface BillNegotiationScreenProps {
  effectiveBill: EffectiveBill
  support: BillSupportEstimate
  politicalCapital: number
  activeBill: ActiveBillState
  canUseExceptional: boolean
  onSeekSupport: (blocId: string) => void
  onOfferConcession: (concessionId: ConcessionType) => void
  onSpendCapital: (amount: number) => void
  onCallVote: () => void
  onUseExceptionalProcedure: () => void
}

const CONFIDENCE_LABEL: Record<SupportConfidence, string> = { HIGH: 'ÉLEVÉE', MEDIUM: 'MOYENNE', LOW: 'FAIBLE' }
const CAPITAL_SPEND_PRESETS = [5, 10, 20]

/** M4 §11-12: the negotiation drawer, reused for BOTH the mandatory Budget Bill and the discretionary reform. */
export function BillNegotiationScreen({
  effectiveBill,
  support,
  politicalCapital,
  activeBill,
  canUseExceptional,
  onSeekSupport,
  onOfferConcession,
  onSpendCapital,
  onCallVote,
  onUseExceptionalProcedure,
}: BillNegotiationScreenProps) {
  const { definition } = effectiveBill
  const difficulty = classifyReformDifficulty(definition.controversy)
  const [capitalLow, capitalHigh] = politicalCapitalCostRange(definition.controversy)
  const availableConcessions = definition.concessionsAvailable.filter((id) => !activeBill.appliedConcessionIds.includes(id))

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Négociations à l’Assemblée</p>
          <h1 className="cr-title">{definition.title}</h1>
          <p className="cr-body-text">{definition.description}</p>
        </div>

        <div className="cr-report-grid">
          <div className="cr-report-row">
            <span className="cr-report-row__label">Effet budgétaire</span>
            <span className="cr-report-row__value">{formatSigned(effectiveBill.fiscalCost, 0, ' Md€/an')}</span>
          </div>
          <div className="cr-report-row">
            <span className="cr-report-row__label">Difficulté politique</span>
            <span className="cr-report-row__value">{difficulty}</span>
          </div>
          <div className="cr-report-row">
            <span className="cr-report-row__label">Coût en capital politique</span>
            <span className="cr-report-row__value">{capitalLow}–{capitalHigh}</span>
          </div>
          <div className="cr-report-row">
            <span className="cr-report-row__label">Capital politique disponible</span>
            <span className="cr-report-row__value">{politicalCapital} / 100</span>
          </div>
        </div>

        <div className="cr-card">
          <p className="cr-eyebrow">Votes estimés</p>
          <div className="cr-vote-estimate">
            <div>
              <span className="cr-vote-estimate__label">Majorité présidentielle</span>
              <span className="cr-vote-estimate__value">{support.presidentialSeats}</span>
            </div>
            <div>
              <span className="cr-vote-estimate__label">Alliés probables</span>
              <span className="cr-vote-estimate__value">
                +{support.likelyAlliesLow} à +{support.likelyAlliesHigh}
              </span>
            </div>
            <div>
              <span className="cr-vote-estimate__label">Total probable</span>
              <span className="cr-vote-estimate__value">
                {support.likelyTotalLow}–{support.likelyTotalHigh}
              </span>
            </div>
            <div>
              <span className="cr-vote-estimate__label">Majorité requise</span>
              <span className="cr-vote-estimate__value">{support.majorityNeeded}</span>
            </div>
          </div>
          <p className={`cr-confidence-pill cr-confidence-pill--${support.confidence}`}>Confiance : {CONFIDENCE_LABEL[support.confidence]}</p>
        </div>

        <div className="cr-bloc-card-grid">
          {support.blocBreakdown.map((bloc) => (
            <div key={bloc.blocId} className="cr-bloc-card">
              <div className="cr-bloc-card__head">
                <span className="cr-bloc-card__name">{bloc.blocName}</span>
                <span className="cr-bloc-card__seats">{bloc.seats} sièges</span>
              </div>
              <p className={`cr-stance-pill cr-stance-pill--${bloc.stance}`}>{bloc.stance.replace(/_/g, ' ')}</p>
              {bloc.mainObjection ? <p className="cr-bloc-card__objection">« {bloc.mainObjection} »</p> : null}
              <p className="cr-bloc-card__range">
                Soutien potentiel : {bloc.supportRangeLow}–{bloc.supportRangeHigh} voix
              </p>
              <button
                type="button"
                className="cr-button cr-button--small"
                disabled={activeBill.courtedBlocIds.includes(bloc.blocId) || politicalCapital < 2}
                onClick={() => { onSeekSupport(bloc.blocId) }}
              >
                {activeBill.courtedBlocIds.includes(bloc.blocId) ? 'DÉJÀ COURTISÉ' : 'RECHERCHER LE SOUTIEN (-2)'}
              </button>
            </div>
          ))}
        </div>

        {availableConcessions.length > 0 ? (
          <div className="cr-card">
            <p className="cr-eyebrow">Offrir une concession</p>
            <div className="cr-choice-grid">
              {availableConcessions.map((id) => {
                const concession = CONCESSION_DEFINITIONS.find((c) => c.id === id)
                if (!concession) return null
                return (
                  <button key={id} type="button" className="cr-choice" onClick={() => { onOfferConcession(id) }}>
                    <span className="cr-choice__title">{concession.label}</span>
                    <span className="cr-choice__copy">{concession.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="cr-card">
          <p className="cr-eyebrow">Dépenser du capital politique</p>
          <div className="cr-button-row">
            {CAPITAL_SPEND_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                className="cr-button cr-button--secondary"
                disabled={politicalCapital < amount}
                onClick={() => { onSpendCapital(amount) }}
              >
                -{amount} CAPITAL
              </button>
            ))}
          </div>
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onCallVote}>
            APPELER AU VOTE
          </button>
          {canUseExceptional ? (
            <button type="button" className="cr-button cr-button--secondary" onClick={onUseExceptionalProcedure}>
              ENGAGER LA RESPONSABILITÉ DU GOUVERNEMENT
            </button>
          ) : null}
        </div>
        <p className="cr-small-text">{formatMdEuros(effectiveBill.fiscalCost)}/an au total, concessions comprises.</p>
      </div>
    </div>
  )
}
