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
const format = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 })
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
  const totalLines = repository.modules.reduce((sum, module) => sum + module.metrics.lines, 0)
  const totalFiles = repository.modules.reduce((sum, module) => sum + module.metrics.files, 0)
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
      setError('Bitte einen Seed eingeben.')
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
    setImportProgress('Repository wird geladen …')
    try {
      const snapshot = await fetchGitHubRepository(name, {
        signal: controller.signal,
        onProgress: (loaded, total) => {
          if (activeImport.current === controller && !controller.signal.aborted)
            setImportProgress(`${loaded} von ${total} Quelldateien gelesen …`)
        },
      })
      if (activeImport.current === controller && !controller.signal.aborted)
        showRepository(snapshot, seed)
    } catch (error) {
      if (activeImport.current === controller && !controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Der Import ist fehlgeschlagen.')
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
        <a href="./" className="brand" aria-label="RepoCity Startseite">
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
        <div className="topbar-center">
          <span className="status-dot" /> CODE WIRD STADT
        </div>
        <div className="topbar-actions">
          <span className="prototype-badge">PROTOTYP 0.1</span>
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
          <Layers3 size={16} /> Stadt erkunden <ChevronDown size={15} />
        </button>
        <aside id="explorer-sidebar" className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="sidebar-intro">
            <div className="eyebrow">
              <span /> DEIN CODE. DEINE STADT.
            </div>
            <h1>
              Eine neue
              <br />
              Perspektive
              <br />
              auf <em>Code.</em>
            </h1>
            <p>
              Aus Modulen werden Gebäude.
              <br />
              Aus Zusammenhängen eine Stadt.
            </p>
          </div>
          <form className="generator" onSubmit={generate}>
            <label htmlFor="repository-source">Datenquelle</label>
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
              <option value="github">GitHub · öffentliches Repository</option>
              <option value="local">RepoCity · Startbeispiel</option>
              <option value="mock">Demo · fiktive Mockdaten</option>
            </select>
            <label htmlFor="repository">
              Repository{' '}
              <span className="tiny-badge">
                {sourceInput === 'github'
                  ? 'GITHUB'
                  : sourceInput === 'local'
                    ? 'BEISPIEL'
                    : 'DEMO'}
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
              <label htmlFor="seed">Stadt-Seed</label>
              <span>Gleicher Seed. Gleiche Stadt.</span>
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
                aria-label="Zufälligen Seed wählen"
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
                <label htmlFor="city-size">Stadtgröße</label>
                <select
                  id="city-size"
                  value={countInput}
                  onChange={(event) => setCountInput(Number(event.target.value))}
                >
                  <option value={96}>Kleinstadt · 96</option>
                  <option value={256}>Großstadt · 256</option>
                  <option value={768}>Metropole · 768</option>
                </select>
              </div>
            ) : sourceInput === 'local' ? (
              <p className="source-details">
                {localRepository.modules.length} Quelldateien · {localRepository.districts.length}{' '}
                Ordner. Jede Datei ein Gebäude, jeder Ordner ein Viertel.
              </p>
            ) : (
              <p className="source-details">
                GitHub-URL oder owner/repository eingeben. Jede Quelldatei wird ein Gebäude.
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
                ? 'Stadt entsteht …'
                : sourceInput === 'github'
                  ? 'Repository laden'
                  : 'Stadt generieren'}
              <ArrowRight size={16} />
            </button>
            {importProgress !== null && (
              <div className="import-progress">
                <p role="status" aria-live="polite">
                  {importProgress}
                </p>
                <button type="button" onClick={cancelImport}>
                  Import abbrechen
                </button>
              </div>
            )}
            <p className="source-note">
              <span className="status-dot" />
              {sourceInput === 'github'
                ? 'Direkt von GitHub. Ohne Anmeldung.'
                : sourceInput === 'local'
                  ? 'Lokal gemessen. Keine GitHub-Verbindung.'
                  : 'Lokale Mockdaten. Keine GitHub-Verbindung.'}
            </p>
            {repository.notice && <p className="import-notice">{repository.notice}</p>}
          </form>
          <section className="district-section" aria-label="Stadtviertel">
            <div className="section-heading">
              <h2>Stadtviertel</h2>
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
              Oder ein Modul direkt erkunden
            </label>
            <select
              id="module-select"
              className="module-select"
              value={visibleModules.some((m) => m.id === selectedId) ? (selectedId ?? '') : ''}
              onChange={(event) => selectModule(event.target.value || null)}
            >
              <option value="">Gebäude auswählen …</option>
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
              Für Neugier gebaut.
              <br />
              <strong>Mit einer anderen Sicht auf Software.</strong>
            </span>
          </div>
        </aside>

        <section className="city-stage" aria-label="Interaktive 3D-Stadt" aria-busy={pending}>
          <div className="scene-heading">
            <div className="eyebrow">
              <span className="status-dot" /> DEINE REPOSITORY-STADT
            </div>
            <div className="repo-title">
              <h2>{repository.name.split('/').at(-1)}</h2>
              <span>
                {repository.source === 'github'
                  ? repository.notice
                    ? 'GitHub · Auswahl'
                    : 'GitHub'
                  : repository.source === 'local'
                    ? 'Echte Daten'
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
                    ? 'Startbeispiel'
                    : 'Demo'}
              </span>
            </p>
          </div>
          <div className="city-stats panel">
            <div>
              <Box size={16} />
              <strong>{city.buildings.length}</strong>
              <span>Gebäude</span>
            </div>
            <div>
              <Layers3 size={16} />
              <strong>{format.format(totalFiles)}</strong>
              <span>Dateien</span>
            </div>
            <div>
              <ArrowDownUp size={16} />
              <strong>{format.format(totalLines)}</strong>
              <span>Codezeilen</span>
            </div>
          </div>
          <div className="canvas-wrap" data-testid="city-canvas" data-ready={ready}>
            <Suspense
              fallback={
                <div className="loading-city">
                  <span className="loading-mark">
                    <Layers3 size={28} />
                  </span>
                  Deine Stadt entsteht …
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
              {repository.districts.find((d) => d.id === focusDistrict)?.name} hervorgehoben
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
                <strong>Jedes Gebäude erzählt eine Geschichte.</strong>
                <span>Klicke auf ein Haus und entdecke sein Modul.</span>
              </div>
            </div>
          )}
          <MiniMap city={city} selectedId={selectedId} onSelect={selectModule} />
          <div className="view-tools panel" aria-label="Kamerasteuerung">
            <button aria-label="Vergrößern" title="Vergrößern" onClick={() => camera('in')}>
              <Plus size={18} />
            </button>
            <button aria-label="Verkleinern" title="Verkleinern" onClick={() => camera('out')}>
              <Minus size={18} />
            </button>
            <span />
            <button aria-label="Stadt drehen" title="45° drehen" onClick={() => camera('rotate')}>
              <RotateCw size={17} />
            </button>
            <button
              aria-label="Ansicht zurücksetzen"
              title="Ansicht zurücksetzen"
              onClick={() => camera('reset')}
            >
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
                ? 'Repository wird geladen …'
                : pending
                  ? 'Wird generiert …'
                  : 'Alles bereit zum Erkunden'}
              <span className="bottom-divider" />
              <code>seed: {config.seed}</code>
            </div>
            <button
              onClick={() => setHelpOpen(!helpOpen)}
              aria-expanded={helpOpen}
              aria-controls="controls-help"
            >
              <HelpCircle size={15} />
              <span>Steuerung</span>
            </button>
          </div>
          {helpOpen && (
            <div className="help-card panel" id="controls-help">
              <div className="section-heading">
                <h2>Deine Stadt erkunden</h2>
                <button
                  className="icon-button"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Steuerung schließen"
                >
                  <X size={15} />
                </button>
              </div>
              <p>
                <RotateCw size={15} />
                <span>
                  <strong>Drehen</strong> Linke Maustaste ziehen · ein Finger
                </span>
              </p>
              <p>
                <LocateFixed size={15} />
                <span>
                  <strong>Verschieben</strong> Rechte Maustaste ziehen · zwei Finger
                </span>
              </p>
              <p>
                <Plus size={15} />
                <span>
                  <strong>Zoomen</strong> Scrollrad · Pinch-Geste
                </span>
              </p>
              <p>
                <Map size={15} />
                <span>
                  <strong>Entdecken</strong> Gebäude anklicken oder Modul links wählen
                </span>
              </p>
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <span>
          <span className="status-dot" /> Eine Stadt voller Möglichkeiten.
        </span>
        <span>
          Gebäudehöhe = Codeumfang <span>·</span> Farbe = Stadtviertel <span>·</span>
          {repository.source === 'github'
            ? repository.notice
              ? 'GitHub · Auswahl'
              : 'GitHub-Quelldaten'
            : repository.source === 'local'
              ? 'Lokale Quelldaten'
              : '100 % Mockdaten'}
        </span>
        <span>
          MADE FOR EXPLORING <span>↗</span>
        </span>
      </footer>
    </div>
  )
}

export default App
