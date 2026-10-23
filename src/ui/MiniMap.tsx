import type { CityLayout } from '../city/types'

export function MiniMap({
  city,
  selectedId,
  onSelect,
}: {
  city: CityLayout
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="minimap panel" aria-hidden="true">
      <div>
        <span>STADTPLAN</span>
        <span>N ↑</span>
      </div>
      <svg viewBox={`${-city.size / 2} ${-city.size / 2} ${city.size} ${city.size}`}>
        <rect
          x={-city.size / 2}
          y={-city.size / 2}
          width={city.size}
          height={city.size}
          fill="#d8ded2"
        />
        {city.blocks.map((block) => (
          <rect
            key={`${block.x}:${block.z}`}
            x={block.x - 7}
            y={block.z - 7}
            width={14}
            height={14}
            rx={0.8}
            fill={block.park ? '#adc28a' : '#eef0e6'}
          />
        ))}
        {city.buildings.map((b) => (
          <rect
            key={b.id}
            x={b.position[0] - b.width / 2}
            y={b.position[2] - b.depth / 2}
            width={b.width}
            height={b.depth}
            fill={b.id === selectedId ? '#285f45' : b.color}
            stroke={b.id === selectedId ? '#fff' : 'none'}
            strokeWidth={1}
            onClick={() => onSelect(b.id)}
            style={{ cursor: 'pointer' }}
          />
        ))}
        <circle cx={city.landmark.x} cy={city.landmark.z} r={2} fill="#d76c53" />
      </svg>
      <span className="minimap-caption">Ein kleiner Ort für große Ideen.</span>
    </div>
  )
}
