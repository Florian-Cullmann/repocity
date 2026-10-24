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
  add('box', [0, -0.08, 0], [size, 0.2, size], '#aabd8b')

  const river = city.river
  for (let i = 0; i < river.points.length - 1; i++) {
    const [a, b] = [river.points[i], river.points[i + 1]]
    const depth = b[1] - a[1],
      shear = (b[0] - a[0]) / depth
    const x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2
    add('box', [x, 0.06, z], [river.width, 0.08, depth], '#60979f', undefined, shear)
    for (const side of [-1, 1]) {
      add(
        'box',
        [x + (side * (river.width + river.promenadeWidth)) / 2, 0.16, z],
        [river.promenadeWidth, 0.32, depth],
        '#d4cbb1',
        undefined,
        shear,
      )
    }
    add('box', [x, 0.14, z], [river.width, 0.05, depth], '#77b6bd', undefined, shear)
    for (let p = 3; p < depth - 2; p += 4.7) {
      add(
        'box',
        [a[0] + shear * p + (rng() - 0.5) * 3, 0.175, a[1] + p],
        [1 + rng(), 0.015, 0.08],
        '#a2d0ce',
      )
    }
    for (const side of [-1, 1]) {
      add(
        'box',
        [x + side * (river.width / 2 + 0.3), 0.45, z],
        [0.18, 0.4, depth],
        '#eee3c7',
        undefined,
        shear,
      )
    }
  }

  for (const block of city.blocks) {
    const { x, z, width: w, depth: d, shear } = block
    const local: AddPrimitive = (shape, position, scale, color, rotation, slope) =>
      add(
        shape,
        [x + position[0] + shear * position[2], position[1], z + position[2]],
        scale,
        color,
        rotation,
        slope,
      )
    local('box', [0, 0.2, 0], [w, 0.4, d], '#d5d1bd', undefined, shear)
    local(
      'box',
      [0, 0.42, 0],
      [w - 3.8, 0.04, d - 3.8],
      block.kind === 'plaza' ? '#e4d9bd' : '#a4b982',
      undefined,
      shear,
    )
    if (block.park) {
      local('box', [0, 0.46, 0], [1.4, 0.06, d - 1], '#ded6bb', undefined, shear)
      local('box', [0, 0.46, 0], [w - 1, 0.06, 1.4], '#ded6bb')
      if (block.kind !== 'plaza') {
        const amenity = rng()
        if (amenity < 0.35) {
          // A neighbourhood pond set among trees.
          local('cylinder', [0, 0.55, 0], [7, 0.16, 5], '#d6cbb2')
          local('cylinder', [0, 0.65, 0], [6.2, 0.06, 4.2], '#79afb3')
        } else if (amenity < 0.7) {
          // Small paved play court; its markings remain visible in close-up.
          local('box', [0, 0.52, 0], [7, 0.08, 10], '#b98a72')
          for (const side of [-1, 1]) {
            local('box', [side * 3, 0.57, 0], [0.1, 0.025, 9], '#ede6d4')
            local('box', [0, 0.57, side * 4.5], [6, 0.025, 0.1], '#ede6d4')
          }
          local('box', [0, 0.57, 0], [6, 0.025, 0.1], '#ede6d4')
        }
      } else {
        local('box', [0, 0.46, 0], [9, 0.08, 8], '#d0c5aa')
        // Market awnings give the civic square a human scale.
        for (let i = -1; i <= 1; i++) {
          local('box', [i * 2.8, 1, -d / 2 + 3], [2.2, 1.1, 1.2], '#b39770')
          local('box', [i * 2.8, 2.2, -d / 2 + 3], [2.6, 0.18, 1.7], i % 2 ? '#d58a68' : '#e9d5a6')
        }
      }
    } else {
      const alongZ = d > w * 1.1
      local(
        'box',
        [0, 0.46, 0],
        [alongZ ? 1 : Math.max(1, w - 20), 0.06, alongZ ? Math.max(1, d - 20) : 1],
        '#d7cfb5',
        undefined,
        alongZ ? shear : 0,
      )
    }
    for (const side of [-1, 1]) {
      const lx = side * (w / 2 - 0.7),
        lz = side * (d / 2 - 1.2)
      local('cylinder', [lx, 1.8, lz], [0.09, 2.8, 0.09], '#536664')
      local('box', [lx, 3.2, lz], [0.3, 0.15, 0.65], '#faf0d4')
      const bx = side * (w / 2 - 2.2)
      local('box', [bx, 0.76, 0], [0.4, 0.16, 1.5], '#a77955')
      local('box', [bx + side * 0.2, 0.95, 0], [0.1, 0.45, 1.5], '#a77955')
      local(
        'cylinder',
        [lx, 0.78, (rng() - 0.5) * (d - 3)],
        [0.22, 0.6, 0.22],
        side === 1 ? '#db8359' : '#405a76',
      )
    }
  }

  for (const road of city.roads) {
    const dx = road.to[0] - road.from[0],
      dz = road.to[1] - road.from[1]
    const length = Math.hypot(dx, dz),
      angle = Math.atan2(dx, dz)
    const c = Math.cos(angle),
      s = Math.sin(angle)
    const x = (road.from[0] + road.to[0]) / 2,
      z = (road.from[1] + road.to[1]) / 2
    const local: AddPrimitive = (shape, position, scale, color) =>
      add(
        shape,
        [x + c * position[0] + s * position[2], position[1], z - s * position[0] + c * position[2]],
        scale,
        color,
        [0, angle, 0],
      )
    const y = road.bridge ? 0.34 : 0.06
    local(
      'box',
      [0, y - 0.08, 0],
      [road.width, 0.16, length + 0.06],
      road.bridge ? '#788887' : '#697371',
    )
    if (road.kind === 'avenue') {
      for (let p = -length / 2 + 3; p < length / 2 - 2; p += 3.4) {
        local('box', [0, y + 0.012, p], [0.08, 0.025, 1.5], '#e2dec7')
      }
      if (length > 15) {
        for (const end of [-1, 1])
          for (let stripe = -3; stripe <= 3; stripe++) {
            local(
              'box',
              [stripe * 0.5, y + 0.02, end * (length / 2 - 2.4)],
              [0.27, 0.025, 1],
              '#ebe6d0',
            )
          }
      }
    }
    if (road.bridge) {
      for (const side of [-1, 1]) {
        local('box', [side * (road.width / 2 + 0.28), y + 0.05, 0], [0.55, 0.25, length], '#e3d8bd')
        local('box', [side * (road.width / 2 + 0.28), y + 0.8, 0], [0.12, 0.12, length], '#647e78')
        for (let p = -length / 2; p <= length / 2; p += 1.7) {
          local('box', [side * (road.width / 2 + 0.28), y + 0.45, p], [0.09, 0.8, 0.09], '#647e78')
        }
      }
    }
    if (length > 13 && rng() > 0.2) {
      const lane = road.width * 0.25,
        p = (rng() - 0.5) * (length - 9)
      const color = ['#d88366', '#edc566', '#e2e5dc', '#6e9bb0'][Math.floor(rng() * 4)]
      local('box', [lane, y + 0.34, p], [0.85, 0.5, 1.8], color)
      local('box', [lane, y + 0.7, p - 0.1], [0.74, 0.35, 0.9], '#bdd2cc')
      local('box', [lane, y + 0.9, p - 0.1], [0.78, 0.1, 0.94], color)
      for (const side of [-1, 1])
        for (const end of [-1, 1]) {
          local('box', [lane + side * 0.43, y + 0.17, p + end * 0.55], [0.13, 0.3, 0.32], '#394b4a')
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
