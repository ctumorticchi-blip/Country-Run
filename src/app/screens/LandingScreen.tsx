interface LandingScreenProps {
  onStart: () => void
}

export function LandingScreen({ onStart }: LandingScreenProps) {
  return (
    <div className="cr-screen cr-center">
      <p className="cr-brand">🇫🇷 COUNTRY RUN</p>
      <div className="cr-tricolor-bar" />
      <h1 className="cr-hook">La France vous donne les clés du pays. Vous avez 5 ans. Faites mieux.</h1>
      <p className="cr-supporting">
        Les données de départ sont inspirées de la France réelle.
        <br />
        Les mécanismes économiques sont cohérents.
        <br />
        L’avenir est simulé.
      </p>
      <div className="cr-button-row" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cr-button cr-button--primary" onClick={onStart}>
          COMMENCER MON MANDAT
        </button>
      </div>
      <p className="cr-small-text">Aucune inscription • Partie rapide</p>
    </div>
  )
}
