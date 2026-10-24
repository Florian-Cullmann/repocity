import { Color } from 'three'
import { randomFromSeed } from '../city/random'
import type { CityBuilding } from '../city/types'
import { primitiveWriter, type AddPrimitive, type CityGeometry } from './primitives'

/** Architectural vocabulary, independent of repository parsing and layout rules. */
export function addBuilding(geometry: CityGeometry, building: CityBuilding, compact = false) {
  const write = primitiveWriter(geometry, building.id)
  const angle = building.rotation
  const c = Math.cos(angle),
    s = Math.sin(angle)
  const add: AddPrimitive = (shape, position, scale, color, rotation) => {
    const dx = position[0] - building.position[0],
      dz = position[2] - building.position[2]
    write(
      shape,
      [building.position[0] + c * dx + s * dz, position[1], building.position[2] - s * dx + c * dz],
      scale,
      color,
      [rotation?.[0] ?? 0, (rotation?.[1] ?? 0) + angle, rotation?.[2] ?? 0],
    )
  }
  const [x, y, z] = building.position
  const { width: w, depth: d, height: h, floors, style } = building
  const rng = randomFromSeed(`${building.id}:materials`)
  const color =
    '#' + new Color(building.color).lerp(new Color('#e4d8c4'), rng() * 0.4).getHexString()
  const roof = ['#a36e5d', '#6d7779', '#7b7065', '#b8876a', '#586970'][Math.floor(rng() * 5)]
  const cream = '#eee7d9'
  const glass = '#435963'
  const slab = '#d5c9b6'
  const setback = style === 'terrace'
  const round = style === 'tower'
  add('box', [x, y + 0.12, z], [w + 0.5, 0.24, d + 0.5], '#cec9b4')
  // Large repositories retain every building, with fewer facade instances per file.
  if (compact) {
    add(round ? 'cylinder' : 'box', [x, y + h / 2, z], [w, h, d], color)
    for (const side of [-1, 1]) {
      for (const column of [-1, 1]) {
        add(
          'box',
          [x + column * w * 0.23, y + h / 2, z + side * (d / 2 + 0.02)],
          [w * 0.22, h * 0.8, 0.04],
          glass,
        )
        add(
          'box',
          [x + side * (w / 2 + 0.02), y + h / 2, z + column * d * 0.23],
          [0.04, h * 0.8, d * 0.22],
          glass,
        )
      }
    }
    for (let f = 2; f < floors; f += 3) {
      add(round ? 'cylinder' : 'box', [x, y + f * 1.12, z], [w + 0.1, 0.13, d + 0.1], slab)
    }
    if (style === 'gable' && floors <= 5) {
      add('roof', [x, y + h + 0.7, z], [(w + 0.4) * 1.42, 1.4, (d + 0.4) * 1.42], roof, [
        0,
        Math.PI / 4,
        0,
      ])
    } else {
      add(round ? 'cylinder' : 'box', [x, y + h + 0.08, z], [w + 0.2, 0.18, d + 0.2], cream)
      add(
        'box',
        [x, y + h + 0.2, z],
        [w - 0.3, 0.08, d - 0.3],
        building.roofGarden ? '#8da863' : '#768c8e',
      )
    }
    return
  }
  // Octagonal apartment towers contrast with townhouses and stepped offices.
  if (round) {
    for (let f = 0; f < floors; f++) {
      const fy = y + f * 1.12
      add('cylinder', [x, fy + 0.6, z], [w, 1.1, d], color)
      add('cylinder', [x, fy + 0.66, z], [w + 0.025, 0.55, d + 0.025], glass)
      add('cylinder', [x, fy + 1.12, z], [w + 0.4, 0.14, d + 0.4], cream)
      for (let pillar = 0; pillar < 8; pillar++) {
        const angle = (pillar * Math.PI) / 4
        add(
          'box',
          [x + (Math.sin(angle) * w) / 2, fy + 0.6, z + (Math.cos(angle) * d) / 2],
          [0.18, 1.12, 0.18],
          color,
          [0, angle, 0],
        )
      }
    }
    add('cylinder', [x, y + h + 0.16, z], [w - 0.12, 0.12, d - 0.12], '#8ba89a')
    add('cylinder', [x, y + h + 0.5, z], [w * 0.5, 0.65, d * 0.5], color)
    add('cylinder', [x, y + h + 0.86, z], [w * 0.56, 0.12, d * 0.56], cream)
    add('cylinder', [x, y + h + 1.65, z], [0.08, 1.5, 0.08], cream)
    add('box', [x + 0.32, y + h + 2.1, z], [0.65, 0.4, 0.06], '#d87565')
    add('box', [x, y + 0.6, z + d / 2], [0.6, 1.05, 0.1], glass)
    add('box', [x, y + 1.2, z + d / 2 + 0.2], [1.4, 0.15, 0.6], cream)
    return
  }
  // Stacked volumes, balconies, contrasting cornices and recessed windows.
  for (let f = 0; f < floors; f++) {
    const inset = setback ? Math.floor(f / 2) * 0.4 : 0
    const fw = w - inset
    const fd = d - inset
    const fy = y + f * 1.12
    add('box', [x, fy + 0.62, z], [fw, 1.05, fd], color)
    add('box', [x, fy + 1.12, z], [fw + 0.12, 0.09, fd + 0.12], f === floors - 1 ? cream : color)
    for (let window = 0; window < 3; window++) {
      const offsetX = (window - 1) * fw * 0.27
      const offsetZ = (window - 1) * fd * 0.27
      for (const sign of [-1, 1]) {
        add(
          'box',
          [x + offsetX, fy + 0.62, z + sign * (fd / 2 + 0.016)],
          [fw * 0.18, 0.57, 0.045],
          glass,
        )
        add(
          'box',
          [x + sign * (fw / 2 + 0.016), fy + 0.62, z + offsetZ],
          [0.045, 0.57, fd * 0.18],
          glass,
        )
        if (style === 'courtyard' && f % 2 === 1) {
          add(
            'box',
            [x + offsetX, fy + 0.39, z + sign * (fd / 2 + 0.16)],
            [fw * 0.22, 0.15, 0.4],
            cream,
          )
        }
      }
    }
    if (style === 'courtyard') {
      for (const sign of [-1, 1])
        add('box', [x + sign * w * 0.4, fy + 0.6, z + d / 2 + 0.1], [0.2, 1.12, 0.25], cream)
    }
  }
  const roofW = w - (setback ? Math.floor((floors - 1) / 2) * 0.4 : 0)
  const roofD = d - (setback ? Math.floor((floors - 1) / 2) * 0.4 : 0)
  const top = y + h + 0.1
  add('box', [x, y + 0.62, z + d / 2 + 0.05], [0.7, 1.05, 0.08], '#254f50')
  add(
    'box',
    [x, y + 1.22, z + d / 2 + 0.35],
    [1.4, 0.14, 0.8],
    style === 'gable' ? '#db7463' : cream,
  )
  if (style === 'gable' && floors <= 5) {
    add('roof', [x, top + 0.7, z], [(roofW + 0.4) * 1.42, 1.4, (roofD + 0.4) * 1.42], roof, [
      0,
      Math.PI / 4,
      0,
    ])
    add('box', [x + 0.9, top + 1, z - 0.8], [0.4, 1.3, 0.4], cream)
  } else {
    add(
      'box',
      [x, top, z],
      [roofW - 0.2, 0.12, roofD - 0.2],
      building.roofGarden ? '#8da863' : '#768c8e',
    )
    for (const sign of [-1, 1]) {
      add('box', [x + (sign * roofW) / 2, top + 0.16, z], [0.13, 0.34, roofD], cream)
      add('box', [x, top + 0.16, z + (sign * roofD) / 2], [roofW, 0.34, 0.13], cream)
    }
    add(
      'box',
      [x + roofW * 0.18, top + 0.35, z - roofD * 0.18],
      [roofW * 0.35, 0.6, roofD * 0.3],
      color,
    )
    add(
      'box',
      [x + roofW * 0.18, top + 0.69, z - roofD * 0.18],
      [roofW * 0.38, 0.1, roofD * 0.33],
      cream,
    )
    add('cylinder', [x - roofW * 0.24, top + 0.3, z - 0.2], [0.45, 0.5, 0.45], '#b5c6c2')
    if (building.roofGarden) {
      add('box', [x - roofW * 0.22, top + 0.17, z + roofD * 0.3], [1.05, 0.2, 0.5], '#c8aa82')
      add('leaf', [x - roofW * 0.22, top + 0.48, z + roofD * 0.3], [1.1, 0.55, 0.6], '#5f8e53')
    }
  }
}
