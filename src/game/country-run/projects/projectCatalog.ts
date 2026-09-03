import type { NationalProjectCategory } from './projectTypes.ts'

/**
 * M6.5 §26: ~10 national projects, not all available every run —
 * availability is entirely driven by what actually launches them (a bill
 * adoption, an event choice, or a budget tier) — see `projectEngine.ts`'s
 * `PROJECT_LAUNCH_TRIGGERS` for the exact wiring. Content-as-code, like
 * `bills.ts`/`promiseCatalog.ts` — never part of serializable state.
 */
export type ProjectLaunchTrigger =
  | { kind: 'bill'; billId: string }
  | { kind: 'event'; eventId: string; choiceId: string }
  | { kind: 'financeTier'; blockId: string; tierId: string }

export interface NationalProjectTemplate {
  id: string
  name: string
  category: NationalProjectCategory
  description: string
  trigger: ProjectLaunchTrigger
  /** Roughly how many turns (2-month steps) construction typically takes — actual completion varies ±deterministic jitter (see `projectEngine.ts`). */
  typicalDurationTurns: number
  economicEffectsDuringConstruction: string[]
  economicEffectsOnCompletion: string[]
  serviceEffectsOnCompletion: string[]
  riskTags: string[]
  eventTags: string[]
}

export const PROJECT_CATALOG: NationalProjectTemplate[] = [
  {
    id: 'national-rail-modernization',
    name: 'PLAN FERROVIAIRE NATIONAL',
    category: 'TRANSPORT',
    description: 'Modernisation du réseau ferroviaire national — capacité, fiabilité, désenclavement des territoires.',
    trigger: { kind: 'bill', billId: 'public-investment-plan-bill' },
    typicalDurationTurns: 18,
    economicEffectsDuringConstruction: ['Chantiers en cours — effet modéré sur l’emploi local du BTP.'],
    economicEffectsOnCompletion: ['Capacité de transport accrue.', 'Gain de productivité pour les régions désenclavées.'],
    serviceEffectsOnCompletion: ['Amélioration de la connectivité territoriale.'],
    riskTags: ['construction-delay'],
    eventTags: ['transport', 'infrastructure'],
  },
  {
    id: 'nuclear-program',
    name: 'PROGRAMME NUCLÉAIRE',
    category: 'ENERGY',
    description: 'Un nouveau programme de production nucléaire — indépendance énergétique de long terme.',
    trigger: { kind: 'bill', billId: 'energy-transition-bill' },
    typicalDurationTurns: 24,
    economicEffectsDuringConstruction: ['Chantiers de long terme — effet limité à court terme.'],
    economicEffectsOnCompletion: ['Indépendance énergétique renforcée.', 'Coûts énergétiques stabilisés pour l’industrie.'],
    serviceEffectsOnCompletion: ['Résilience du réseau électrique.'],
    riskTags: ['construction-delay', 'high-cost'],
    eventTags: ['energy'],
  },
  {
    id: 'hospital-modernization',
    name: 'PLAN DE MODERNISATION HOSPITALIÈRE',
    category: 'HEALTH',
    description: 'Modernisation des infrastructures et équipements hospitaliers publics.',
    trigger: { kind: 'bill', billId: 'hospital-plan-bill' },
    typicalDurationTurns: 12,
    economicEffectsDuringConstruction: ['Rénovations en cours dans plusieurs établissements.'],
    economicEffectsOnCompletion: ['Capacité hospitalière accrue.'],
    serviceEffectsOnCompletion: ['Amélioration durable de la qualité des soins.'],
    riskTags: [],
    eventTags: ['health'],
  },
  {
    id: 'university-research-program',
    name: 'PROGRAMME UNIVERSITAIRE & RECHERCHE',
    category: 'RESEARCH',
    description: 'Un effort structurel pour l’enseignement supérieur et la recherche publique.',
    trigger: { kind: 'bill', billId: 'education-investment-bill' },
    typicalDurationTurns: 15,
    economicEffectsDuringConstruction: ['Recrutements et rénovations en cours.'],
    economicEffectsOnCompletion: ['Gain de productivité de long terme via la recherche.'],
    serviceEffectsOnCompletion: ['Qualité de l’enseignement supérieur renforcée.'],
    riskTags: [],
    eventTags: ['education', 'research'],
  },
  {
    id: 'semiconductor-strategy',
    name: 'STRATÉGIE SEMI-CONDUCTEURS',
    category: 'INDUSTRY',
    description: 'Une stratégie industrielle nationale pour la production de semi-conducteurs.',
    trigger: { kind: 'bill', billId: 'industry-innovation-plan-bill' },
    typicalDurationTurns: 16,
    economicEffectsDuringConstruction: ['Construction d’un site de production — effet d’emploi local.'],
    economicEffectsOnCompletion: ['Souveraineté industrielle renforcée sur une filière stratégique.'],
    serviceEffectsOnCompletion: [],
    riskTags: ['construction-delay', 'foreign-competition'],
    eventTags: ['industry', 'technology'],
  },
  {
    id: 'energy-grid-modernization',
    name: 'MODERNISATION DU RÉSEAU ÉLECTRIQUE',
    category: 'ENERGY',
    description: 'Modernisation et renforcement du réseau de distribution électrique.',
    trigger: { kind: 'financeTier', blockId: 'economyInvestment', tierId: 'infrastructure' },
    typicalDurationTurns: 14,
    economicEffectsDuringConstruction: ['Travaux de modernisation du réseau en cours.'],
    economicEffectsOnCompletion: ['Résilience énergétique accrue.'],
    serviceEffectsOnCompletion: ['Moins d’incidents de distribution électrique.'],
    riskTags: [],
    eventTags: ['energy', 'infrastructure'],
  },
  {
    id: 'housing-construction-program',
    name: 'PROGRAMME DE CONSTRUCTION DE LOGEMENTS',
    category: 'HOUSING',
    description: 'Un programme national de construction et de rénovation de logements.',
    trigger: { kind: 'bill', billId: 'housing-construction-plan-bill' },
    typicalDurationTurns: 16,
    economicEffectsDuringConstruction: ['Chantiers de construction en cours — effet d’emploi dans le BTP.'],
    economicEffectsOnCompletion: ['Capacité de logement accrue.'],
    serviceEffectsOnCompletion: ['Réduction de la pression sur le logement.'],
    riskTags: ['construction-delay'],
    eventTags: ['housing'],
  },
  {
    id: 'defense-industrial-program',
    name: 'PROGRAMME INDUSTRIEL DE DÉFENSE',
    category: 'DEFENSE',
    description: 'Un programme industriel de défense national, soutenant l’autonomie stratégique.',
    trigger: { kind: 'bill', billId: 'defense-expansion-bill' },
    typicalDurationTurns: 18,
    economicEffectsDuringConstruction: ['Montée en cadence de la production industrielle de défense.'],
    economicEffectsOnCompletion: ['Autonomie stratégique renforcée.', 'Base industrielle de défense consolidée.'],
    serviceEffectsOnCompletion: [],
    riskTags: ['high-cost'],
    eventTags: ['defense'],
  },
  {
    id: 'public-digital-ai-infrastructure',
    name: 'INFRASTRUCTURE NUMÉRIQUE & IA PUBLIQUE',
    category: 'DIGITAL',
    description: 'Une infrastructure numérique et de calcul IA, née du plan européen co-investi.',
    trigger: { kind: 'event', eventId: 'ai-industry-plan', choiceId: 'large-co-investment' },
    typicalDurationTurns: 10,
    economicEffectsDuringConstruction: ['Déploiement de capacités de calcul en cours.'],
    economicEffectsOnCompletion: ['Capacité d’innovation numérique renforcée.'],
    serviceEffectsOnCompletion: ['Modernisation des services publics numériques.'],
    riskTags: ['foreign-competition'],
    eventTags: ['technology', 'digital'],
  },
  {
    id: 'climate-adaptation-program',
    name: 'PROGRAMME D’ADAPTATION CLIMATIQUE',
    category: 'CLIMATE',
    description: 'Un programme national d’adaptation climatique, lancé après la sécheresse historique.',
    trigger: { kind: 'event', eventId: 'drought-shock', choiceId: 'accelerate-adaptation' },
    typicalDurationTurns: 12,
    economicEffectsDuringConstruction: ['Travaux d’adaptation climatique en cours dans les territoires les plus exposés.'],
    economicEffectsOnCompletion: ['Vulnérabilité climatique réduite.'],
    serviceEffectsOnCompletion: ['Meilleure résilience agricole et infrastructurelle.'],
    riskTags: [],
    eventTags: ['climate'],
  },
]

export function getProjectTemplate(id: string): NationalProjectTemplate {
  const template = PROJECT_CATALOG.find((p) => p.id === id)
  if (!template) throw new Error(`Unknown national project template: ${id}`)
  return template
}
