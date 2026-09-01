import type { FinanceBlockConfig, FinanceTier } from '../../game/country-run/finance/financeTypes.ts'
import { formatMdFr, formatSignedMdFr } from '../format.ts'

interface FinanceBlockCardProps<Id extends string> {
  block: FinanceBlockConfig<Id>
  /** Positive = spending Md€/an, revenue Md€/an of REVENUE (native sign — a household-tax card passes the tier's own `annualFiscalDelta`, not the ledger-flipped convention). */
  selectedTierId: string
  /** The currently-ENACTED tier id (last adopted budget) — used only to show "current vs new" when the draft differs. */
  enactedTierId: string
  onChange: (tierId: string) => void
}

/**
 * M6 §60-66: ONE generic progressive-disclosure card, shared by every
 * spending and revenue block — tier buttons (and the current tier's short
 * description) are always visible; `<details>` reveals the rest (economic/
 * service effects, risk, timing, promise links) so 13 blocks stay
 * mobile-playable without 13 giant always-expanded panels.
 */
export function FinanceBlockCard<Id extends string>({ block, selectedTierId, enactedTierId, onChange }: FinanceBlockCardProps<Id>) {
  const selectedTier: FinanceTier = block.tiers.find((t) => t.id === selectedTierId) ?? block.tiers[0]
  const enactedTier = block.tiers.find((t) => t.id === enactedTierId)
  const changed = enactedTierId !== selectedTierId
  const projected = block.baseline + selectedTier.annualFiscalDelta

  return (
    <div className="cr-card cr-finance-block">
      <div className="cr-finance-block__head">
        <strong>{block.label}</strong>
        <span className="cr-body-text">{formatMdFr(projected, 0)}/an</span>
      </div>

      <div className="cr-level-toggle cr-level-toggle--finance" role="group" aria-label={`${block.label} — niveau de politique`}>
        {block.tiers.map((tier) => (
          <button key={tier.id} type="button" aria-pressed={selectedTierId === tier.id} onClick={() => { onChange(tier.id) }}>
            {tier.label}
            <br />
            {formatSignedMdFr(tier.annualFiscalDelta, 0)}
          </button>
        ))}
      </div>

      <p className="cr-budget-category__copy">{selectedTier.description}</p>

      {changed && enactedTier ? (
        <p className="cr-finance-block__change">
          Politique actuelle : {enactedTier.label} ({formatSignedMdFr(enactedTier.annualFiscalDelta, 0)}) → changement de{' '}
          {formatSignedMdFr(selectedTier.annualFiscalDelta - enactedTier.annualFiscalDelta, 0)}
        </p>
      ) : null}

      <details className="cr-finance-block__details">
        <summary>Détails</summary>
        <div className="cr-finance-block__details-body">
          {selectedTier.economicEffects.length > 0 ? (
            <div>
              <span className="cr-finance-block__details-label">Économie</span>
              <ul>{selectedTier.economicEffects.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : null}
          {selectedTier.publicServiceEffects && selectedTier.publicServiceEffects.length > 0 ? (
            <div>
              <span className="cr-finance-block__details-label">Services publics</span>
              <ul>{selectedTier.publicServiceEffects.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : null}
          {selectedTier.riskDescription ? (
            <div>
              <span className="cr-finance-block__details-label">Risque</span>
              <p>{selectedTier.riskDescription}</p>
            </div>
          ) : null}
          <div>
            <span className="cr-finance-block__details-label">Mise en œuvre</span>
            <p>
              {selectedTier.implementationTiming === 0 ? 'Effet dès le prochain budget.' : `Effet différé — pleinement en place ${String(selectedTier.implementationTiming)} tour(s) après adoption.`}
              {selectedTier.temporaryOrPermanent === 'TEMPORARY' ? ' Mesure temporaire.' : ''}
            </p>
          </div>
          <p className="cr-finance-block__provenance">Enveloppe de référence : {formatMdFr(block.baseline, 0)}/an ({block.provenance === 'OBSERVED' ? 'observé' : block.provenance === 'FORECAST' ? 'prévision' : block.provenance === 'SIMULATED' ? 'simulé' : 'estimation de jeu'}).</p>
        </div>
      </details>
    </div>
  )
}
