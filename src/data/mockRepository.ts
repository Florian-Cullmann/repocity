import type { District, RepositorySnapshot } from '../domain/repository'
import { randomFromSeed } from '../city/random'

export const districts: District[] = [
  { id: 'core', name: 'Core District', subtitle: 'Das Herz der Anwendung', color: '#ed9a72' },
  {
    id: 'interface',
    name: 'Design Quarter',
    subtitle: 'Komponenten & Oberflächen',
    color: '#b3a2d8',
  },
  { id: 'services', name: 'Service Heights', subtitle: 'APIs & Geschäftslogik', color: '#7dbab4' },
  { id: 'data', name: 'Data Gardens', subtitle: 'Daten & Zustandsverwaltung', color: '#a9bc78' },
  { id: 'tooling', name: 'Workshop Lane', subtitle: 'Werkzeuge & Infrastruktur', color: '#e9bd63' },
  { id: 'tests', name: 'Quality Park', subtitle: 'Tests & Dokumentation', color: '#90b5d2' },
]

const names: Record<string, string[]> = {
  core: [
    'app-engine',
    'router',
    'auth',
    'scheduler',
    'event-bus',
    'permissions',
    'config',
    'bootstrap',
  ],
  interface: [
    'design-system',
    'navigation',
    'dashboard',
    'forms',
    'modals',
    'charts',
    'typography',
    'icons',
  ],
  services: [
    'api-client',
    'notifications',
    'search',
    'payments',
    'analytics',
    'mail',
    'storage',
    'webhooks',
  ],
  data: ['store', 'cache', 'models', 'queries', 'migrations', 'serializers', 'validation', 'sync'],
  tooling: [
    'build-tools',
    'logger',
    'cli',
    'bundler',
    'lint-rules',
    'dev-server',
    'release',
    'telemetry',
  ],
  tests: [
    'unit-tests',
    'integration',
    'fixtures',
    'test-utils',
    'stories',
    'e2e',
    'accessibility',
    'docs',
  ],
}

export function createMockRepository(name = 'acme / atlas', count = 96): RepositorySnapshot {
  const rng = randomFromSeed(`mock:${name}`)
  return {
    name,
    source: 'mock',
    districts,
    modules: Array.from({ length: count }, (_, index) => {
      const district = districts[index % districts.length]
      const localIndex = Math.floor(index / districts.length)
      const base = names[district.id][localIndex % 8]
      const moduleName = localIndex < 8 ? base : `${base}-${Math.floor(localIndex / 8) + 1}`
      return {
        id: `${district.id}/${moduleName}`,
        name: moduleName,
        path: `src/${district.id}/${moduleName}`,
        districtId: district.id,
        language: 'TypeScript',
        description: `${moduleName} bündelt ${district.subtitle.toLowerCase()} und bildet einen eigenständigen Baustein der Anwendung. Fiktive Beispieldaten zum Erkunden der Stadt.`,
        metrics: {
          lines: Math.round(300 + rng() ** 1.6 * 9500),
          files: Math.ceil(3 + rng() * 38),
          dependencies: Math.ceil(rng() * 16),
          coverage: Math.round(65 + rng() * 35),
        },
      }
    }),
  }
}
