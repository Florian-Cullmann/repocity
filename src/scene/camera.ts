/** Keep close-up detail independent of how many files the overview contains. */
export function cameraZoom(width: number, height: number, citySize: number) {
  const overview = Math.min(width / (citySize * 1.46), height / (citySize * 1.27)) * 0.94
  return {
    overview,
    far: Math.max(2000, citySize * 5),
    min: overview * 0.45,
    max: Math.max(overview * 12, Math.min(width, height) / 12),
  }
}
