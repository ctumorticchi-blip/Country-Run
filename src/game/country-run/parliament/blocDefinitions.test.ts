import { describe, expect, it } from 'vitest'
import { getBlocDefinition, OPPOSITION_BLOC_DEFINITIONS, PARLIAMENT_BLOC_DEFINITIONS } from './blocDefinitions.ts'

describe('PARLIAMENT_BLOC_DEFINITIONS — content shape (M4 §2-3)', () => {
  it('has exactly 7 canonical blocs, including PRESIDENTIAL_BLOC', () => {
    expect(PARLIAMENT_BLOC_DEFINITIONS).toHaveLength(7)
    expect(PARLIAMENT_BLOC_DEFINITIONS.some((b) => b.id === 'PRESIDENTIAL_BLOC')).toBe(true)
  })

  it('OPPOSITION_BLOC_DEFINITIONS excludes the presidential bloc — exactly the 6 others', () => {
    expect(OPPOSITION_BLOC_DEFINITIONS).toHaveLength(6)
    expect(OPPOSITION_BLOC_DEFINITIONS.every((b) => b.id !== 'PRESIDENTIAL_BLOC')).toBe(true)
  })

  it('every bloc id is unique', () => {
    expect(new Set(PARLIAMENT_BLOC_DEFINITIONS.map((b) => b.id)).size).toBe(7)
  })

  it('getBlocDefinition finds every bloc and throws on an unknown id', () => {
    for (const bloc of PARLIAMENT_BLOC_DEFINITIONS) {
      expect(getBlocDefinition(bloc.id)).toBe(bloc)
    }
    expect(() => getBlocDefinition('not-a-real-bloc')).toThrow()
  })

  it('every policyAffinity value is within [-1, 1]', () => {
    for (const bloc of PARLIAMENT_BLOC_DEFINITIONS) {
      for (const value of Object.values(bloc.policyAffinity)) {
        expect(value).toBeGreaterThanOrEqual(-1)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('reliability and baseGovernmentSupport are within their documented bounds', () => {
    for (const bloc of OPPOSITION_BLOC_DEFINITIONS) {
      expect(bloc.reliability).toBeGreaterThanOrEqual(0)
      expect(bloc.reliability).toBeLessThanOrEqual(1)
      expect(bloc.baseGovernmentSupport).toBeGreaterThanOrEqual(-1)
      expect(bloc.baseGovernmentSupport).toBeLessThanOrEqual(1)
    }
  })

  it('no real French party name appears in any bloc name or description', () => {
    const banned = ['Les Républicains', 'Rassemblement National', 'La France Insoumise', 'Renaissance', 'Parti Socialiste', 'Europe Écologie']
    for (const bloc of PARLIAMENT_BLOC_DEFINITIONS) {
      for (const name of banned) {
        expect(bloc.name).not.toContain(name)
        expect(bloc.description).not.toContain(name)
      }
    }
  })
})
