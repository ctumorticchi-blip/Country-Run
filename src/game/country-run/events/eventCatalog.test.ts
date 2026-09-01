import { describe, expect, it } from 'vitest'
import { EVENT_CATALOG, getEventDefinition } from './eventCatalog.ts'

describe('EVENT_CATALOG — content shape (M5 §8, §11-22)', () => {
  it('has 13 definitions with unique ids, covering 12 conceptual events (tax-windfall/tax-shortfall share one exclusiveGroup)', () => {
    expect(EVENT_CATALOG).toHaveLength(13)
    expect(new Set(EVENT_CATALOG.map((e) => e.id)).size).toBe(13)
  })

  it('getEventDefinition resolves every catalog entry and throws on an unknown id', () => {
    for (const event of EVENT_CATALOG) {
      expect(getEventDefinition(event.id)).toBe(event)
    }
    expect(() => getEventDefinition('not-a-real-event')).toThrow()
  })

  it('every event has a valid, non-inverted turn window within the 30-turn mandate', () => {
    for (const event of EVENT_CATALOG) {
      expect(event.earliestTurn).toBeGreaterThanOrEqual(1)
      expect(event.latestTurn).toBeLessThanOrEqual(30)
      expect(event.earliestTurn).toBeLessThanOrEqual(event.latestTurn)
    }
  })

  it('every event has a baseProbability in (0, 1] kept low enough to average roughly 8-10 events per run, not spam', () => {
    for (const event of EVENT_CATALOG) {
      expect(event.baseProbability).toBeGreaterThan(0)
      expect(event.baseProbability).toBeLessThanOrEqual(1)
      // No single event should be near-certain every eligible turn — that would make the catalog feel scripted.
      expect(event.baseProbability).toBeLessThanOrEqual(0.5)
    }
  })

  it('every event has at least 2 choices, each with a non-empty immediateFeedback', () => {
    for (const event of EVENT_CATALOG) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2)
      for (const choice of event.choices) {
        expect(choice.immediateFeedback.length).toBeGreaterThan(0)
      }
    }
  })

  it('tax-windfall and tax-shortfall share the tax-revenue-surprise exclusiveGroup and have mutually exclusive conditions', () => {
    const windfall = getEventDefinition('tax-windfall')
    const shortfall = getEventDefinition('tax-shortfall')
    expect(windfall.exclusiveGroup).toBe('tax-revenue-surprise')
    expect(shortfall.exclusiveGroup).toBe('tax-revenue-surprise')
    expect(windfall.exclusiveGroup).toBe(shortfall.exclusiveGroup)
  })

  it('energy-shock (the migrated Energy Shock decision) has a high early baseProbability and a worldShock, matching the pre-M5 onboarding feel', () => {
    const energyShock = getEventDefinition('energy-shock')
    expect(energyShock.earliestTurn).toBeLessThanOrEqual(3)
    expect(energyShock.latestTurn).toBeGreaterThanOrEqual(6)
    expect(energyShock.baseProbability).toBeGreaterThanOrEqual(0.2)
    expect(energyShock.worldShock).toBeDefined()
  })

  it('political-crisis is gated behind real governmentTension/politicalCapital conditions, not always eligible', () => {
    const crisis = getEventDefinition('political-crisis')
    expect(crisis.conditions).toBeDefined()
    expect(crisis.probabilityModifier).toBeDefined()
  })

  it('every category used across the catalog is one of the 10 documented EventCategory values', () => {
    const allowed = new Set(['ECONOMY', 'ENERGY', 'SOCIAL', 'INTERNATIONAL', 'PUBLIC_SERVICES', 'INDUSTRY', 'HOUSING', 'CLIMATE', 'SECURITY', 'POLITICAL'])
    for (const event of EVENT_CATALOG) {
      expect(allowed.has(event.category)).toBe(true)
    }
  })

  it('all 10 event categories are represented at least once across the catalog', () => {
    const used = new Set(EVENT_CATALOG.map((e) => e.category))
    expect(used.size).toBe(10)
  })

  it('every economicPolicyEffect / delayedEffects policyEffect only sets real EconomicPolicyInput fields', () => {
    const validFields = new Set([
      'taxChanges', 'currentSpendingChanges', 'publicInvestmentChanges', 'transfersChanges', 'businessTaxImpulse',
      'householdTaxImpulse', 'researchInvestment', 'infrastructureInvestment', 'educationInvestment', 'laborMarketReform', 'publicSectorReform',
    ])
    for (const event of EVENT_CATALOG) {
      for (const choice of event.choices) {
        for (const key of Object.keys(choice.economicPolicyEffect ?? {})) {
          expect(validFields.has(key)).toBe(true)
        }
        for (const delayed of choice.delayedEffects ?? []) {
          expect(delayed.turnsLater).toBeGreaterThan(0)
          for (const key of Object.keys(delayed.policyEffect)) {
            expect(validFields.has(key)).toBe(true)
          }
        }
      }
    }
  })
})
