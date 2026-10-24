// Keep the view oblique enough to show facades, even after orbiting.
export const cameraAngles = { min: Math.PI / 4, max: Math.PI / 2.4 }
export const overviewDirection = [1, 0.9, 1] as const

/** Fit the isometric footprint and skyline; close-ups stay independent of city size. */
export function cameraZoom(width: number, height: number, citySize: number) {
  const overview =
    Math.min(width / (citySize * Math.SQRT2 + 8), height / (citySize * 0.76 + 40)) * 0.9
  return {
    overview,
    far: Math.max(2000, citySize * 5),
    min: overview * 0.45,
    max: Math.max(overview * 12, Math.min(width, height) / 12),
  }
}
