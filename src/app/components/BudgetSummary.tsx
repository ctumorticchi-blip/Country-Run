import { useState } from 'react'
import type { BudgetForecast, ForecastRange } from '../../game/country-run/finance/budgetForecast.ts'
import { computeBudgetEquation, debtInterestShareOfSpending, dedupeRisks, type FinanceBlockChange } from '../../game/country-run/finance/financeEffects.ts'
import { computeDebtStabilization, computePrimaryBalance } from '../../game/country-run/finance/primaryBalance.ts'
import type { EconomicState } from '../../engine/state/gameState.ts'
import { formatMdFr, formatPercentFr, formatRange, formatSignedMdFr } from '../format.ts'

interface BudgetSummaryProps {
  economic: EconomicState
  changes: FinanceBlockChange[]
  selectedPromiseIds: readonly string[]
  forecast: BudgetForecast
}

function rangeText(r: ForecastRange, decimals = 1, suffix = ' %'): string {
  return formatRange(`${r.low.toFixed(decimals)}${suffix}`, `${r.high.toFixed(decimals)}${suffix}`)
}

function mdRangeText(low: number, high: number, decimals = 0): string {
  return formatRange(formatMdFr(low, decimals), formatMdFr(high, decimals))
}

function signedRangeText(low: number, high: number, decimals = 1, suffix = ''): string {
  const lowText = `${low >= 0 ? '+' : ''}${low.toFixed(decimals)}`
  const highText = `${high >= 0 ? '+' : ''}${high.toFixed(decimals)}`
  return `${formatRange(lowText, highText, ' à ')}${suffix}`
}

/** Top structural-change drivers (M6.1 §9), ranked by absolute fiscal magnitude — never more than 4, matching the brief's own worked example. */
function topDrivers(changes: readonly FinanceBlockChange[]): FinanceBlockChange[] {
  return [...changes].filter((c) => c.fiscalChange !== 0).sort((a, b) => Math.abs(b.fiscalChange) - Math.abs(a.fiscalChange)).slice(0, 4)
}

function driverLabel(c: FinanceBlockChange): string {
  // Spending: fiscalChange is native-signed (+ = costs more). Revenue: ledger-signed (+ = a CUT, worse for the balance) — un-flip for a natural "+X/-X Md€/an" reading.
  const nativeSign = c.kind === 'spending' ? c.fiscalChange : -c.fiscalChange
  const delayNote = c.implementationTiming > 0 ? ' (après montée en charge)' : ''
  return `${c.blockLabel} : ${formatSignedMdFr(nativeSign)}/an${delayNote}`
}

/**
 * M6 §34, rebuilt M6.1 §8-12, mobile-hotfixed M6.2 §2-3/§9: "NOTE DE BERCY".
 * Desktop (≥768px, see game.css) keeps the full always-visible panel exactly
 * as M6.1 shipped it. Mobile instead shows a small `.cr-bercy-compact` bar
 * (net structural change + the forecast deficit range + a "VOIR BERCY"
 * toggle) and renders the full panel as a full-screen sheet only while
 * `open` is true — `open` is pure local UI state: it is never dispatched to
 * the reducer and never enters the `changes`/`forecast` computation, so
 * opening or closing the sheet cannot alter the draft budget or the live
 * forecast (see `gameReducer.m6.test.ts` M6.1 §10 for the underlying
 * forecast-purity proof, which this UI-only toggle cannot touch).
 * Two clearly separated sections throughout: "VOTRE BUDGET" (read straight
 * from the real simulated `EconomicState`) and "PRÉVISION DE BERCY" (the
 * pure, ranged, forward-looking forecast) — never blurred with the
 * "RÉSULTAT SIMULÉ" figures shown after turns actually play out.
 */
export function BudgetSummary({ economic, changes, selectedPromiseIds, forecast }: BudgetSummaryProps) {
  const [open, setOpen] = useState(false)
  const equation = computeBudgetEquation(economic)
  const primaryBalance = computePrimaryBalance(economic)
  const stabilization = computeDebtStabilization(economic)
  const netStructuralChange = changes.reduce((sum, c) => sum + c.fiscalChange, 0)
  const risks = dedupeRisks(changes)
  const promiseImpacts = changes.filter((c) => c.promiseLinks && c.promiseLinks.some((id) => selectedPromiseIds.includes(id)))
  const drivers = topDrivers(changes)

  return (
    <>
      <div className="cr-bercy-compact">
        <div className="cr-bercy-compact__stats">
          <span className="cr-bercy-compact__label">Budget proposé</span>
          <span className="cr-bercy-compact__value">{formatSignedMdFr(netStructuralChange)}/an</span>
          <span className="cr-bercy-compact__deficit">Déficit prévu {rangeText(forecast.deficitRatio)}</span>
        </div>
        <button type="button" className="cr-bercy-compact__toggle" onClick={() => { setOpen(true) }} aria-haspopup="dialog" aria-expanded={open}>
          VOIR BERCY
        </button>
      </div>

      <div className={`cr-bercy-panel${open ? ' cr-bercy-panel--open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined}>
        {open ? (
          <div className="cr-bercy-panel__header">
            <strong>PRÉVISION DE BERCY</strong>
            <button type="button" className="cr-bercy-panel__close" onClick={() => { setOpen(false) }}>
              FERMER
            </button>
          </div>
        ) : null}

        <div className="cr-bercy-panel__body">
          <strong>NOTE DE BERCY — VOTRE BUDGET</strong>

          <dl style={{ margin: 0 }}>
            <div className="cr-summary__row">
              <dt>Solde</dt>
              <dd>{formatSignedMdFr(equation.balanceBn)} (déficit {formatPercentFr(equation.deficitRatio)} PIB)</dd>
            </div>
            <div className="cr-summary__row">
              <dt>Changement structurel net vs politique actuelle</dt>
              <dd>{formatSignedMdFr(netStructuralChange)}/an</dd>
            </div>
            <div className="cr-summary__row">
              <dt>Recettes</dt>
              <dd>{formatMdFr(equation.revenueBn)} ({formatPercentFr(equation.revenuePctGdp)} PIB)</dd>
            </div>
            <div className="cr-summary__row">
              <dt>Dépenses</dt>
              <dd>{formatMdFr(equation.spendingBn)} ({formatPercentFr(equation.spendingPctGdp)} PIB)</dd>
            </div>
            <div className="cr-summary__row">
              <dt>Solde primaire (hors charge de la dette)</dt>
              <dd>{formatSignedMdFr(primaryBalance.primaryBalanceBn)}</dd>
            </div>
            <div className="cr-summary__row">
              <dt>Charge de la dette</dt>
              <dd>{formatMdFr(economic.interestCost)} ({formatPercentFr(debtInterestShareOfSpending(economic))} des dépenses)</dd>
            </div>
            <div className="cr-summary__row">
              <dt>Effort pour stabiliser la dette</dt>
              <dd>{stabilization.gap > 0 ? `${formatPercentFr(stabilization.gap)} PIB restant à trouver` : 'Dette déjà en trajectoire de stabilisation'}</dd>
            </div>
          </dl>

          <div className="cr-forecast">
            <strong>PRÉVISION DE BERCY — {forecast.confidence === 'HIGH' ? 'ÉLEVÉE' : forecast.confidence === 'MEDIUM' ? 'MOYENNE' : 'FAIBLE'}</strong>
            <p className="cr-small-text">Projection à 12 mois si ce budget est adopté et maintenu — une estimation, pas un résultat garanti.</p>
            <dl style={{ margin: 0 }}>
              <div className="cr-summary__row">
                <dt>Déficit</dt>
                <dd>{rangeText(forecast.deficitRatio)}</dd>
              </div>
              <div className="cr-summary__row">
                <dt>Dette</dt>
                <dd>{rangeText(forecast.debtRatio)}</dd>
              </div>
              <div className="cr-summary__row">
                <dt>Croissance</dt>
                <dd>{rangeText(forecast.growth)}</dd>
              </div>
              <div className="cr-summary__row">
                <dt>Chômage</dt>
                <dd>{rangeText(forecast.unemployment)}</dd>
              </div>
              <div className="cr-summary__row">
                <dt>Inflation</dt>
                <dd>{rangeText(forecast.inflation)}</dd>
              </div>
              <div className="cr-summary__row">
                <dt>Pouvoir d’achat</dt>
                <dd>{signedRangeText(forecast.purchasingPowerDelta.low, forecast.purchasingPowerDelta.high, 1, ' pt')}</dd>
              </div>
              <div className="cr-summary__row">
                <dt>Charge de la dette</dt>
                <dd>{mdRangeText(forecast.interestCost.low, forecast.interestCost.high)}</dd>
              </div>
            </dl>
          </div>

          {drivers.length > 0 ? (
            <div>
              <strong>POLITIQUE ACTUELLE VS BUDGET PROPOSÉ — PRINCIPALES CAUSES</strong>
              <ul className="cr-preview-list">
                {drivers.map((c) => <li key={`${c.kind}-${c.blockId}-driver`}>{driverLabel(c)}</li>)}
              </ul>
            </div>
          ) : null}

          {risks.length > 0 ? (
            <div className="cr-warning-banner">
              <strong>PRINCIPAUX RISQUES</strong>
              <ul>{risks.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          ) : null}

          {promiseImpacts.length > 0 ? (
            <div>
              <strong>IMPACT SUR VOS ENGAGEMENTS</strong>
              <ul className="cr-preview-list">
                {promiseImpacts.map((c) => (
                  <li key={`${c.kind}-${c.blockId}`}>{c.blockLabel} — {c.newTierLabel}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {open ? <div className="cr-bercy-backdrop" onClick={() => { setOpen(false) }} /> : null}
    </>
  )
}
