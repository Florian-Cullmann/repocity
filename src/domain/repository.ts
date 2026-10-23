/** Provider-neutral input shared by local analysis, demos and future GitHub adapters. */
export interface SoftwareModule {
  id: string
  name: string
  path: string
  districtId: string
  language: string
  description: string
  metrics: {
    lines: number
    files: number
    dependencies: number | null
    coverage: number | null
  }
}

export interface District {
  id: string
  name: string
  subtitle: string
  color: string
}

export interface RepositorySnapshot {
  name: string
  source: 'mock' | 'local' | 'github'
  districts: District[]
  modules: SoftwareModule[]
}
