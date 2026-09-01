import { ABSOLUTE_MAJORITY, PARLIAMENT_CHOICES, TOTAL_SEATS } from '../../game/country-run/prototype/parliament.ts'
import type { ParliamentChoiceConfig } from '../../game/country-run/prototype/types.ts'

interface ParliamentScreenProps {
  /** The player coalition's actual seat count from the legislative election (M3 §6-7) — replaces M2's fixed placeholder. */
  playerSeats: number
  onChoose: (choiceId: ParliamentChoiceConfig['id']) => void
}

export function ParliamentScreen({ playerSeats, onChoose }: ParliamentScreenProps) {
  const majorityPct = (ABSOLUTE_MAJORITY / TOTAL_SEATS) * 100
  const coalitionPct = (playerSeats / TOTAL_SEATS) * 100
  const seatsMissing = Math.max(0, ABSOLUTE_MAJORITY - playerSeats)

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <p className="cr-eyebrow">Parlement</p>
        <h1 className="cr-title">L’ASSEMBLÉE DOIT VOTER</h1>

        <div className="cr-card">
          <div className="cr-body-text">
            Votre coalition : {playerSeats} / {TOTAL_SEATS} sièges
          </div>
          <div className="cr-seats-bar" style={{ marginTop: '0.5rem' }}>
            <div className="cr-seats-bar__fill" style={{ width: `${String(coalitionPct)}%` }} />
            <div className="cr-seats-bar__majority-mark" style={{ left: `${String(majorityPct)}%` }} />
          </div>
        </div>

        {seatsMissing > 0 ? (
          <p className="cr-body-text">Il vous manque {seatsMissing} voix pour adopter le budget sans difficulté.</p>
        ) : (
          <p className="cr-body-text">Vous disposez de la majorité absolue pour adopter le budget.</p>
        )}

        <div className="cr-choice-grid cr-choice-grid--3">
          {PARLIAMENT_CHOICES.map((choice) => (
            <button key={choice.id} type="button" className="cr-choice" onClick={() => { onChoose(choice.id) }}>
              <span className="cr-choice__title">{choice.title}</span>
              <span className="cr-choice__copy">{choice.copy}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
