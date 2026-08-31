import type { DecisionChoice, DecisionConfig } from '../../game/country-run/prototype/types.ts'

const ARROW_SYMBOL: Record<DecisionChoice['previews'][number]['direction'], string> = {
  up: '↗',
  down: '↘',
  strongUp: '↑↑',
  strongDown: '↓↓',
  neutral: '→',
  mixed: '↕',
}

interface DecisionCardProps {
  decision: DecisionConfig
  onChoose: (choiceId: string) => void
}

/** Generic "one decision, a few choices with a consequence preview" screen unit — reused for the Bercy audit and the energy shock. */
export function DecisionCard({ decision, onChoose }: DecisionCardProps) {
  return (
    <div>
      <p className="cr-eyebrow">Décision</p>
      <h1 className="cr-title">{decision.title}</h1>
      <p className="cr-body-text">{decision.text}</p>

      <div className="cr-choice-grid cr-choice-grid--3" style={{ marginTop: '1.2rem' }}>
        {decision.choices.map((choice) => (
          <button key={choice.id} type="button" className="cr-choice" onClick={() => { onChoose(choice.id) }}>
            <span className="cr-choice__title">{choice.title}</span>
            <span className="cr-choice__copy">{choice.copy}</span>
            <ul className="cr-preview-list">
              {choice.previews.map((preview) => (
                <li key={preview.label}>
                  <span>{preview.label}</span>
                  <span className={`cr-arrow--${preview.direction}`}>{ARROW_SYMBOL[preview.direction]}</span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  )
}
