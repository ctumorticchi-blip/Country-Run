import type { EconomicState } from '../../engine/state/gameState.ts'
import { formatTurnPeriod, turnToGameplayYear } from '../../game/country-run/mandate/calendar.ts'
import { formatPercent, purchasingPowerIndex } from '../format.ts'

interface MandateTurnScreenProps {
  turn: number
  economic: EconomicState
  popularity: number
  politicalCapital: number
  governmentTension: number
  onAdvance: () => void
}

/** M5 §5-6, §43: the MANDATE_TURN dashboard/hub — the calendar only ever advances via the explicit "AVANCER" click, never automatically. */
export function MandateTurnScreen({ turn, economic, popularity, politicalCapital, governmentTension, onAdvance }: MandateTurnScreenProps) {
  // Turn 0 is the pre-mandate moment right before turn 1 is first played — there is no "turn 0 period" on the calendar (turnToDate/formatTurnPeriod are only defined for turns 1-30), so this dashboard shows what's ABOUT to start rather than a nonexistent past period.
  const isBeforeFirstTurn = turn === 0
  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div className="cr-dashboard">
          <p className="cr-eyebrow cr-dashboard__period">{isBeforeFirstTurn ? 'Prise de fonction' : formatTurnPeriod(turn)}</p>
          <h1 className="cr-title">ANNÉE {isBeforeFirstTurn ? 1 : turnToGameplayYear(turn)} — MANDAT</h1>
        </div>

        <div className="cr-indicator-grid">
          <div className="cr-indicator">
            <span className="cr-indicator__label">Croissance</span>
            <span className="cr-indicator__value">{formatPercent(economic.growth)}</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Chômage</span>
            <span className="cr-indicator__value">{formatPercent(economic.unemployment)}</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Inflation</span>
            <span className="cr-indicator__value">{formatPercent(economic.inflation)}</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Déficit</span>
            <span className="cr-indicator__value">{formatPercent(economic.deficitRatio)} PIB</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Dette</span>
            <span className="cr-indicator__value">{formatPercent(economic.debtRatio, 0)} PIB</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Pouvoir d’achat</span>
            <span className="cr-indicator__value">{purchasingPowerIndex(economic.purchasingPower).toFixed(1)}</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Popularité</span>
            <span className="cr-indicator__value">{popularity.toFixed(0)}%</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Capital politique</span>
            <span className="cr-indicator__value">{politicalCapital.toFixed(0)} / 100</span>
          </div>
          <div className="cr-indicator">
            <span className="cr-indicator__label">Tension gouvernementale</span>
            <span className="cr-indicator__value">{governmentTension.toFixed(0)} / 100</span>
          </div>
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onAdvance}>
            AVANCER — {formatTurnPeriod(turn + 1)}
          </button>
        </div>
      </div>
    </div>
  )
}
