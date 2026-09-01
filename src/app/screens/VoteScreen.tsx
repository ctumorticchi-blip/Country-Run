import type { BillHistoryEntry } from '../../game/country-run/parliament/billTypes.ts'
import type { VoteResult } from '../../game/country-run/parliament/voteResolution.ts'
import { formatSigned } from '../format.ts'

interface VoteScreenProps {
  billTitle: string
  /** The just-resolved vote, or `null` when the bill was pushed through via the exceptional procedure. */
  voteResult: VoteResult | null
  /** Set once the bill reaches a terminal outcome. */
  finalEntry: BillHistoryEntry | null
  /** Only meaningful while `finalEntry` is null (an in-progress rejection with attempts left). */
  canRetry: boolean
  canWithdraw: boolean
  onRenegotiate: () => void
  onWithdraw: () => void
  onContinue: () => void
}

/** M4 §18: the resolved-vote presentation, reused for both the mandatory Budget Bill and the discretionary reform. */
export function VoteScreen({ billTitle, voteResult, finalEntry, canRetry, canWithdraw, onRenegotiate, onWithdraw, onContinue }: VoteScreenProps) {
  const isTerminal = finalEntry !== null
  const passed = finalEntry ? finalEntry.status === 'ADOPTED' : (voteResult?.passed ?? false)

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <p className="cr-eyebrow">Vote à l’Assemblée</p>
        <h1 className="cr-title">{billTitle}</h1>

        {finalEntry?.usedExceptionalProcedure ? (
          <div className="cr-card cr-score">
            <div className="cr-score__title">ADOPTÉ PAR ENGAGEMENT DE RESPONSABILITÉ</div>
            <p className="cr-body-text">Le gouvernement a engagé sa responsabilité — le texte est adopté sans vote ordinaire.</p>
          </div>
        ) : voteResult ? (
          <div className="cr-card cr-score">
            <div className="cr-report-grid">
              <div className="cr-report-row">
                <span className="cr-report-row__label">POUR</span>
                <span className="cr-report-row__value">{voteResult.votesFor}</span>
              </div>
              <div className="cr-report-row">
                <span className="cr-report-row__label">CONTRE</span>
                <span className="cr-report-row__value">{voteResult.votesAgainst}</span>
              </div>
              <div className="cr-report-row">
                <span className="cr-report-row__label">ABSTENTIONS</span>
                <span className="cr-report-row__value">{voteResult.abstentions}</span>
              </div>
            </div>
            <div className="cr-score__title" style={{ marginTop: '0.8rem' }}>{passed ? 'TEXTE ADOPTÉ' : 'TEXTE REJETÉ'}</div>
          </div>
        ) : null}

        {voteResult ? (
          <ul className="cr-bloc-list">
            {voteResult.blocBreakdown
              .filter((b) => b.blocId !== 'PRESIDENTIAL_BLOC')
              .map((b) => (
                <li key={b.blocId} className="cr-report-row">
                  <span className="cr-report-row__label">{b.blocName}</span>
                  <span className="cr-report-row__value">
                    {b.votesFor > b.votesAgainst ? 'POUR' : b.votesFor < b.votesAgainst ? 'CONTRE' : 'PARTAGÉ'} ({b.votesFor}/{b.seats})
                  </span>
                </li>
              ))}
          </ul>
        ) : null}

        {finalEntry ? (
          <div className="cr-report-grid">
            <div className="cr-report-row">
              <span className="cr-report-row__label">Capital politique</span>
              <span className="cr-report-row__value">{formatSigned(finalEntry.politicalCapitalDelta, 0)}</span>
            </div>
            <div className="cr-report-row">
              <span className="cr-report-row__label">Popularité</span>
              <span className="cr-report-row__value">{formatSigned(finalEntry.popularityDelta, 1, ' pt')}</span>
            </div>
          </div>
        ) : null}

        <div className="cr-button-row">
          {isTerminal ? (
            <button type="button" className="cr-button cr-button--primary" onClick={onContinue}>
              CONTINUER
            </button>
          ) : (
            <>
              {canRetry ? (
                <button type="button" className="cr-button cr-button--primary" onClick={onRenegotiate}>
                  RENÉGOCIER
                </button>
              ) : null}
              {canWithdraw ? (
                <button type="button" className="cr-button cr-button--secondary" onClick={onWithdraw}>
                  RETIRER LE TEXTE
                </button>
              ) : null}
              {!canRetry && !canWithdraw ? (
                <button type="button" className="cr-button cr-button--primary" onClick={onContinue}>
                  CONTINUER
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
