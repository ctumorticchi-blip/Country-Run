import { useState } from 'react'
import type { EconomicState } from '../../engine/state/gameState.ts'
import type { EndingTitle, FinalScoreBreakdown } from '../../game/country-run/mandate/finalScoring.ts'
import { getPromiseDefinition } from '../../game/country-run/promises/promiseCatalog.ts'
import type { PromiseResolution } from '../../game/country-run/promises/promiseResolution.ts'
import { formatPercent, purchasingPowerIndex } from '../format.ts'

interface MandateReviewScreenProps {
  initialEconomic: EconomicState
  finalEconomic: EconomicState
  initialPopularity: number
  finalPopularity: number
  promiseResolutions: PromiseResolution[]
  scoreBreakdown: FinalScoreBreakdown
  endingTitle: EndingTitle
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

const PROMISE_STATUS_LABEL: Record<PromiseResolution['finalStatus'], string> = { KEPT: 'TENU', PARTIAL: 'PARTIEL', BROKEN: 'ROMPU' }

const SCORE_LABEL: Record<keyof Omit<FinalScoreBreakdown, 'catastropheMultiplier' | 'total'>, string> = {
  economy: 'Économie',
  publicFinances: 'Finances publiques',
  purchasingPower: 'Pouvoir d’achat',
  employment: 'Emploi',
  promises: 'Promesses',
  politicalStability: 'Stabilité politique',
  publicInvestmentServices: 'Investissement & services publics',
}

function shareText(scoreBreakdown: FinalScoreBreakdown, endingTitle: EndingTitle, initialEconomic: EconomicState, finalEconomic: EconomicState): string {
  return [
    '🇫🇷 COUNTRY RUN — 5 ANS PLUS TARD',
    `Score: ${String(scoreBreakdown.total)} / 10 000`,
    endingTitle,
    `Dette: ${initialEconomic.debtRatio.toFixed(0)}% → ${finalEconomic.debtRatio.toFixed(0)}%`,
    `Croissance: ${formatPercent(initialEconomic.growth)} → ${formatPercent(finalEconomic.growth)}`,
    '« Tu ferais mieux ? »',
  ].join('\n')
}

/** M5 §54-59: "5 ANS PLUS TARD" — the mandate-ending report, full 2027→2032 comparison, final promise record, final score, and expanded ending title. No reelection campaign yet (M5 explicitly defers that) — the only next step is a new game. */
export function MandateReviewScreen({
  initialEconomic,
  finalEconomic,
  initialPopularity,
  finalPopularity,
  promiseResolutions,
  scoreBreakdown,
  endingTitle,
  onNewGame,
}: MandateReviewScreenProps) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared'>('idle')

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setShareStatus('copied') },
      () => { /* clipboard permission denied — silently ignore, non-critical */ },
    )
  }

  const handleShare = () => {
    const text = shareText(scoreBreakdown, endingTitle, initialEconomic, finalEconomic)
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
          <p className="cr-eyebrow">Mai 2032</p>
          <h1 className="cr-title">5 ANS PLUS TARD</h1>
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

        <div className="cr-card">
          <p className="cr-eyebrow">Détail du score</p>
          {(Object.keys(SCORE_LABEL) as (keyof typeof SCORE_LABEL)[]).map((key) => (
            <div className="cr-report-row" key={key}>
              <span className="cr-report-row__label">{SCORE_LABEL[key]}</span>
              <span className="cr-report-row__value">{scoreBreakdown[key].toFixed(0)} / 100</span>
            </div>
          ))}
        </div>

        <div className="cr-card">
          <p className="cr-eyebrow">Mes 5 engagements — bilan final</p>
          <ul className="cr-promise-tracker__list">
            {promiseResolutions.map((resolution) => {
              const promise = getPromiseDefinition(resolution.promiseId)
              return (
                <li key={resolution.promiseId} className="cr-promise-tracker__item">
                  <div className="cr-promise-tracker__head">
                    <span>{promise.title}</span>
                    <span
                      className={`cr-indicator__trend cr-indicator__trend--${resolution.finalStatus === 'KEPT' ? 'up' : resolution.finalStatus === 'BROKEN' ? 'down' : 'neutral'}`}
                    >
                      {PROMISE_STATUS_LABEL[resolution.finalStatus]}
                    </span>
                  </div>
                  <div className="cr-promise-tracker__progress">{resolution.progressLabel}</div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onNewGame}>
            NOUVELLE PARTIE
          </button>
          <button type="button" className="cr-button cr-button--secondary" onClick={handleShare}>
            PARTAGER MON MANDAT
          </button>
        </div>
        {shareStatus === 'copied' ? <p className="cr-small-text">Résultat copié dans le presse-papiers.</p> : null}
        {shareStatus === 'shared' ? <p className="cr-small-text">Merci d’avoir partagé votre mandat !</p> : null}
      </div>
    </div>
  )
}
