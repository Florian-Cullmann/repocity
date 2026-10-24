import { describe, expect, it } from 'vitest'
import { OrthographicCamera, Vector3 } from 'three'
import { cameraAngles, cameraZoom, overviewDirection } from './camera'

describe('city camera', () => {
  it('keeps facades visible throughout the allowed orbit', () => {
    const polar = Math.atan2(
      Math.hypot(overviewDirection[0], overviewDirection[2]),
      overviewDirection[1],
    )
    expect(cameraAngles.min).toBeGreaterThanOrEqual(Math.PI / 4)
    expect(polar).toBeGreaterThan(cameraAngles.min)
    expect(polar).toBeLessThan(cameraAngles.max)
    expect(cameraAngles.max).toBeLessThan(Math.PI / 2)
  })
  it.each([112, 1000, 2000])('fits the %i-unit city and its skyline into the overview', (size) => {
    const width = 1100,
      height = 900
    const { overview, far } = cameraZoom(width, height, size)
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, far)
    camera.position.set(...overviewDirection).multiplyScalar(size)
    camera.zoom = overview
    camera.lookAt(0, 1, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    for (const x of [-size / 2, size / 2])
      for (const z of [-size / 2, size / 2])
        for (const y of [-2, 38]) {
          const point = new Vector3(x, y, z).project(camera)
          expect(Math.abs(point.x)).toBeLessThan(1)
          expect(Math.abs(point.y)).toBeLessThan(1)
        }
  })
  it.each([
    [1100, 900],
    [390, 844],
  ])('allows building close-ups in a %i × %i viewport', (width, height) => {
    const small = cameraZoom(width, height, 112)
    const metropolis = cameraZoom(width, height, 1000)
    expect(metropolis.max / metropolis.overview).toBeGreaterThan(30)
    expect(Math.min(width, height) / metropolis.max).toBeLessThanOrEqual(12)
    expect(metropolis.max).toBeGreaterThanOrEqual(small.max)
    expect(small.max / small.overview).toBeGreaterThanOrEqual(12)
    expect(metropolis.far).toBeGreaterThan(1000 * 3)
    expect(metropolis.min).toBeLessThan(metropolis.overview)
  })
})

it.each([112, 1000, 2000])(
  'keeps the entire %i-unit city inside the depth range at every viewing angle',
  (size) => {
    const { far } = cameraZoom(1440, 1000, size)
    const camera = new OrthographicCamera(-size, size, size, -size, 0.1, far)
    const radius = Math.hypot(...overviewDirection) * size
    for (const polar of [cameraAngles.min, Math.PI / 3, cameraAngles.max]) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        camera.position.setFromSphericalCoords(radius, polar, angle)
        camera.lookAt(0, 1, 0)
        camera.updateMatrixWorld()
        for (const x of [-size / 2, size / 2]) {
          for (const z of [-size / 2, size / 2]) {
            for (const y of [-2, 38]) {
              const depth = new Vector3(x, y, z).project(camera).z
              expect(depth).toBeGreaterThan(-1)
              expect(depth).toBeLessThan(1)
            }
          }
        }
      }
    }
  },
)
