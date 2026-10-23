import type { CityLayout } from '../city/types'
import { addBuilding } from './buildings'
import { addEnvironment } from './environment'
import { createGeometry } from './primitives'

/** Compile once per layout, batch all repeated shapes into five draw calls. */
export function compileCity(city: CityLayout) {
  const geometry = createGeometry()
  addEnvironment(geometry, city)
  city.buildings.forEach((building) =>
    addBuilding(geometry, building, city.buildings.length > 1500),
  )
  return geometry
}
