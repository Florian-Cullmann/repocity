import type { CityLayout, Vec3 } from '../city/types'
import { randomFromSeed } from '../city/random'
import { primitiveWriter, type AddPrimitive, type CityGeometry } from './primitives'

function beam(add: AddPrimitive, from: Vec3, to: Vec3, width: number, color: string) {
  const dx = to[0] - from[0],
    dy = to[1] - from[1],
    dz = to[2] - from[2]
  const length = Math.hypot(dx, dy, dz)
  add(
    'box',
    [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    [width, length, width],
    color,
    [Math.atan2(dz, dy), 0, -Math.atan2(dx, Math.hypot(dy, dz))],
  )
}

function addLandmark(add: AddPrimitive, x: number, z: number) {
  const red = '#d76c53',
    white = '#f9eacf'
  add('cylinder', [x, 0.65, z], [6, 0.24, 6], '#c9c5ad')
  for (let tier = 0; tier < 4; tier++) {
    const y = 0.7 + tier * 3.3
    const bottom = 2.1 - tier * 0.42
    const top = bottom - 0.42
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        beam(
          add,
          [x + a * bottom, y, z + b * bottom],
          [x + a * top, y + 3.3, z + b * top],
          0.23,
          red,
        )
        beam(
          add,
          [x + a * bottom, y, z + b * bottom],
          [x - a * top, y + 3.3, z + b * top],
          0.12,
          red,
        )
        beam(
          add,
          [x + a * bottom, y, z + b * bottom],
          [x + a * top, y + 3.3, z - b * top],
          0.12,
          red,
        )
      }
    add('box', [x, y + 3.3, z], [top * 2 + 0.3, 0.16, top * 2 + 0.3], tier === 2 ? white : red)
  }
  add('box', [x, 11.5, z], [3, 1.3, 3], white)
  add('box', [x, 11.6, z], [3.03, 0.6, 3.03], '#466b72')
  add('box', [x, 12.2, z], [3.3, 0.18, 3.3], white)
  add('cone', [x, 15.2, z], [1.5, 4, 1.5], red)
  for (let i = 0; i < 5; i++)
    add('cylinder', [x, 17 + i * 0.65, z], [0.22, 0.65, 0.22], i % 2 ? white : red)
}

export function addEnvironment(geometry: CityGeometry, city: CityLayout) {
  const add = primitiveWriter(geometry)
  const size = city.size
  const rng = randomFromSeed(`${city.seed}:decorations`)
  add('box', [0, -1.15, 0], [size + 2, 1.6, size + 2], '#709185')
  add('box', [0, -0.28, 0], [size + 2.5, 0.22, size + 2.5], '#c9d2b5')
  add('box', [0, -0.08, 0], [size, 0.2, size], '#627071')
  for (const block of city.blocks) {
    const { x, z } = block
    add('box', [x, 0.15, z], [14.1, 0.4, 14.1], '#d8d5c2')
    add('box', [x, 0.38, z], [12.9, 0.12, 12.9], block.park ? '#a8bd7e' : '#9eb67b')
    if (block.park) {
      add('box', [x, 0.46, z], [1.3, 0.08, 12.8], '#ddd6b9')
      add('box', [x, 0.46, z], [12.8, 0.08, 1.3], '#ddd6b9')
      if (x !== city.landmark.x || z !== city.landmark.z) {
        add('cylinder', [x, 0.6, z], [4.5, 0.3, 4.5], '#e9e1cb')
        add('cylinder', [x, 0.77, z], [3.7, 0.08, 3.7], '#79bbc1')
        add('cylinder', [x, 1.02, z], [0.8, 0.55, 0.8], '#e9e1cb')
        add('leaf', [x, 1.45, z], [0.9, 0.8, 0.9], '#a7dadd')
      }
    } else {
      add('box', [x, 0.46, z], [0.7, 0.08, 12], '#d4cfb5')
      add('box', [x, 0.46, z], [12, 0.08, 0.7], '#d4cfb5')
    }
    // Benches, planters, street lamps, and tiny pedestrians at every block.
    for (const sign of [-1, 1]) {
      add('box', [x + sign * 5.8, 0.76, z], [0.4, 0.16, 1.2], '#a77955')
      add('box', [x + sign * 6.02, 0.95, z], [0.1, 0.45, 1.2], '#a77955')
      add('cylinder', [x + sign * 6.7, 1.7, z + sign * 6.7], [0.09, 2.7, 0.09], '#536664')
      add('box', [x + sign * 6.7, 3.04, z + sign * 6.5], [0.28, 0.13, 0.6], '#faf0d4')
      for (let f = 0; f < 3; f++) {
        add('leaf', [x + sign * (5.5 - f * 0.45), 0.65, z + 1.5], [0.5, 0.4, 0.5], '#54855a')
        add('leaf', [x + sign * (5.5 - f * 0.45), 0.83, z + 1.5], [0.2, 0.2, 0.2], '#edb99c')
      }
      const px = x + sign * 6.6,
        pz = z + (rng() - 0.5) * 8
      add('cylinder', [px, 0.78, pz], [0.22, 0.6, 0.22], sign === 1 ? '#db8359' : '#405a76')
      add('leaf', [px, 1.17, pz], [0.28, 0.28, 0.28], '#efd4ad')
    }
  }
  for (const road of city.roads) {
    for (let i = 0; i < city.grid; i++) {
      const center = city.roads[i] + 8.5
      for (let j = -2; j <= 2; j++) {
        add('box', [road, 0.035, center + j * 2.4], [0.07, 0.02, 1.1], '#e2dec7')
        add('box', [center + j * 2.4, 0.035, road], [1.1, 0.02, 0.07], '#e2dec7')
      }
      // Zebra crossings stop before the junction; no overlapping road surfaces.
      for (const side of [-1, 1])
        for (let stripe = -2; stripe <= 2; stripe++) {
          const end = center + side * 6.2
          add('box', [road + stripe * 0.43, 0.04, end], [0.26, 0.025, 0.85], '#ebe6d0')
          add('box', [end, 0.04, road + stripe * 0.43], [0.85, 0.025, 0.26], '#ebe6d0')
        }
      if (rng() > 0.3) {
        const offset = (rng() - 0.5) * 6
        const color = ['#d88366', '#edc566', '#c5d2cd', '#6e9bb0'][Math.floor(rng() * 4)]
        const carX = road + 0.72,
          carZ = center + offset
        add('box', [carX, 0.38, carZ], [0.8, 0.47, 1.65], color)
        add('box', [carX, 0.73, carZ - 0.1], [0.7, 0.35, 0.86], '#c3d8d2')
        add('box', [carX, 0.93, carZ - 0.1], [0.72, 0.09, 0.9], color)
        for (const s of [-1, 1])
          for (const t of [-1, 1]) {
            add('box', [carX + s * 0.41, 0.2, carZ + t * 0.52], [0.13, 0.3, 0.32], '#394b4a')
          }
      }
    }
  }
  for (const tree of city.trees) {
    add(
      'cylinder',
      [tree.x, 0.45 + tree.height * 0.25, tree.z],
      [0.19, tree.height * 0.5, 0.19],
      '#9a7856',
    )
    add(
      tree.conifer ? 'cone' : 'leaf',
      [tree.x, 0.6 + tree.height * 0.7, tree.z],
      [tree.height * 0.58, tree.height, tree.height * 0.58],
      tree.color,
    )
    if (tree.conifer)
      add(
        'cone',
        [tree.x, 0.65 + tree.height, tree.z],
        [tree.height * 0.42, tree.height * 0.8, tree.height * 0.42],
        tree.color,
      )
  }
  addLandmark(add, city.landmark.x, city.landmark.z)
}
