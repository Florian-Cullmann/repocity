import { randomFromSeed } from './random'
import type { CityBlock, CityLayout } from './types'

/** Four street frontages surround a private, planted courtyard. */
export function frontagePlots(block: CityBlock) {
  const rows: { x: number; z: number; frontage: number; depth: number; rotation: number }[][] = []
  const depth = Math.min(7.2, Math.min(block.width, block.depth) * 0.22)
  const inset = 1.7 + depth / 2
  const spacing = block.width > 32 ? 7.4 : 6.1
  const row = (length: number, vertical: boolean, side: number) => {
    const count = Math.floor(length / (vertical ? 5.2 : spacing))
    if (!count) return
    const plots: (typeof rows)[number] = []
    rows.push(plots)
    const frontage = length / count
    for (let i = 0; i < count; i++) {
      const along = -length / 2 + (i + 0.5) * frontage
      const x = vertical ? side * (block.width / 2 - inset) : along
      const z = vertical ? along : side * (block.depth / 2 - inset)
      plots.push({
        x: block.x + x + block.shear * z,
        z: block.z + z,
        frontage,
        depth,
        rotation:
          (vertical ? Math.atan(block.shear) + Math.PI / 2 : 0) + (side === -1 ? Math.PI : 0),
      })
    }
  }
  for (const side of [-1, 1]) row(block.width - 4.4, false, side)
  // Reserve the corners for the north/south rows, including roof overhangs.
  for (const side of [-1, 1]) row(block.depth - 2 * (depth + 3.2), true, side)
  // Round-robin frontages keep all sides populated even when a block is partly occupied.
  return Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, i) =>
    rows.flatMap((row) => (row[i] ? [row[i]] : [])),
  ).flat()
}

/** Straight neighbourhood streets beside an independently meandering river. */
export function createPlan(extent: number, seed: string) {
  const rng = randomFromSeed(`${seed}:streets`)
  const half = extent / 2
  const bands = Math.max(2, Math.round(extent / 95))
  const weights = Array.from({ length: bands }, () => 0.75 + rng() * 0.5)
  const sum = weights.reduce((a, b) => a + b, 0)
  const edges = [-half]
  for (const weight of weights) edges.push(edges.at(-1)! + (extent * weight) / sum)
  const phase = rng() * Math.PI * 2
  // Bound bends in world units: large repositories must not become a warped sheet.
  const amplitude = Math.min(18, extent * 0.065)
  const bends = edges.map((z) => Math.sin((z / extent) * 5 + phase) * amplitude)
  const riverX = -Math.max(0, extent * 0.16 - 14)
  const river = {
    points: edges.map((z, i) => [riverX + bends[i], z] as [number, number]),
    width: Math.min(14, 7 + extent * 0.008),
    promenadeWidth: 3.2,
  }
  const corridor = river.width / 2 + river.promenadeWidth
  const blocks: CityLayout['blocks'] = []
  const roads: CityLayout['roads'] = []
  for (let band = 0; band < bands; band++) {
    const z0 = edges[band],
      z1 = edges[band + 1]
    // Each bank reserves the whole river envelope. Buildings remain rectangular;
    // the varying space beside the water becomes a riverside greenway.
    const west = riverX + Math.min(bends[band], bends[band + 1]) - corridor - 4
    const east = riverX + Math.max(bends[band], bends[band + 1]) + corridor + 4
    const point = (x: number, z: number): [number, number] => [x, z]
    const split = (left: number, right: number, top: number, bottom: number, depth = 0) => {
      const w = right - left,
        d = bottom - top
      const vertical = w > d * (0.8 + rng() * 0.4)
      const length = vertical ? w : d
      const target = 33 + rng() * 13
      if (length > target && length > 47 && depth < 14) {
        const width = depth === 0 && length > 85 ? 4.6 : 3
        // Unequal cuts and independent banks break up continuous rows and crossroads.
        const fraction = Math.max(23 / length, Math.min(1 - 23 / length, 0.35 + rng() * 0.3))
        const cut = (vertical ? left : top) + length * fraction
        roads.push({
          from: vertical ? point(cut, top) : point(left, cut),
          to: vertical ? point(cut, bottom) : point(right, cut),
          width,
          kind: width > 4 ? 'avenue' : 'street',
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
          x: (left + right) / 2,
          z,
          width: w,
          depth: d,
          shear: 0,
          park: false,
          kind: 'buildings',
        })
      }
    }
    const top = z0 + 2.8,
      bottom = z1 - 2.8
    split(-half + 4.5, west, top, bottom)
    split(east, half - 4.5, top, bottom)
    // Quays connect side streets to bridges; perimeter streets close the network.
    for (const x of [-half + 2.5, west + 2, east - 2, half - 2.5]) {
      roads.push({
        from: point(x, z0),
        to: point(x, z1),
        width: 3.6,
        kind: 'street',
        bridge: false,
      })
    }
  }
  for (let i = 0; i < edges.length; i++) {
    const z = edges[i],
      bend = bends[i]
    for (const [left, right, bridge] of [
      [-half + 2.5, riverX + bend - corridor, false],
      [riverX + bend - corridor, riverX + bend + corridor, true],
      [riverX + bend + corridor, half - 2.5, false],
    ] as const) {
      roads.push({
        from: [left, z],
        to: [right, z],
        width: 5.6,
        kind: 'avenue',
        bridge,
      })
    }
  }
  const civic = [...blocks]
    .filter((block) => block.x > riverX + corridor)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]
  for (const block of blocks) {
    const edge = Math.hypot(block.x / half, block.z / half)
    // Parks form a green belt and occasional larger neighbourhood clearings.
    if (block === civic || rng() < (edge > 0.95 ? 0.25 : 0.085)) {
      block.park = true
      block.kind = block === civic ? 'plaza' : 'garden'
    }
  }
  // Nearby parcels remain nearby in the file/district assignment.
  blocks.sort((a, b) => {
    const bandA = Math.floor((a.z + half) / 48),
      bandB = Math.floor((b.z + half) / 48)
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
