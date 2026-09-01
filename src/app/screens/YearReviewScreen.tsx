import type { EconomicState } from '../../engine/state/gameState.ts'
import { turnToGameplayYear } from '../../game/country-run/mandate/calendar.ts'
import type { FinalScoreBreakdown } from '../../game/country-run/mandate/finalScoring.ts'
import { formatPercent, purchasingPowerIndex } from '../format.ts'

interface YearReviewScreenProps {
  turn: number
  isMidterm: boolean
  initialEconomic: EconomicState
  currentEconomic: EconomicState
  initialPopularity: number
  currentPopularity: number
  politicalCapital: number
  governmentTension: number
  scoreBreakdown: FinalScoreBreakdown
  onContinue: () => void
}

function reportRow(label: string, from: string, to: string) {
  return (
    <div className="cr-report-row" key={label}>
      <span className="cr-report-row__label">{label}</span>
      <span className="cr-report-row__value">
        {from} → {to}
      </span>
    </div>
  )
}

/** BILAN ANNÉE X (M5 §51) — also carries the MI-MANDAT banner at turn 18 rather than a separate screen (§48). The score shown is explicitly provisional: the mandate isn't over. */
export function YearReviewScreen({
  turn,
  isMidterm,
  initialEconomic,
  currentEconomic,
  initialPopularity,
  currentPopularity,
  politicalCapital,
  governmentTension,
  scoreBreakdown,
  onContinue,
}: YearReviewScreenProps) {
  const year = turnToGameplayYear(turn)
  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Bilan</p>
          <h1 className="cr-title">BILAN — ANNÉE {year}</h1>
          {isMidterm ? <span className="cr-badge">MI-MANDAT</span> : null}
        </div>

        <div className="cr-card cr-score">
          <div className="cr-score__value">{scoreBreakdown.total.toLocaleString('fr-FR')}</div>
          <div className="cr-body-text">/ 10 000 — note de mandat provisoire</div>
        </div>

        <div className="cr-report-grid">
          {reportRow('Croissance', formatPercent(initialEconomic.growth), formatPercent(currentEconomic.growth))}
          {reportRow('Chômage', formatPercent(initialEconomic.unemployment), formatPercent(currentEconomic.unemployment))}
          {reportRow('Inflation', formatPercent(initialEconomic.inflation), formatPercent(currentEconomic.inflation))}
          {reportRow('Déficit', formatPercent(initialEconomic.deficitRatio), formatPercent(currentEconomic.deficitRatio))}
          {reportRow('Dette', formatPercent(initialEconomic.debtRatio, 1), formatPercent(currentEconomic.debtRatio, 1))}
          {reportRow(
            'Pouvoir d’achat',
            purchasingPowerIndex(initialEconomic.purchasingPower).toFixed(1),
            purchasingPowerIndex(currentEconomic.purchasingPower).toFixed(1),
          )}
          {reportRow('Popularité', `${initialPopularity.toFixed(0)}%`, `${currentPopularity.toFixed(0)}%`)}
        </div>

        <div className="cr-report-row">
          <span className="cr-report-row__label">Capital politique</span>
          <span className="cr-report-row__value">{politicalCapital.toFixed(0)} / 100</span>
        </div>
        <div className="cr-report-row">
          <span className="cr-report-row__label">Tension gouvernementale</span>
          <span className="cr-report-row__value">{governmentTension.toFixed(0)} / 100</span>
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onContinue}>
            CONTINUER — ANNÉE {year + 1}
          </button>
        </div>
      </div>
    </div>
  )
}
