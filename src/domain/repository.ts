/** Provider-neutral input shared by local analysis, demos and GitHub imports. */
export interface SoftwareModule {
  id: string
  name: string
  path: string
  districtId: string
  language: string
  description: string
  metrics: {
    lines: number | null
    bytes?: number
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
  url?: string
  revision?: { branch: string; commit: string }
  notice?: string
  sizeMetric?: 'bytes' | 'lines'
  districts: District[]
  modules: SoftwareModule[]
}
