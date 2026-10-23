import type { District } from '../domain/repository'

export type Vec3 = [number, number, number]
export type CityPoint = [number, number]
export interface CityConfig {
  seed: string
}
export interface CityBuilding {
  id: string
  moduleId: string
  districtId: string
  blockId: string
  position: Vec3
  rotation: number
  width: number
  depth: number
  height: number
  floors: number
  style: 'terrace' | 'tower' | 'gable' | 'courtyard'
  color: string
  roofGarden: boolean
}
export interface CityBlock {
  id: string
  x: number
  z: number
  width: number
  depth: number
  shear: number
  park: boolean
  kind: 'buildings' | 'garden' | 'plaza'
  districtId?: string
}
export interface CityRoad {
  from: CityPoint
  to: CityPoint
  width: number
  kind: 'avenue' | 'street'
  bridge: boolean
}
export interface CityRiver {
  points: CityPoint[]
  width: number
  promenadeWidth: number
}
export interface CityTree {
  x: number
  z: number
  height: number
  color: string
  conifer: boolean
}
export interface CityLayout {
  seed: string
  size: number
  districts: District[]
  buildings: CityBuilding[]
  blocks: CityBlock[]
  trees: CityTree[]
  roads: CityRoad[]
  river: CityRiver
  landmark: { x: number; z: number }
}
