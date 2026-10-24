import { describe, expect, it } from 'vitest'
import { createMockRepository } from '../data/mockRepository'
import { generateCity } from './generateCity'
import { compileCity } from '../scene/compileCity'
import type { CityBuilding } from './types'

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
  it.each([0, 1, 5, 96, 256, 768, 2000, 5905])(
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
        const block = city.blocks.find((block) => block.id === building.blockId)!
        expect(block.park).toBe(false)
        for (const [cx, cz] of footprint(building, 0.25)) {
          expect(Math.abs(cx - block.x - block.shear * (cz - block.z))).toBeLessThan(
            block.width / 2,
          )
          expect(Math.abs(cz - block.z)).toBeLessThan(block.depth / 2)
        }
      }
      for (const block of city.blocks) {
        const neighbours = city.buildings.filter((building) => building.blockId === block.id)
        for (let i = 0; i < neighbours.length; i++)
          for (let j = i + 1; j < neighbours.length; j++) {
            expect(overlaps(neighbours[i], neighbours[j])).toBe(false)
          }
      }
      expect(city.blocks.some((b) => b.park)).toBe(true)
    },
  )
  it('creates varied rectangular parcels, connected T-junctions, a civic square and river bridges', () => {
    const city = generateCity(repo, { seed: 'urban' })
    expect(
      new Set(city.blocks.map((block) => `${Math.round(block.width)}:${Math.round(block.depth)}`))
        .size,
    ).toBeGreaterThan(4)
    expect(
      city.roads.every(
        (road) =>
          Math.abs(road.to[0] - road.from[0]) < 0.001 ||
          Math.abs(road.to[1] - road.from[1]) < 0.001,
      ),
    ).toBe(true)
    expect(city.blocks.every((block) => block.shear === 0)).toBe(true)
    expect(city.blocks.some((block) => block.kind === 'plaza')).toBe(true)
    expect(city.roads.filter((road) => road.bridge)).toHaveLength(city.river.points.length)
    const connected = new Set([0])
    for (let pass = 0; pass < city.roads.length; pass++)
      for (let i = 0; i < city.roads.length; i++) {
        if (connected.has(i)) continue
        const a = city.roads[i]
        if (
          [...connected].some((j) => {
            const b = city.roads[j]
            const distance = Math.min(
              pointDistance(a.from, b.from, b.to),
              pointDistance(a.to, b.from, b.to),
              pointDistance(b.from, a.from, a.to),
              pointDistance(b.to, a.from, a.to),
            )
            return distance <= (a.width + b.width) / 2 + 0.1
          })
        )
          connected.add(i)
      }
    expect(connected.size).toBe(city.roads.length)
    expect(
      city.roads.some((a) =>
        city.roads.some(
          (b) =>
            a !== b &&
            [a.from, a.to].some(
              (p) =>
                pointDistance(p, b.from, b.to) < b.width / 2 + 0.1 &&
                Math.hypot(p[0] - b.from[0], p[1] - b.from[1]) > 4 &&
                Math.hypot(p[0] - b.to[0], p[1] - b.to[1]) > 4,
            ),
        ),
      ),
    ).toBe(true)
  })
  it.each(['hello-world', 'urban', 'riverfront'])(
    'builds four-sided blocks without long strips (%s)',
    (seed) => {
      const city = generateCity(createMockRepository('urban/repo', 768), { seed })
      const buildingsByBlock = new Map<string, CityBuilding[]>()
      for (const building of city.buildings) {
        const group = buildingsByBlock.get(building.blockId) ?? []
        group.push(building)
        buildingsByBlock.set(building.blockId, group)
      }
      expect(city.blocks.every((b) => Math.max(b.width / b.depth, b.depth / b.width) < 2.5)).toBe(
        true,
      )
      expect(
        [...buildingsByBlock.values()].filter(
          (group) => new Set(group.map((building) => Math.round(building.rotation * 10))).size >= 4,
        ).length,
      ).toBeGreaterThan(buildingsByBlock.size / 2)
      for (const group of buildingsByBlock.values()) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++)
            expect(overlaps(group[i], group[j])).toBe(false)
        }
      }
      const size = city.size
      expect(
        city.river.points.some(([x]) => Math.abs(x - city.river.points[0][0]) > size * 0.02),
      ).toBe(true)
    },
  )
  it.each(['hello-world', 'ElectricJack/agent-queue', 'riverfront'])(
    'keeps a large city straight and its river clear of buildings (%s)',
    (seed) => {
      const city = generateCity(createMockRepository('large/repo', 5905), { seed })
      expect(city.blocks.every((block) => block.shear === 0)).toBe(true)
      const riverXs = city.river.points.map(([x]) => x)
      expect(Math.max(...riverXs) - Math.min(...riverXs)).toBeLessThanOrEqual(36)
      for (const building of city.buildings)
        for (const point of footprint(building, 0.25))
          for (let i = 1; i < city.river.points.length; i++)
            expect(
              pointDistance(point, city.river.points[i - 1], city.river.points[i]),
            ).toBeGreaterThan(city.river.width / 2 + city.river.promenadeWidth)
      const edgeTrees = city.trees.filter(
        (tree) => Math.max(Math.abs(tree.x), Math.abs(tree.z)) > (city.size - 18) / 2,
      )
      expect(edgeTrees.length).toBeLessThan(city.size)
      expect(
        city.trees.every(
          (tree) =>
            Math.max(Math.abs(tree.x), Math.abs(tree.z)) + tree.height * 0.4 < city.size / 2,
        ),
      ).toBe(true)
    },
  )
  it('uses byte sizes consistently and keeps heights stable when lines are measured later', () => {
    const snapshot = createMockRepository('bytes/repo', 2)
    snapshot.sizeMetric = 'bytes'
    snapshot.modules[0].metrics = { ...snapshot.modules[0].metrics, lines: null, bytes: 500 }
    snapshot.modules[1].metrics = { ...snapshot.modules[1].metrics, lines: null, bytes: 50000 }
    const first = generateCity(snapshot, { seed: 'bytes' })
    expect(first.buildings[0].height).toBeLessThan(first.buildings[1].height)
    snapshot.modules[0].metrics.lines = 1000
    expect(generateCity(snapshot, { seed: 'bytes' })).toEqual(first)
  })
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
  it('retains every module in the compact geometry of a large city', () => {
    const snapshot = createMockRepository('large/repo', 2000)
    const geometry = compileCity(generateCity(snapshot, { seed: 'compact' }))
    const instances = Object.values(geometry).flat()
    expect(new Set(instances.map((instance) => instance.buildingId).filter(Boolean))).toEqual(
      new Set(snapshot.modules.map((module) => module.id)),
    )
    expect(instances.filter((instance) => instance.buildingId).length).toBeLessThan(2000 * 20)
    expect(
      instances.every((instance) =>
        instance.scale.every((value) => Number.isFinite(value) && value > 0),
      ),
    ).toBe(true)
  })
  it('rejects invalid adapter data instead of silently dropping modules', () => {
    const snapshot = createMockRepository('test/repo', 2)
    snapshot.modules[1].id = snapshot.modules[0].id
    expect(() => generateCity(snapshot, { seed: 'x' })).toThrow('unique')
    snapshot.modules[1].id = 'unique'
    snapshot.modules[1].districtId = 'missing'
    expect(() => generateCity(snapshot, { seed: 'x' })).toThrow('Unknown district')
    snapshot.modules[1].districtId = 'core'
    snapshot.modules[1].metrics.lines = NaN
    expect(() => generateCity(snapshot, { seed: 'x' })).toThrow('Invalid metrics')
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
    { bytes: NaN },
    { bytes: -1 },
    { lines: null },
  ])('rejects invalid metrics %j', (metrics) => {
    const snapshot = createMockRepository('test/repo', 1)
    Object.assign(snapshot.modules[0].metrics, metrics)
    expect(() => generateCity(snapshot, { seed: 'invalid' })).toThrow('Invalid metrics')
  })
})

function footprint(building: CityBuilding, margin = 0): [number, number][] {
  const c = Math.cos(building.rotation),
    s = Math.sin(building.rotation)
  return [-1, 1].flatMap((x) =>
    [-1, 1].map((z): [number, number] => {
      const dx = x * (building.width / 2 + margin),
        dz = z * (building.depth / 2 + margin)
      return [building.position[0] + c * dx + s * dz, building.position[2] - s * dx + c * dz]
    }),
  )
}
function overlaps(a: CityBuilding, b: CityBuilding) {
  const corners = [footprint(a, 0.3), footprint(b, 0.3)]
  return [a.rotation, b.rotation]
    .flatMap((r) => [
      [Math.cos(r), -Math.sin(r)],
      [Math.sin(r), Math.cos(r)],
    ])
    .every(([nx, nz]) => {
      const [pa, pb] = corners.map((points) => points.map(([x, z]) => x * nx + z * nz))
      return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa)
    })
}
function pointDistance(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1]
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)),
  )
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)
}
