/** Provider-neutral input. A future GitHub adapter only has to produce this model. */
export interface SoftwareModule {
  id: string
  name: string
  path: string
  districtId: string
  language: string
  description: string
  metrics: { lines: number; files: number; dependencies: number; coverage: number }
}

export interface District {
  id: string
  name: string
  subtitle: string
  color: string
}

export interface RepositorySnapshot {
  name: string
  source: 'mock' | 'github'
  districts: District[]
  modules: SoftwareModule[]
}
