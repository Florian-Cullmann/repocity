import type { RepositorySnapshot } from '../domain/repository'
import { randomFromSeed } from './random'
import type { CityBuilding, CityConfig, CityLayout, CityTree } from './types'

/** Pure layout generation: domain data in, serializable city out. No React/Three. */
export function generateCity(repository: RepositorySnapshot, config: CityConfig): CityLayout {
  if (new Set(repository.modules.map((m) => m.id)).size !== repository.modules.length) {
    throw new Error('Modul-IDs müssen eindeutig sein.')
  }
  const districtIds = new Set(repository.districts.map((d) => d.id))
  if (districtIds.size !== repository.districts.length)
    throw new Error('Viertel-IDs müssen eindeutig sein.')
  for (const module of repository.modules) {
    if (!districtIds.has(module.districtId))
      throw new Error(`Unbekanntes Viertel: ${module.districtId}`)
    const { lines, bytes, files, dependencies, coverage } = module.metrics
    const invalid = (value: number) => !Number.isFinite(value) || value < 0
    if (
      invalid(files) ||
      (lines !== null && invalid(lines)) ||
      (bytes !== undefined && invalid(bytes)) ||
      (repository.sizeMetric === 'bytes' ? bytes === undefined : lines === null) ||
      [dependencies, coverage].some((value) => value !== null && invalid(value)) ||
      (coverage !== null && coverage > 100)
    ) {
      throw new Error(`Ungültige Metriken: ${module.id}`)
    }
  }
  const districtsById = new Map(repository.districts.map((district) => [district.id, district]))
  const modules = [...repository.modules].sort(
    (a, b) => a.districtId.localeCompare(b.districtId, 'en') || a.id.localeCompare(b.id, 'en'),
  )
  // Grow only when subdivision and public spaces leave too few frontage plots.
  let extent = Math.max(72, Math.sqrt((modules.length + 8) * 95))
  let plan = createPlan(extent, config.seed)
  while (plan.capacity < modules.length) {
    extent *= 1.12
    plan = createPlan(extent, config.seed)
  }
  const { blocks, roads, river, landmark } = plan
  const developed = blocks.filter((block) => !block.park)
  const buildings: CityBuilding[] = []
  let moduleIndex = 0
  let capacity = plan.capacity
  for (const block of developed) {
    const plots = frontagePlots(block)
    const count = Math.min(
      plots.length,
      Math.ceil(((modules.length - moduleIndex) * plots.length) / capacity),
    )
    capacity -= plots.length
    if (!count) {
      block.park = true
      block.kind = 'garden'
      continue
    }
    block.districtId = modules[moduleIndex].districtId
    for (let i = 0; i < count; i++) {
      const module = modules[moduleIndex++]
      const plot = plots[Math.floor((i * plots.length) / count)]
      const rng = randomFromSeed(`${config.seed}:${module.id}`)
      // Each snapshot uses one fixed scale: measured lines or GitHub byte sizes.
      const floors = Math.max(
        2,
        Math.min(
          13,
          Math.round(
            2 +
              1.5 *
                Math.log2(
                  1 +
                    (repository.sizeMetric === 'bytes'
                      ? module.metrics.bytes! / 1600
                      : module.metrics.lines! / 40),
                ),
          ),
        ),
      )
      const district = districtsById.get(module.districtId)!
      const styles =
        floors > 9
          ? (['tower', 'terrace', 'courtyard'] as const)
          : (['gable', 'courtyard', 'terrace', 'gable'] as const)
      buildings.push({
        id: module.id,
        moduleId: module.id,
        districtId: district.id,
        blockId: block.id,
        position: [plot.x, 0.5, plot.z],
        rotation: plot.rotation,
        width: Math.min(5, plot.frontage - 1.25) * (0.92 + rng() * 0.08),
        depth: 4.3 + rng() * 0.7,
        height: floors * 1.12,
        floors,
        style: styles[Math.floor(rng() * styles.length)],
        color: district.color,
        roofGarden: rng() > 0.65,
      })
    }
  }
  const trees: CityTree[] = []
  const rng = randomFromSeed(`${config.seed}:landscape`)
  const tree = (x: number, z: number) =>
    trees.push({
      x,
      z,
      height: 1.7 + rng() * 1.4,
      color: ['#729c43', '#93b64e', '#497e50', '#b4bd64'][Math.floor(rng() * 4)],
      conifer: rng() > 0.8,
    })
  for (const block of blocks) {
    const point = (x: number, z: number) => tree(block.x + x + block.shear * z, block.z + z)
    if (block.park) {
      for (let i = 0; i < Math.floor((block.width * block.depth) / 28); i++) {
        const x = (rng() - 0.5) * (block.width - 4)
        const z = (rng() - 0.5) * (block.depth - 4)
        if (Math.abs(x) > 3.5 && Math.abs(z) > 2) point(x, z)
      }
    } else {
      // Shared courtyard gardens replace the identical ring of trees on every lot.
      const alongZ = block.depth > block.width * 1.1
      const length = alongZ ? block.depth : block.width
      for (let t = -length / 2 + 4; t < length / 2 - 2; t += 5.5) {
        point(alongZ ? (rng() - 0.5) * 1.2 : t, alongZ ? t : (rng() - 0.5) * 1.2)
      }
    }
  }
  for (let i = 0; i < river.points.length - 1; i++) {
    const [a, b] = [river.points[i], river.points[i + 1]]
    for (let z = a[1] + 4; z < b[1] - 2; z += 5) {
      const x = a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1])
      for (const side of [-1, 1]) tree(x + side * (river.width / 2 + 1.7), z)
    }
  }
  const size = extent + Math.max(...river.points.map(([x]) => Math.abs(x - plan.riverX))) * 2 + 7
  return {
    seed: config.seed,
    size,
    districts: repository.districts,
    buildings,
    blocks,
    trees,
    roads,
    river,
    landmark,
  }
}

/** Frontage rows enclose a shared courtyard; narrow parcels turn with their street. */
function frontagePlots(block: CityLayout['blocks'][number]) {
  const alongZ = block.depth > block.width * 1.1
  const length = alongZ ? block.depth : block.width
  const count = Math.max(2, Math.floor((length - 4.6) / 5.4))
  const frontage = (length - 4.6) / count
  return [-1, 1].flatMap((side) =>
    Array.from({ length: count }, (_, i) => {
      const along = -length / 2 + 2.3 + (i + 0.5) * frontage
      const x = alongZ ? side * (block.width / 2 - 4) : along
      const z = alongZ ? along : side * (block.depth / 2 - 4)
      return {
        x: block.x + x + block.shear * z,
        z: block.z + z,
        frontage,
        rotation: (alongZ ? Math.atan(block.shear) - Math.PI / 2 : 0) + (side === -1 ? Math.PI : 0),
      }
    }),
  )
}

/** A bent river and staggered subdivisions give connected streets with T-junctions. */
function createPlan(extent: number, seed: string) {
  const rng = randomFromSeed(`${seed}:streets`)
  const half = extent / 2
  const bands = Math.max(2, Math.round(extent / 27))
  const weights = Array.from({ length: bands }, () => 0.85 + rng() * 0.3)
  const sum = weights.reduce((a, b) => a + b, 0)
  const edges = [-half]
  for (const weight of weights) edges.push(edges.at(-1)! + (extent * weight) / sum)
  const bends = edges.map((_, i) => Math.sin(i * 1.5 + rng() * 0.35) * 3)
  const riverX = -extent * 0.12
  const river = {
    points: edges.map((z, i) => [riverX + bends[i], z] as [number, number]),
    width: 6,
    promenadeWidth: 3,
  }
  const corridor = river.width / 2 + river.promenadeWidth
  const blocks: CityLayout['blocks'] = []
  const roads: CityLayout['roads'] = []
  for (let band = 0; band < bands; band++) {
    const z0 = edges[band],
      z1 = edges[band + 1]
    const shear = (bends[band + 1] - bends[band]) / (z1 - z0)
    const offset = (z: number) => bends[band] + shear * (z - z0)
    const point = (x: number, z: number): [number, number] => [x + offset(z), z]
    const split = (left: number, right: number, top: number, bottom: number, depth = 0) => {
      const w = right - left,
        d = bottom - top
      const vertical = w > d * (0.95 + rng() * 0.3)
      const length = vertical ? w : d
      if (length > 37 && depth < 10) {
        const width = depth === 0 ? 3.6 : 2.6
        const cut = (vertical ? left : top) + length * (0.47 + rng() * 0.06)
        roads.push({
          from: vertical ? point(cut, top) : point(left, cut),
          to: vertical ? point(cut, bottom) : point(right, cut),
          width,
          kind: depth === 0 ? 'avenue' : 'street',
          bridge: false,
        })
        if (vertical) {
          split(left, cut - width / 2, top, bottom, depth + 1)
          split(cut + width / 2, right, top, bottom, depth + 1)
        } else {
          split(left, right, top, cut - width / 2, depth + 1)
          split(left, right, cut + width / 2, bottom, depth + 1)
        }
      } else {
        const z = (top + bottom) / 2
        blocks.push({
          id: `parcel-${blocks.length}`,
          x: (left + right) / 2 + offset(z),
          z,
          width: w,
          depth: d,
          shear,
          park: false,
          kind: 'buildings',
        })
      }
    }
    const top = z0 + 2.3,
      bottom = z1 - 2.3
    split(-half + 2.3, riverX - corridor, top, bottom)
    split(riverX + corridor, half - 2.3, top, bottom)
  }
  // Cross-town avenues meet every branch, with bridges only over the water corridor.
  for (let i = 0; i < edges.length; i++) {
    const z = edges[i],
      bend = bends[i]
    for (const [left, right, bridge] of [
      [-half, riverX - corridor, false],
      [riverX - corridor, riverX + corridor, true],
      [riverX + corridor, half, false],
    ] as const) {
      roads.push({
        from: [left + bend, z],
        to: [right + bend, z],
        width: 4.6,
        kind: 'avenue',
        bridge,
      })
    }
  }
  const civic = [...blocks]
    .filter((block) => block.x > riverX + corridor)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]
  for (const [i, block] of blocks.entries()) {
    if (block === civic || i % 11 === 8) {
      block.park = true
      block.kind = block === civic ? 'plaza' : 'garden'
    }
  }
  // Snake order keeps neighbouring files and districts close without repeating a grid.
  blocks.sort((a, b) => {
    const bandA = edges.findIndex((z) => z > a.z),
      bandB = edges.findIndex((z) => z > b.z)
    return bandA - bandB || (bandA % 2 ? a.x - b.x : b.x - a.x)
  })
  return {
    blocks,
    roads,
    river,
    riverX,
    landmark: { x: civic.x, z: civic.z },
    capacity: blocks
      .filter((block) => !block.park)
      .reduce((sum, block) => sum + frontagePlots(block).length, 0),
  }
}
