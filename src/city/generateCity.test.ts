import { describe, expect, it } from 'vitest'
import { createMockRepository } from '../data/mockRepository'
import { generateCity } from './generateCity'
import { compileCity } from '../scene/compileCity'

describe('deterministic city generation', () => {
  const repo = createMockRepository()
  it('reproduces the complete layout and decoration from a seed', () => {
    const first = generateCity(repo, { seed: 'test' })
    const second = generateCity(structuredClone(repo), { seed: 'test' })
    expect(first).toEqual(second)
    expect(compileCity(first)).toEqual(compileCity(second))
  })
  it('changes architecture and landscape for a different seed', () => {
    const first = generateCity(repo, { seed: 'a' })
    const second = generateCity(repo, { seed: 'b' })
    expect(first.buildings).not.toEqual(second.buildings)
    expect(first.trees).not.toEqual(second.trees)
    expect(first.buildings.map((b) => b.moduleId)).toEqual(second.buildings.map((b) => b.moduleId))
  })
  it('does not depend on module order or mutate the source', () => {
    const before = structuredClone(repo)
    const first = generateCity(repo, { seed: 'order' })
    const reordered = { ...repo, modules: [...repo.modules].reverse() }
    expect(generateCity(reordered, { seed: 'order' })).toEqual(first)
    expect(repo).toEqual(before)
  })
  it.each([0, 1, 5, 96, 256, 768, 2000])(
    'lays out %i modules without collisions or missing modules',
    (count) => {
      const snapshot = createMockRepository('test/repo', count)
      const city = generateCity(snapshot, { seed: 'scale' })
      expect(city.buildings).toHaveLength(count)
      expect(new Set(city.buildings.map((b) => b.moduleId)).size).toBe(count)
      const locations = new Set<string>()
      for (const building of city.buildings) {
        const [x, , z] = building.position
        const location = `${x}:${z}`
        expect(locations.has(location)).toBe(false)
        locations.add(location)
        expect(Math.abs(x) + building.width / 2).toBeLessThan(city.size / 2)
        expect(Math.abs(z) + building.depth / 2).toBeLessThan(city.size / 2)
        for (const road of city.roads) {
          expect(Math.abs(x - road)).toBeGreaterThan(building.width / 2 + city.roadWidth / 2)
          expect(Math.abs(z - road)).toBeGreaterThan(building.depth / 2 + city.roadWidth / 2)
        }
      }
      expect(city.blocks.some((b) => b.park)).toBe(true)
    },
  )
  it('uses module size for height and preserves IDs through all rendered building parts', () => {
    const snapshot = createMockRepository('test/repo', 2)
    snapshot.modules[0].metrics.lines = 100
    snapshot.modules[1].metrics.lines = 20000
    const city = generateCity(snapshot, { seed: 'metrics' })
    expect(city.buildings.find((b) => b.id === snapshot.modules[0].id)!.height).toBeLessThan(
      city.buildings.find((b) => b.id === snapshot.modules[1].id)!.height,
    )
    const geometry = compileCity(city)
    const renderedIds = new Set(
      Object.values(geometry)
        .flat()
        .map((p) => p.buildingId)
        .filter(Boolean),
    )
    expect(renderedIds).toEqual(new Set(snapshot.modules.map((m) => m.id)))
    expect(Object.keys(geometry)).toHaveLength(5)
    for (const instance of Object.values(geometry).flat()) {
      expect(instance.position.every(Number.isFinite)).toBe(true)
      expect(instance.scale.every((v) => v > 0 && Number.isFinite(v))).toBe(true)
    }
  })
  it('rejects invalid adapter data instead of silently dropping modules', () => {
    const snapshot = createMockRepository('test/repo', 2)
    snapshot.modules[1].id = snapshot.modules[0].id
    expect(() => generateCity(snapshot, { seed: 'x' })).toThrow('eindeutig')
    snapshot.modules[1].id = 'unique'
    snapshot.modules[1].districtId = 'missing'
    expect(() => generateCity(snapshot, { seed: 'x' })).toThrow('Unbekanntes Viertel')
    snapshot.modules[1].districtId = 'core'
    snapshot.modules[1].metrics.lines = NaN
    expect(() => generateCity(snapshot, { seed: 'x' })).toThrow('Ungültige Metriken')
  })
  it('accepts unavailable optional metrics and preserves measured zero values', () => {
    const snapshot = createMockRepository('test/repo', 2)
    snapshot.modules[0].metrics.dependencies = null
    snapshot.modules[0].metrics.coverage = null
    snapshot.modules[1].metrics.dependencies = 0
    snapshot.modules[1].metrics.coverage = 0
    expect(generateCity(snapshot, { seed: 'measured' }).buildings).toHaveLength(2)
  })
  it.each([
    { lines: -1 },
    { files: Infinity },
    { dependencies: NaN },
    { dependencies: -1 },
    { coverage: 101 },
    { coverage: -1 },
  ])('rejects invalid metrics %j', (metrics) => {
    const snapshot = createMockRepository('test/repo', 1)
    Object.assign(snapshot.modules[0].metrics, metrics)
    expect(() => generateCity(snapshot, { seed: 'invalid' })).toThrow('Ungültige Metriken')
  })
})
