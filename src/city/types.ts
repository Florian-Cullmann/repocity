import type { District } from '../domain/repository'

export type Vec3 = [number, number, number]
export interface CityConfig {
  seed: string
}
export interface CityBuilding {
  id: string
  moduleId: string
  districtId: string
  position: Vec3
  width: number
  depth: number
  height: number
  floors: number
  style: 'terrace' | 'tower' | 'gable' | 'courtyard'
  color: string
  roofGarden: boolean
}
export interface CityBlock {
  x: number
  z: number
  park: boolean
  districtId?: string
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
  grid: number
  blockSize: number
  roadWidth: number
  districts: District[]
  buildings: CityBuilding[]
  blocks: CityBlock[]
  trees: CityTree[]
  roads: number[]
  landmark: { x: number; z: number }
}
