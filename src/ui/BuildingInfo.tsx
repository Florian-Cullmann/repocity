import { useEffect, useRef, useState } from 'react'
import { fetchGitHubFileLines } from '../data/githubRepository'
import { ArrowUpRight, Box, FileCode2, Layers3, Network, X } from 'lucide-react'
import type { District, RepositorySnapshot, SoftwareModule } from '../domain/repository'

export function BuildingInfo({
  module,
  district,
  repository,
  onClose,
}: {
  module: SoftwareModule
  district: District
  repository: RepositorySnapshot
  onClose: () => void
}) {
  const cache = useRef(new Map<string, number>())
  const key = `${repository.name}:${repository.revision?.commit}:${module.id}`
  const [measurement, setMeasurement] = useState<{
    key: string
    lines?: number
    error?: string
  } | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (repository.source !== 'github' || module.metrics.lines !== null) return
    const cached = cache.current.get(key)
    if (cached !== undefined) {
      setMeasurement({ key, lines: cached })
      return
    }
    const controller = new AbortController()
    setMeasurement({ key })
    // Skip a selection already cleaned up by StrictMode or a rapid file change.
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      fetchGitHubFileLines(repository, module, controller.signal)
        .then((lines) => {
          if (controller.signal.aborted) return
          cache.current.set(key, lines)
          setMeasurement({ key, lines })
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setMeasurement({
              key,
              error: error instanceof Error ? error.message : 'Die Messung ist fehlgeschlagen.',
            })
        })
    })
    return () => controller.abort()
  }, [key, repository, module, retry])
  const current = measurement?.key === key ? measurement : null
  const lines = module.metrics.lines ?? current?.lines
  return (
    <aside className="building-info panel" aria-label="Gebäudeinformationen" aria-live="polite">
      <div className="info-eyebrow">
        <span>
          <span className="status-dot" style={{ background: district.color }} /> MODUL ENTDECKT
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Gebäudeinformationen schließen"
        >
          <X size={17} />
        </button>
      </div>
      <div className="building-heading">
        <div
          className="module-icon"
          style={{ background: `${district.color}30`, color: district.color }}
        >
          <Box size={25} strokeWidth={1.5} />
        </div>
        <div>
          <h2>{module.name}</h2>
          <span>{district.name}</span>
        </div>
      </div>
      <code className="module-path">{module.path}</code>
      <p>{module.description}</p>
      <div className="module-metrics">
        <div>
          <FileCode2 size={15} />
          <strong className={lines === undefined ? 'unavailable-metric' : ''}>
            {lines !== undefined
              ? lines.toLocaleString('de-DE')
              : current?.error
                ? 'Nicht gemessen'
                : 'Wird gemessen …'}
          </strong>
          <span>Codezeilen</span>
        </div>
        <div>
          <Layers3 size={15} />
          <strong>{module.metrics.files}</strong>
          <span>Dateien</span>
        </div>
        <div>
          <Network size={15} />
          <strong className={module.metrics.dependencies === null ? 'unavailable-metric' : ''}>
            {module.metrics.dependencies ?? 'Nicht verfügbar'}
          </strong>
          <span>Abhängigkeiten</span>
        </div>
      </div>
      {repository.sizeMetric === 'bytes' && (
        <p className="measurement-note">
          Gebäudehöhe: {(module.metrics.bytes ?? 0).toLocaleString('de-DE')} Bytes.
          {lines !== undefined && ' Codezeilen: nichtleere Zeilen einschließlich Kommentaren.'}
        </p>
      )}
      {current?.error && (
        <p className="measurement-error" role="status">
          {current.error}{' '}
          <button onClick={() => setRetry((value) => value + 1)}>Erneut messen</button>
        </p>
      )}
      <div className="coverage-label">
        <span>Testabdeckung</span>
        <strong>
          {module.metrics.coverage === null ? 'Nicht verfügbar' : `${module.metrics.coverage} %`}
        </strong>
      </div>
      {module.metrics.coverage !== null && (
        <div className="coverage-track">
          <span style={{ width: `${module.metrics.coverage}%` }} />
        </div>
      )}
      <div className="info-footer">
        <span>
          <i /> {module.language}
        </span>
        {repository.source === 'github' && repository.url && repository.revision ? (
          <a
            href={`${repository.url}/blob/${repository.revision.commit}/${module.path.split('/').map(encodeURIComponent).join('/')}`}
            target="_blank"
            rel="noreferrer"
          >
            Auf GitHub ansehen <ArrowUpRight size={12} />
          </a>
        ) : (
          <span>{repository.source === 'mock' ? 'Mockdaten' : 'Lokale Quelldaten'}</span>
        )}
      </div>
    </aside>
  )
}
