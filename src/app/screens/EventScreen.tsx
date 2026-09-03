import type { EventDefinition } from '../../game/country-run/events/eventTypes.ts'
import { formatSigned } from '../format.ts'

interface EventScreenProps {
  event: EventDefinition
  lastChoice: { choiceId: string; immediateFeedback: string } | null
  onChoose: (choiceId: string) => void
  onContinue: () => void
  /** M6.5 §49/§Part VII: the calendar year the arc's OPENING episode fired, when this event is a follow-up (`arcStage >= 2`) — `null`/`undefined` for a standalone or opening episode. */
  followUpYear?: number | null
}

/** M5 §7-10, §43: one fired `EventDefinition`'s player choice — the SAME turn's economic step has already run by the time this screen shows (`beginMandateTurn` doesn't wait on the player's pick), so choices here affect FUTURE turns, never this one retroactively. */
export function EventScreen({ event, lastChoice, onChoose, onContinue, followUpYear }: EventScreenProps) {
  if (lastChoice) {
    const choice = event.choices.find((c) => c.id === lastChoice.choiceId)
    return (
      <div className="cr-screen">
        <div className="cr-page">
          <p className="cr-eyebrow">{event.title}</p>
          <div className="cr-card cr-score">
            <div className="cr-score__title">{choice?.title ?? ''}</div>
            <p className="cr-body-text">{lastChoice.immediateFeedback}</p>
          </div>
          <div className="cr-button-row">
            <button type="button" className="cr-button cr-button--primary" onClick={onContinue}>
              CONTINUER
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <p className="cr-eyebrow">Événement</p>
        {followUpYear ? <p className="cr-followup-tag">CONSÉQUENCE DE VOTRE DÉCISION DE {followUpYear}</p> : null}
        <h1 className="cr-title">{event.title}</h1>
        <p className="cr-body-text">{event.description}</p>

        <div className="cr-choice-grid">
          {event.choices.map((choice) => (
            <button key={choice.id} type="button" className="cr-choice" onClick={() => { onChoose(choice.id) }}>
              <span className="cr-choice__title">{choice.title}</span>
              <span className="cr-choice__copy">{choice.description}</span>
              {choice.fiscalEffect ? <span className="cr-small-text">{formatSigned(choice.fiscalEffect, 0, ' Md€/an')}</span> : null}
              {choice.riskDescription ? <span className="cr-small-text">⚠️ {choice.riskDescription}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
