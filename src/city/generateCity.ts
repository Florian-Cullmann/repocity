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
    const { lines, files, dependencies, coverage } = module.metrics
    const invalid = (value: number) => !Number.isFinite(value) || value < 0
    if (
      [lines, files].some(invalid) ||
      [dependencies, coverage].some((value) => value !== null && invalid(value)) ||
      (coverage !== null && coverage > 100)
    ) {
      throw new Error(`Ungültige Metriken: ${module.id}`)
    }
  }
  const blockSize = 14
  const roadWidth = 3
  const stride = blockSize + roadWidth
  const groups = [...repository.districts]
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
    .map((district) => ({
      district,
      modules: repository.modules
        .filter((m) => m.districtId === district.id)
        .sort((a, b) => a.id.localeCompare(b.id, 'en')),
    }))
  const needed = groups.reduce((sum, group) => sum + Math.ceil(group.modules.length / 4), 0)
  const grid = Math.max(3, Math.ceil(Math.sqrt(needed + 1)))
  const size = grid * stride + roadWidth
  const centerIndex = Math.floor(grid / 2)
  const coordinate = (i: number) => (i - (grid - 1) / 2) * stride
  const blocks: CityLayout['blocks'] = []
  // Snake ordering keeps adjacent blocks of a district together.
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const column = row % 2 ? grid - 1 - col : col
      blocks.push({
        x: coordinate(column),
        z: coordinate(row),
        park: column === centerIndex && row === centerIndex,
      })
    }
  }
  const available = blocks.filter((block) => !block.park)
  const buildings: CityBuilding[] = []
  let blockIndex = 0
  for (const { district, modules } of groups) {
    for (let i = 0; i < modules.length; i += 4) {
      const block = available[blockIndex++]
      block.districtId = district.id
      for (let slot = 0; slot < 4 && i + slot < modules.length; slot++) {
        const module = modules[i + slot]
        const rng = randomFromSeed(`${config.seed}:${module.id}`)
        // A fixed logarithmic scale also makes small, real source files distinguishable.
        const floors = Math.max(
          2,
          Math.min(13, Math.round(2 + 1.5 * Math.log2(1 + module.metrics.lines / 40))),
        )
        buildings.push({
          id: module.id,
          moduleId: module.id,
          districtId: district.id,
          position: [block.x + (slot % 2 ? 3.15 : -3.15), 0.5, block.z + (slot > 1 ? 3.15 : -3.15)],
          width: 3.6 + rng() * 1.3,
          depth: 3.6 + rng() * 1.3,
          height: floors * 1.12,
          floors,
          style: (['terrace', 'tower', 'gable', 'courtyard'] as const)[Math.floor(rng() * 4)],
          color: district.color,
          roofGarden: rng() > 0.65,
        })
      }
    }
  }
  for (const block of available.slice(blockIndex)) block.park = true
  const trees: CityTree[] = []
  const rng = randomFromSeed(`${config.seed}:landscape`)
  const tree = (x: number, z: number) =>
    trees.push({
      x,
      z,
      height: 1.6 + rng() * 1.5,
      color: ['#729c43', '#93b64e', '#497e50', '#c1c960', '#ddb352'][Math.floor(rng() * 5)],
      conifer: rng() > 0.7,
    })
  for (const block of blocks) {
    for (const sign of [-1, 1]) {
      for (const p of [-5.6, -1.8, 1.8, 5.6]) {
        tree(block.x + p, block.z + sign * 5.9)
        tree(block.x + sign * 5.9, block.z + p)
      }
    }
    if (block.park) {
      for (let i = 0; i < 10; i++) {
        const x = (rng() - 0.5) * 10
        const z = (rng() - 0.5) * 10
        if (Math.abs(x) > 2 && Math.abs(z) > 2) tree(block.x + x, block.z + z)
      }
    }
  }
  return {
    seed: config.seed,
    size,
    grid,
    blockSize,
    roadWidth,
    districts: repository.districts,
    buildings,
    blocks,
    trees,
    roads: Array.from({ length: grid + 1 }, (_, i) => (-grid * stride) / 2 + i * stride),
    landmark: { x: coordinate(centerIndex), z: coordinate(centerIndex) },
  }
}
