import type { CityBuilding } from '../city/types'
import { primitiveWriter, type CityGeometry } from './primitives'

/** Architectural vocabulary, independent of repository parsing and layout rules. */
export function addBuilding(geometry: CityGeometry, building: CityBuilding) {
  const add = primitiveWriter(geometry, building.id)
  const [x, y, z] = building.position
  const { width: w, depth: d, height: h, floors, color, style } = building
  const cream = '#fff1d5'
  const glass = '#365c64'
  const slab = '#ecded1'
  const setback = style === 'terrace'
  const round = style === 'tower'
  add('box', [x, y + 0.12, z], [w + 0.5, 0.24, d + 0.5], '#cec9b4')
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
    add('box', [x, fy + 1.12, z], [fw + 0.16, 0.14, fd + 0.16], f === floors - 1 ? cream : slab)
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
  if (style === 'gable' && floors < 9) {
    add('roof', [x, top + 0.7, z], [(roofW + 0.4) * 1.42, 1.4, (roofD + 0.4) * 1.42], '#a96459', [
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
