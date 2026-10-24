import type { RepositorySnapshot } from '../domain/repository'
import { randomFromSeed } from './random'
import { createPlan, frontagePlots } from './streetPlan'
import type { CityBuilding, CityConfig, CityLayout, CityTree } from './types'

/** Pure layout generation: domain data in, serializable city out. No React/Three. */
export function generateCity(repository: RepositorySnapshot, config: CityConfig): CityLayout {
  if (new Set(repository.modules.map((m) => m.id)).size !== repository.modules.length) {
    throw new Error('Module IDs must be unique.')
  }
  const districtIds = new Set(repository.districts.map((d) => d.id))
  if (districtIds.size !== repository.districts.length)
    throw new Error('District IDs must be unique.')
  for (const module of repository.modules) {
    if (!districtIds.has(module.districtId))
      throw new Error(`Unknown district: ${module.districtId}`)
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
      throw new Error(`Invalid metrics: ${module.id}`)
    }
  }
  const districtsById = new Map(repository.districts.map((district) => [district.id, district]))
  const modules = [...repository.modules].sort(
    (a, b) => a.districtId.localeCompare(b.districtId, 'en') || a.id.localeCompare(b.id, 'en'),
  )
  // Grow only when subdivision and public spaces leave too few frontage plots.
  let extent = Math.max(112, Math.sqrt((modules.length + 8) * 125))
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
      const plot = plots[i]
      const rng = randomFromSeed(`${config.seed}:${module.id}`)
      // Each snapshot uses one fixed scale: measured lines or GitHub byte sizes.
      const floors = Math.max(
        2,
        Math.min(
          13,
          Math.round(
            2 +
              Math.log2(
                1 +
                  (repository.sizeMetric === 'bytes'
                    ? module.metrics.bytes! / 4800
                    : module.metrics.lines! / 120),
              ),
          ),
        ),
      )
      const district = districtsById.get(module.districtId)!
      const styles =
        floors > 8
          ? (['tower', 'terrace', 'courtyard', 'terrace'] as const)
          : (['gable', 'courtyard', 'terrace', 'gable'] as const)
      buildings.push({
        id: module.id,
        moduleId: module.id,
        districtId: district.id,
        blockId: block.id,
        position: [plot.x, 0.5, plot.z],
        rotation: plot.rotation,
        width: (plot.frontage - 1.1) * (0.94 + rng() * 0.06),
        depth: plot.depth * (0.85 + rng() * 0.15),
        height: floors * 1.12,
        floors,
        style: styles[Math.floor(rng() * styles.length)],
        color: district.color,
        roofGarden: rng() > 0.65,
      })
    }
  }
  // Larger files occupy central plots in each neighbourhood, creating a skyline
  // without changing the common metric-to-height scale or the stable module order.
  const neighbourhoods = new Map<string, CityBuilding[]>()
  for (const building of buildings) {
    const group = neighbourhoods.get(building.districtId) ?? []
    group.push(building)
    neighbourhoods.set(building.districtId, group)
  }
  for (const neighbourhood of neighbourhoods.values()) {
    if (!neighbourhood.length) continue
    const centerX = neighbourhood.reduce((sum, b) => sum + b.position[0], 0) / neighbourhood.length
    const centerZ = neighbourhood.reduce((sum, b) => sum + b.position[2], 0) / neighbourhood.length
    const plots = neighbourhood
      .map(({ position, rotation, width, depth, blockId }) => ({
        position,
        rotation,
        width,
        depth,
        blockId,
      }))
      .sort(
        (a, b) =>
          Math.hypot(a.position[0] - centerX, a.position[2] - centerZ) -
          Math.hypot(b.position[0] - centerX, b.position[2] - centerZ),
      )
    ;[...neighbourhood]
      .sort((a, b) => b.height - a.height || a.id.localeCompare(b.id, 'en'))
      .forEach((building, i) => Object.assign(building, plots[i]))
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
      for (let i = 0; i < Math.floor((block.width * block.depth) / 14); i++) {
        const x = (rng() - 0.5) * (block.width - 4)
        const z = (rng() - 0.5) * (block.depth - 4)
        if (Math.abs(x) > 4.5 && Math.abs(z) > 6) point(x, z)
      }
    } else {
      for (let x = -block.width / 2 + 11; x < block.width / 2 - 10; x += 5) {
        for (let z = -block.depth / 2 + 11; z < block.depth / 2 - 10; z += 5) {
          if (rng() > 0.35) point(x + (rng() - 0.5), z + (rng() - 0.5))
        }
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
  // Wooded edges soften the footprint instead of ending every street at a bare board.
  for (let x = -size / 2 + 3; x < size / 2 - 3; x += 4) {
    for (let z = -size / 2 + 3; z < size / 2 - 3; z += 4) {
      const next = river.points.findIndex((point) => point[1] > z)
      const segment = Math.max(0, (next === -1 ? river.points.length - 1 : next) - 1)
      const [a, b] = [river.points[segment], river.points[segment + 1]]
      const bend =
        a[0] - plan.riverX + (b[0] - a[0]) * Math.max(0, Math.min(1, (z - a[1]) / (b[1] - a[1])))
      const outside = Math.abs(x - bend) > extent / 2 + 2 || Math.abs(z) > extent / 2 + 3
      if (outside && Math.abs(x - (plan.riverX + bend)) > river.width / 2 + 4 && rng() > 0.22) {
        tree(x + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2)
      }
    }
  }
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
