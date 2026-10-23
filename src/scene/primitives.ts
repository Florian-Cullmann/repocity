import type { Vec3 } from '../city/types'

export type Shape = 'box' | 'cylinder' | 'cone' | 'leaf' | 'roof'
export interface Instance {
  position: Vec3
  scale: Vec3
  color: string
  rotation?: Vec3
  shear?: number
  buildingId?: string
}
export type CityGeometry = Record<Shape, Instance[]>
export const createGeometry = (): CityGeometry => ({
  box: [],
  cylinder: [],
  cone: [],
  leaf: [],
  roof: [],
})
export type AddPrimitive = (
  shape: Shape,
  position: Vec3,
  scale: Vec3,
  color: string,
  rotation?: Vec3,
  shear?: number,
) => void

export function primitiveWriter(geometry: CityGeometry, buildingId?: string): AddPrimitive {
  return (shape, position, scale, color, rotation, shear) =>
    geometry[shape].push({ position, scale, color, rotation, shear, buildingId })
}
