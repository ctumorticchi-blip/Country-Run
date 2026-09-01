import { useState } from 'react'
import type { EconomicState } from '../../engine/state/gameState.ts'
import { BUDGET_BILL_ID } from '../../game/country-run/parliament/budgetBillDerivation.ts'
import type { BillHistoryEntry } from '../../game/country-run/parliament/billTypes.ts'
import type { EndingTitle, ScoreBreakdown } from '../../game/country-run/prototype/scoring.ts'
import { formatPercent, purchasingPowerIndex } from '../format.ts'

interface YearReportScreenProps {
  initialEconomic: EconomicState
  finalEconomic: EconomicState
  initialPopularity: number
  finalPopularity: number
  politicalCapital: number
  billHistory: BillHistoryEntry[]
  scoreBreakdown: ScoreBreakdown
  endingTitle: EndingTitle
  onReplaySameSeed: () => void
  onNewGame: () => void
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

function shareText(scoreBreakdown: ScoreBreakdown, initialEconomic: EconomicState, finalEconomic: EconomicState, finalPopularity: number): string {
  return [
    '🇫🇷 COUNTRY RUN',
    `Score: ${String(scoreBreakdown.total)} / 10 000`,
    `Dette: ${initialEconomic.debtRatio.toFixed(0)}% → ${finalEconomic.debtRatio.toFixed(0)}%`,
    `Croissance: ${formatPercent(initialEconomic.growth)} → ${formatPercent(finalEconomic.growth)}`,
    `Popularité: ${finalPopularity.toFixed(0)}%`,
    '« Tu ferais mieux ? »',
  ].join('\n')
}

const BILL_STATUS_LABEL: Record<BillHistoryEntry['status'], string> = {
  ADOPTED: 'ADOPTÉ',
  REJECTED: 'REJETÉ',
  WITHDRAWN: 'RETIRÉ',
}

export function YearReportScreen({
  initialEconomic,
  finalEconomic,
  initialPopularity,
  finalPopularity,
  politicalCapital,
  billHistory,
  scoreBreakdown,
  endingTitle,
  onReplaySameSeed,
  onNewGame,
}: YearReportScreenProps) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared'>('idle')
  const budgetEntry = billHistory.find((e) => e.billId === BUDGET_BILL_ID)
  const discretionaryEntry = billHistory.find((e) => e.billId !== BUDGET_BILL_ID)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setShareStatus('copied') },
      () => { /* clipboard permission denied — silently ignore, non-critical */ },
    )
  }

  const handleShare = () => {
    const text = shareText(scoreBreakdown, initialEconomic, finalEconomic, finalPopularity)
    // Progressive enhancement (M2 §21): Web Share API where available, clipboard copy otherwise.
    // TS's DOM lib types both as always present even though real-world browser support varies
    // (older browsers can throw synchronously calling an API that doesn't exist), so both the
    // missing-API and the user-cancelled cases fall back to the clipboard via try/catch.
    try {
      navigator.share({ text }).then(
        () => { setShareStatus('shared') },
        () => { copyToClipboard(text) },
      )
    } catch {
      copyToClipboard(text)
    }
  }

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">31 décembre 2027</p>
          <h1 className="cr-title">BILAN — ANNÉE 1</h1>
          {budgetEntry ? (
            <span className={`cr-badge ${budgetEntry.status === 'ADOPTED' ? 'cr-badge--adopted' : 'cr-badge--rejected'}`}>
              BUDGET {BILL_STATUS_LABEL[budgetEntry.status]}
              {budgetEntry.usedExceptionalProcedure ? ' (responsabilité engagée)' : ''}
            </span>
          ) : null}
          {discretionaryEntry ? (
            <span className={`cr-badge ${discretionaryEntry.status === 'ADOPTED' ? 'cr-badge--adopted' : 'cr-badge--rejected'}`} style={{ marginLeft: '0.5rem' }}>
              {discretionaryEntry.billTitle} — {BILL_STATUS_LABEL[discretionaryEntry.status]}
            </span>
          ) : null}
        </div>

        <div className="cr-card cr-score">
          <div className="cr-score__value">{scoreBreakdown.total.toLocaleString('fr-FR')}</div>
          <div className="cr-body-text">/ 10 000</div>
          <div className="cr-score__title">{endingTitle}</div>
        </div>

        <div className="cr-report-grid">
          {reportRow('Croissance', formatPercent(initialEconomic.growth), formatPercent(finalEconomic.growth))}
          {reportRow('Chômage', formatPercent(initialEconomic.unemployment), formatPercent(finalEconomic.unemployment))}
          {reportRow('Inflation', formatPercent(initialEconomic.inflation), formatPercent(finalEconomic.inflation))}
          {reportRow('Déficit', formatPercent(initialEconomic.deficitRatio), formatPercent(finalEconomic.deficitRatio))}
          {reportRow('Dette', formatPercent(initialEconomic.debtRatio, 1), formatPercent(finalEconomic.debtRatio, 1))}
          {reportRow(
            'Pouvoir d’achat',
            purchasingPowerIndex(initialEconomic.purchasingPower).toFixed(1),
            purchasingPowerIndex(finalEconomic.purchasingPower).toFixed(1),
          )}
          {reportRow('Popularité', `${initialPopularity.toFixed(0)}%`, `${finalPopularity.toFixed(0)}%`)}
        </div>

        <div className="cr-report-row">
          <span className="cr-report-row__label">Capital politique restant</span>
          <span className="cr-report-row__value">{politicalCapital} / 100</span>
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onReplaySameSeed}>
            REJOUER L’ANNÉE
          </button>
          <button type="button" className="cr-button cr-button--secondary" onClick={onNewGame}>
            NOUVELLE PARTIE
          </button>
          <button type="button" className="cr-button cr-button--secondary" onClick={handleShare}>
            PARTAGER MON SCORE
          </button>
        </div>
        {shareStatus === 'copied' ? <p className="cr-small-text">Résultat copié dans le presse-papiers.</p> : null}
        {shareStatus === 'shared' ? <p className="cr-small-text">Merci d’avoir partagé votre mandat !</p> : null}
      </div>
    </div>
  )
}
