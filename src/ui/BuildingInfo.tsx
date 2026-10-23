import { ArrowUpRight, Box, FileCode2, Layers3, Network, X } from 'lucide-react'
import type { District, SoftwareModule } from '../domain/repository'

export function BuildingInfo({
  module,
  district,
  onClose,
}: {
  module: SoftwareModule
  district: District
  onClose: () => void
}) {
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
          <strong>{module.metrics.lines.toLocaleString('de-DE')}</strong>
          <span>Codezeilen</span>
        </div>
        <div>
          <Layers3 size={15} />
          <strong>{module.metrics.files}</strong>
          <span>Dateien</span>
        </div>
        <div>
          <Network size={15} />
          <strong>{module.metrics.dependencies}</strong>
          <span>Abhängigkeiten</span>
        </div>
      </div>
      <div className="coverage-label">
        <span>Testabdeckung</span>
        <strong>{module.metrics.coverage} %</strong>
      </div>
      <div className="coverage-track">
        <span style={{ width: `${module.metrics.coverage}%` }} />
      </div>
      <div className="info-footer">
        <span>
          <i /> {module.language}
        </span>
        <span>
          Mockdaten <ArrowUpRight size={12} />
        </span>
      </div>
    </aside>
  )
}
