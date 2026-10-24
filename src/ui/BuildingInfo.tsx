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
              error: error instanceof Error ? error.message : 'The measurement failed.',
            })
        })
    })
    return () => controller.abort()
  }, [key, repository, module, retry])
  const current = measurement?.key === key ? measurement : null
  const lines = module.metrics.lines ?? current?.lines
  return (
    <aside className="building-info panel" aria-label="Building information" aria-live="polite">
      <div className="info-eyebrow">
        <span>
          <span className="status-dot" style={{ background: district.color }} /> MODULE DISCOVERED
        </span>
        <button className="icon-button" onClick={onClose} aria-label="Close building information">
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
              ? lines.toLocaleString('en-US')
              : current?.error
                ? 'Not measured'
                : 'Measuring …'}
          </strong>
          <span>Lines of code</span>
        </div>
        <div>
          <Layers3 size={15} />
          <strong>{module.metrics.files}</strong>
          <span>Files</span>
        </div>
        <div>
          <Network size={15} />
          <strong className={module.metrics.dependencies === null ? 'unavailable-metric' : ''}>
            {module.metrics.dependencies ?? 'Not available'}
          </strong>
          <span>Dependencies</span>
        </div>
      </div>
      {repository.sizeMetric === 'bytes' && (
        <p className="measurement-note">
          Building height: {(module.metrics.bytes ?? 0).toLocaleString('en-US')} bytes.
          {lines !== undefined && ' Lines of code: non-empty lines, including comments.'}
        </p>
      )}
      {current?.error && (
        <p className="measurement-error" role="status">
          {current.error}{' '}
          <button onClick={() => setRetry((value) => value + 1)}>Measure again</button>
        </p>
      )}
      <div className="coverage-label">
        <span>Test coverage</span>
        <strong>
          {module.metrics.coverage === null ? 'Not available' : `${module.metrics.coverage} %`}
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
            View on GitHub <ArrowUpRight size={12} />
          </a>
        ) : (
          <span>{repository.source === 'mock' ? 'Sample data' : 'Local source data'}</span>
        )}
      </div>
    </aside>
  )
}
