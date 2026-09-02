import type { BudgetForecast, ForecastRange } from '../../game/country-run/finance/budgetForecast.ts'
import { computeBudgetEquation, debtInterestShareOfSpending, type FinanceBlockChange } from '../../game/country-run/finance/financeEffects.ts'
import { computeDebtStabilization, computePrimaryBalance } from '../../game/country-run/finance/primaryBalance.ts'
import type { EconomicState } from '../../engine/state/gameState.ts'
import { formatMdFr, formatPercentFr, formatSignedMdFr } from '../format.ts'

interface BudgetSummaryProps {
  economic: EconomicState
  changes: FinanceBlockChange[]
  selectedPromiseIds: readonly string[]
  forecast: BudgetForecast
}

function rangeText(r: ForecastRange, decimals = 1, suffix = ' %'): string {
  return `${r.low.toFixed(decimals)}–${r.high.toFixed(decimals)}${suffix}`
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
 * M6 §34, rebuilt M6.1 §8-12: "NOTE DE BERCY" — the annual budget's sticky
 * summary, always visible while drafting. Neutral tone throughout (never
 * "good budget"/"bad budget"). Two clearly separated sections: "VOTRE
 * BUDGET" (read straight from the real simulated `EconomicState` —
 * `computeBudgetEquation`/`computePrimaryBalance`/`computeDebtStabilization`)
 * and "PRÉVISION DE BERCY" (the pure, ranged, forward-looking forecast —
 * `finance/budgetForecast.ts`'s `forecastNextYear`, recomputed live as the
 * draft changes, never a fake single-point number). The forecast is
 * explicitly labeled as a PRÉVISION, never blurred with the "RÉSULTAT
 * SIMULÉ" figures shown after turns actually play out (Year/Mandate
 * Review) — see M6.1 §11.
 */
export function BudgetSummary({ economic, changes, selectedPromiseIds, forecast }: BudgetSummaryProps) {
  const equation = computeBudgetEquation(economic)
  const primaryBalance = computePrimaryBalance(economic)
  const stabilization = computeDebtStabilization(economic)
  const netStructuralChange = changes.reduce((sum, c) => sum + c.fiscalChange, 0)
  const risks = changes.filter((c) => c.riskDescription).map((c) => c.riskDescription as string)
  const promiseImpacts = changes.filter((c) => c.promiseLinks && c.promiseLinks.some((id) => selectedPromiseIds.includes(id)))
  const drivers = topDrivers(changes)

  return (
    <div className="cr-summary">
      <strong>NOTE DE BERCY — VOTRE BUDGET</strong>

      <dl style={{ margin: 0 }}>
        <div className="cr-summary__row">
          <dt>Recettes</dt>
          <dd>{formatMdFr(equation.revenueBn)} ({formatPercentFr(equation.revenuePctGdp)} PIB)</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Dépenses</dt>
          <dd>{formatMdFr(equation.spendingBn)} ({formatPercentFr(equation.spendingPctGdp)} PIB)</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Solde</dt>
          <dd>{formatSignedMdFr(equation.balanceBn)} (déficit {formatPercentFr(equation.deficitRatio)} PIB)</dd>
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
        <div className="cr-summary__row">
          <dt>Changement structurel net vs politique actuelle</dt>
          <dd>{formatSignedMdFr(netStructuralChange)}/an</dd>
        </div>
      </dl>

      {drivers.length > 0 ? (
        <div>
          <strong>POLITIQUE ACTUELLE VS BUDGET PROPOSÉ — PRINCIPALES CAUSES</strong>
          <ul className="cr-preview-list">
            {drivers.map((c) => <li key={`${c.kind}-${c.blockId}-driver`}>{driverLabel(c)}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="cr-forecast">
        <strong>PRÉVISION DE BERCY — {forecast.confidence === 'HIGH' ? 'ÉLEVÉE' : forecast.confidence === 'MEDIUM' ? 'MOYENNE' : 'FAIBLE'}</strong>
        <p className="cr-small-text">Projection à 12 mois si ce budget est adopté et maintenu — une estimation, pas un résultat garanti.</p>
        <dl style={{ margin: 0 }}>
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
            <dt>Déficit</dt>
            <dd>{rangeText(forecast.deficitRatio)}</dd>
          </div>
          <div className="cr-summary__row">
            <dt>Dette</dt>
            <dd>{rangeText(forecast.debtRatio)}</dd>
          </div>
          <div className="cr-summary__row">
            <dt>Charge de la dette</dt>
            <dd>{formatMdFr(forecast.interestCost.low, 0)}–{formatMdFr(forecast.interestCost.high, 0)}</dd>
          </div>
          <div className="cr-summary__row">
            <dt>Pouvoir d’achat</dt>
            <dd>
              {forecast.purchasingPowerDelta.low >= 0 ? '+' : ''}
              {forecast.purchasingPowerDelta.low.toFixed(1)} à {forecast.purchasingPowerDelta.high >= 0 ? '+' : ''}
              {forecast.purchasingPowerDelta.high.toFixed(1)} pt
            </dd>
          </div>
        </dl>
      </div>

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
  )
}
