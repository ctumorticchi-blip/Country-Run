import { ABSOLUTE_MAJORITY, COALITION_SEATS, PARLIAMENT_CHOICES, SEATS_MISSING, TOTAL_SEATS } from '../../game/country-run/prototype/parliament.ts'
import type { ParliamentChoiceConfig } from '../../game/country-run/prototype/types.ts'

interface ParliamentScreenProps {
  onChoose: (choiceId: ParliamentChoiceConfig['id']) => void
}

export function ParliamentScreen({ onChoose }: ParliamentScreenProps) {
  const majorityPct = (ABSOLUTE_MAJORITY / TOTAL_SEATS) * 100
  const coalitionPct = (COALITION_SEATS / TOTAL_SEATS) * 100

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <p className="cr-eyebrow">Parlement</p>
        <h1 className="cr-title">L’ASSEMBLÉE DOIT VOTER</h1>

        <div className="cr-card">
          <div className="cr-body-text">
            Votre coalition : {COALITION_SEATS} / {TOTAL_SEATS} sièges
          </div>
          <div className="cr-seats-bar" style={{ marginTop: '0.5rem' }}>
            <div className="cr-seats-bar__fill" style={{ width: `${String(coalitionPct)}%` }} />
            <div className="cr-seats-bar__majority-mark" style={{ left: `${String(majorityPct)}%` }} />
          </div>
        </div>

        <p className="cr-body-text">Il vous manque {SEATS_MISSING} voix pour adopter le budget sans difficulté.</p>

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
