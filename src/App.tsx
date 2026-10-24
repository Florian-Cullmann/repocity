import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import {
  ArrowDownUp,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  Compass,
  Dice5,
  FolderCode,
  GitFork as Github,
  HelpCircle,
  Layers3,
  LocateFixed,
  Map,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RotateCw,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react'
import { createMockRepository } from './data/mockRepository'
import { fetchGitHubRepository, parseGitHubRepository } from './data/githubRepository'
import localRepository from 'virtual:repository-snapshot'
import type { RepositorySnapshot } from './domain/repository'
import { generateCity } from './city/generateCity'
import type { CameraAction } from './scene/CityScene'
import { BuildingInfo } from './ui/BuildingInfo'
import { MiniMap } from './ui/MiniMap'
import './styles.css'

const CityScene = lazy(() => import('./scene/CityScene'))
const format = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
type Source = RepositorySnapshot['source']

function App() {
  const [sourceInput, setSourceInput] = useState<Source>('github')
  const [repositoryInput, setRepositoryInput] = useState('Florian-Cullmann/repocity')
  const [seedInput, setSeedInput] = useState('hello-world')
  const [countInput, setCountInput] = useState(96)
  const [config, setConfig] = useState({
    repository: localRepository,
    seed: 'hello-world',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusDistrict, setFocusDistrict] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [generating, startTransition] = useTransition()
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const activeImport = useRef<AbortController | null>(null)
  const pending = generating || importProgress !== null
  useEffect(() => () => activeImport.current?.abort(), [])
  const [cameraAction, setCameraAction] = useState<CameraAction>({ type: 'reset', sequence: 0 })
  const repository = config.repository
  const city = useMemo(
    () => generateCity(repository, { seed: config.seed }),
    [repository, config.seed],
  )
  const selectedModule = repository.modules.find((module) => module.id === selectedId)
  const selectedDistrict = repository.districts.find(
    (district) => district.id === selectedModule?.districtId,
  )
  const visibleModules = repository.modules.filter(
    (module) => !focusDistrict || module.districtId === focusDistrict,
  )
  const byteSized = repository.sizeMetric === 'bytes'
  const totalSize = repository.modules.reduce(
    (sum, module) => sum + (byteSized ? (module.metrics.bytes ?? 0) : (module.metrics.lines ?? 0)),
    0,
  )
  const totalFiles = repository.modules.reduce((sum, module) => sum + module.metrics.files, 0)
  const sizeUnit =
    byteSized && totalSize > 0 ? Math.min(3, Math.floor(Math.log2(totalSize) / 10)) : 0
  const sizeLabel = byteSized
    ? `${(totalSize / 1024 ** sizeUnit).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${['B', 'KiB', 'MiB', 'GiB'][sizeUnit]}`
    : format.format(totalSize)
  const onReady = useCallback(() => setReady(true), [])
  const camera = (type: CameraAction['type']) =>
    setCameraAction((action) => ({ type, sequence: action.sequence + 1 }))
  const selectModule = (id: string | null) => {
    setSelectedId(id)
    if (id) setSidebarOpen(false)
  }

  function cancelImport() {
    activeImport.current?.abort()
    activeImport.current = null
    setImportProgress(null)
  }

  function showRepository(snapshot: RepositorySnapshot, seed: string) {
    startTransition(() => {
      setConfig({ repository: snapshot, seed })
      setSelectedId(null)
      setFocusDistrict(null)
      camera('reset')
    })
    setSidebarOpen(false)
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (!seedInput.trim()) {
      setError('Please enter a seed.')
      return
    }
    setError('')
    cancelImport()
    const seed = seedInput.trim()
    if (sourceInput === 'local') {
      showRepository(localRepository, seed)
      return
    }
    let name: string
    try {
      name = parseGitHubRepository(repositoryInput)
    } catch (error) {
      setError((error as Error).message)
      return
    }
    if (sourceInput === 'mock') {
      showRepository(createMockRepository(name, countInput), seed)
      return
    }
    const controller = new AbortController()
    activeImport.current = controller
    setImportProgress('Loading repository …')
    try {
      const snapshot = await fetchGitHubRepository(name, {
        signal: controller.signal,
        onProgress: (loaded, total) => {
          if (activeImport.current === controller && !controller.signal.aborted)
            setImportProgress(`${loaded} of ${total} source files indexed …`)
        },
      })
      if (activeImport.current === controller && !controller.signal.aborted)
        showRepository(snapshot, seed)
    } catch (error) {
      if (activeImport.current === controller && !controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'The import failed.')
    } finally {
      if (activeImport.current === controller) {
        activeImport.current = null
        setImportProgress(null)
      }
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="./" className="brand" aria-label="RepoCity home">
          <span className="brand-icon">
            <span />
            <span />
            <span />
          </span>
          <span>
            repo<span className="brand-light">city</span>
            <sup>β</sup>
          </span>
        </a>
        <div className="topbar-actions">
          <a
            href="https://github.com/Florian-Cullmann/repocity"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            <Github size={17} />
            <span>Open source</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </header>

      <main className="workspace">
        <button
          className="mobile-menu panel"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-expanded={sidebarOpen}
          aria-controls="explorer-sidebar"
        >
          <Layers3 size={16} /> Explore city <ChevronDown size={15} />
        </button>
        <aside id="explorer-sidebar" className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <form className="generator" onSubmit={generate}>
            <label htmlFor="repository-source">Data source</label>
            <select
              id="repository-source"
              className="source-select"
              value={sourceInput}
              onChange={(event) => {
                cancelImport()
                setSourceInput(event.target.value as Source)
                setError('')
              }}
            >
              <option value="github">GitHub · public repository</option>
              <option value="local">RepoCity · example project</option>
              <option value="mock">Demo · sample data</option>
            </select>
            <label htmlFor="repository">
              Repository{' '}
              <span className="tiny-badge">
                {sourceInput === 'github' ? 'GITHUB' : sourceInput === 'local' ? 'EXAMPLE' : 'DEMO'}
              </span>
            </label>
            <div className="input-with-icon">
              {sourceInput === 'local' ? <FolderCode size={16} /> : <Github size={16} />}
              <input
                id="repository"
                value={sourceInput === 'local' ? localRepository.name : repositoryInput}
                readOnly={sourceInput === 'local'}
                onChange={(event) => {
                  cancelImport()
                  setRepositoryInput(event.target.value)
                  setError('')
                }}
                placeholder="https://github.com/owner/repository"
                maxLength={250}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="seed-row">
              <label htmlFor="seed">City seed</label>
            </div>
            <div className="input-with-icon">
              <Sprout size={16} />
              <input
                id="seed"
                value={seedInput}
                onChange={(event) => {
                  cancelImport()
                  setSeedInput(event.target.value)
                }}
                maxLength={80}
                spellCheck={false}
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Choose a random seed"
                onClick={() => {
                  cancelImport()
                  setSeedInput(`city-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`)
                }}
              >
                <Dice5 size={17} />
              </button>
            </div>
            {sourceInput === 'mock' ? (
              <div className="size-row">
                <label htmlFor="city-size">City size</label>
                <select
                  id="city-size"
                  value={countInput}
                  onChange={(event) => setCountInput(Number(event.target.value))}
                >
                  <option value={96}>Small town · 96</option>
                  <option value={256}>City · 256</option>
                  <option value={768}>Metropolis · 768</option>
                </select>
              </div>
            ) : sourceInput === 'local' ? (
              <p className="source-details">
                {localRepository.modules.length} source files · {localRepository.districts.length}{' '}
                folders. Each file is a building; each folder a district.
              </p>
            ) : (
              <p className="source-details">
                Enter a GitHub URL or owner/repository. Each source file becomes a building.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={pending} type="submit">
              <Sparkles size={16} />
              {pending
                ? 'Building city …'
                : sourceInput === 'github'
                  ? 'Load repository'
                  : 'Generate city'}
              <ArrowRight size={16} />
            </button>
            {importProgress !== null && (
              <div className="import-progress">
                <p role="status" aria-live="polite">
                  {importProgress}
                </p>
                <button type="button" onClick={cancelImport}>
                  Cancel import
                </button>
              </div>
            )}
            {sourceInput !== 'github' && (
              <p className="source-note">
                <span className="status-dot" />
                {sourceInput === 'local' ? 'Measured locally.' : 'Fictional demo data.'}
              </p>
            )}
          </form>
          <section className="district-section" aria-label="Districts">
            <div className="section-heading">
              <h2>Districts</h2>
              <span>{String(repository.districts.length).padStart(2, '0')}</span>
            </div>
            <div className="district-list">
              {repository.districts.map((district) => (
                <button
                  key={district.id}
                  className={`district-button ${focusDistrict === district.id ? 'active' : ''}`}
                  aria-pressed={focusDistrict === district.id}
                  onClick={() =>
                    setFocusDistrict(focusDistrict === district.id ? null : district.id)
                  }
                >
                  <span className="district-swatch" style={{ background: district.color }} />
                  <span>{district.name}</span>
                  <span className="district-count">
                    {repository.modules.filter((m) => m.districtId === district.id).length}
                  </span>
                  {focusDistrict === district.id ? (
                    <Check size={13} />
                  ) : (
                    <span className="district-arrow">↗</span>
                  )}
                </button>
              ))}
            </div>
            <label className="module-select-label" htmlFor="module-select">
              Explore a module directly
            </label>
            <select
              id="module-select"
              className="module-select"
              value={visibleModules.some((m) => m.id === selectedId) ? (selectedId ?? '') : ''}
              onChange={(event) => selectModule(event.target.value || null)}
            >
              <option value="">Choose a building …</option>
              {visibleModules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.name}
                </option>
              ))}
            </select>
          </section>
          <div className="sidebar-footer">
            <span className="small-brand">⌘</span>
            <span>
              Built for curiosity.
              <br />
              <strong>A fresh perspective on software.</strong>
            </span>
          </div>
        </aside>

        <section className="city-stage" aria-label="Interactive 3D city" aria-busy={pending}>
          <div className="scene-heading">
            <div className="repo-title">
              <h2>{repository.name.split('/').at(-1)}</h2>
              <span>
                {repository.source === 'github'
                  ? 'GitHub'
                  : repository.source === 'local'
                    ? 'Real data'
                    : 'Mock City'}
              </span>
            </div>
            <p>
              {repository.source === 'local' ? <FolderCode size={13} /> : <Github size={13} />}
              {repository.name} <span>/</span>
              <span>
                {repository.revision
                  ? `${repository.revision.branch} · ${repository.revision.commit.slice(0, 7)}`
                  : repository.source === 'local'
                    ? 'Example project'
                    : 'Demo'}
              </span>
            </p>
          </div>
          <div className="city-stats panel">
            <div>
              <Box size={16} />
              <strong>{city.buildings.length}</strong>
              <span>Buildings</span>
            </div>
            <div>
              <Layers3 size={16} />
              <strong>{format.format(totalFiles)}</strong>
              <span>Files</span>
            </div>
            <div>
              <ArrowDownUp size={16} />
              <strong>{sizeLabel}</strong>
              <span>{byteSized ? 'Source code' : 'Lines of code'}</span>
            </div>
          </div>
          <div className="canvas-wrap" data-testid="city-canvas" data-ready={ready}>
            <Suspense
              fallback={
                <div className="loading-city">
                  <span className="loading-mark">
                    <Layers3 size={28} />
                  </span>
                  Building your city …
                </div>
              }
            >
              <CityScene
                city={city}
                selectedId={selectedId}
                onSelect={selectModule}
                cameraAction={cameraAction}
                focusDistrict={focusDistrict}
                onReady={onReady}
              />
            </Suspense>
          </div>
          {focusDistrict && (
            <button className="filter-pill panel" onClick={() => setFocusDistrict(null)}>
              <span className="status-dot" />
              {repository.districts.find((d) => d.id === focusDistrict)?.name} highlighted
              <X size={13} />
            </button>
          )}
          {selectedModule && selectedDistrict ? (
            <BuildingInfo
              module={selectedModule}
              district={selectedDistrict}
              repository={repository}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="explore-hint panel">
              <span className="hint-icon">
                <MousePointer2 size={17} />
              </span>
              <div>
                <strong>Every building tells a story.</strong>
                <span>Click a building to explore its module.</span>
              </div>
            </div>
          )}
          <MiniMap city={city} selectedId={selectedId} onSelect={selectModule} />
          <div className="view-tools panel" aria-label="Camera controls">
            <button aria-label="Zoom in" title="Zoom in" onClick={() => camera('in')}>
              <Plus size={18} />
            </button>
            <button aria-label="Zoom out" title="Zoom out" onClick={() => camera('out')}>
              <Minus size={18} />
            </button>
            <span />
            <button aria-label="Rotate city" title="Rotate 45°" onClick={() => camera('rotate')}>
              <RotateCw size={17} />
            </button>
            <button aria-label="Reset view" title="Reset view" onClick={() => camera('reset')}>
              <Maximize2 size={17} />
            </button>
          </div>
          <div className="compass">
            <Compass size={35} strokeWidth={1} />
            <span>N</span>
          </div>
          <div className="scene-bottom">
            <div>
              <span className="status-dot" />
              {importProgress !== null
                ? 'Loading repository …'
                : pending
                  ? 'Generating …'
                  : 'Ready to explore'}
              <span className="bottom-divider" />
              <code>seed: {config.seed}</code>
            </div>
            <button
              onClick={() => setHelpOpen(!helpOpen)}
              aria-expanded={helpOpen}
              aria-controls="controls-help"
            >
              <HelpCircle size={15} />
              <span>Controls</span>
            </button>
          </div>
          {helpOpen && (
            <div className="help-card panel" id="controls-help">
              <div className="section-heading">
                <h2>Explore your city</h2>
                <button
                  className="icon-button"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close controls"
                >
                  <X size={15} />
                </button>
              </div>
              <p>
                <RotateCw size={15} />
                <span>
                  <strong>Rotate</strong> Drag with the left mouse button · one finger
                </span>
              </p>
              <p>
                <LocateFixed size={15} />
                <span>
                  <strong>Pan</strong> Drag with the right mouse button · two fingers
                </span>
              </p>
              <p>
                <Plus size={15} />
                <span>
                  <strong>Zoom</strong> Scroll wheel · pinch gesture
                </span>
              </p>
              <p>
                <Map size={15} />
                <span>
                  <strong>Explore</strong> Click a building or choose a module on the left
                </span>
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
