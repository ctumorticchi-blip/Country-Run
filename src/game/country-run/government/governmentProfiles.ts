import type { GovernmentProfileDefinition } from './governmentTypes.ts'

/**
 * The 4 government profiles (M3 §17) — fictional, descriptive, never a
 * real French cabinet. Each is a genuine trade-off: every profile has at
 * least one dimension >= 1.05 and one <= 0.95, and no profile's modifiers
 * dominate (are all >=) another's on every one of the 7 dimensions —
 * verified in governmentProfiles.test.ts.
 */
export const GOVERNMENT_PROFILES: GovernmentProfileDefinition[] = [
  {
    id: 'experts',
    name: 'LES EXPERTS',
    tagline: 'Un cabinet de technocrates et de hauts fonctionnaires.',
    description:
      'Exécution précise, prévisions fiables, forte crédibilité auprès des marchés. En contrepartie, peu d’aisance avec l’Assemblée et une résistance politique plus fragile en cas de crise.',
    strengths: ['Exécution économique', 'Fiabilité des prévisions', 'Crédibilité des marchés'],
    weaknesses: ['Négociation parlementaire', 'Résistance de la popularité'],
    modifiers: {
      economicExecution: 1.08,
      fiscalForecastAccuracy: 1.1,
      reformEffectiveness: 1.02,
      parliamentNegotiation: 0.9,
      popularityResilience: 0.92,
      marketCredibility: 1.08,
      implementationSpeed: 0.98,
    },
  },
  {
    id: 'politiques',
    name: 'LES POLITIQUES',
    tagline: 'Des ministres de terrain, rompus à la négociation.',
    description:
      'Excellents pour rallier l’Assemblée et absorber les coups durs politiquement. Moins précis sur l’exécution économique et les prévisions budgétaires.',
    strengths: ['Négociation parlementaire', 'Résistance de la popularité'],
    weaknesses: ['Fiabilité des prévisions', 'Crédibilité des marchés'],
    modifiers: {
      economicExecution: 0.95,
      fiscalForecastAccuracy: 0.92,
      reformEffectiveness: 0.95,
      parliamentNegotiation: 1.1,
      popularityResilience: 1.08,
      marketCredibility: 0.95,
      implementationSpeed: 1.02,
    },
  },
  {
    id: 'union',
    name: 'LE GOUVERNEMENT D’UNION',
    tagline: 'Une coalition large, du centre-gauche au centre-droit.',
    description:
      'Stable et consensuel — bonne résistance politique et bonne négociation parlementaire. Les compromis internes ralentissent la mise en œuvre des réformes.',
    strengths: ['Négociation parlementaire', 'Résistance de la popularité'],
    weaknesses: ['Efficacité des réformes', 'Vitesse de mise en œuvre'],
    modifiers: {
      economicExecution: 1.0,
      fiscalForecastAccuracy: 1.0,
      reformEffectiveness: 0.9,
      parliamentNegotiation: 1.08,
      popularityResilience: 1.05,
      marketCredibility: 1.0,
      implementationSpeed: 0.92,
    },
  },
  {
    id: 'reformateurs',
    name: 'LES RÉFORMATEURS',
    tagline: 'Une équipe resserrée, choisie pour aller vite.',
    description:
      'Réformes rapides et marquées. Peu de temps passé à ménager l’Assemblée ou l’opinion — les décisions clivantes coûtent cher politiquement.',
    strengths: ['Efficacité des réformes', 'Vitesse de mise en œuvre'],
    weaknesses: ['Négociation parlementaire', 'Résistance de la popularité'],
    modifiers: {
      economicExecution: 1.05,
      fiscalForecastAccuracy: 0.98,
      reformEffectiveness: 1.1,
      parliamentNegotiation: 0.92,
      popularityResilience: 0.9,
      marketCredibility: 1.02,
      implementationSpeed: 1.08,
    },
  },
]

export function getGovernmentProfile(id: string): GovernmentProfileDefinition {
  const profile = GOVERNMENT_PROFILES.find((p) => p.id === id)
  if (!profile) throw new Error(`Unknown government profile: ${id}`)
  return profile
}
