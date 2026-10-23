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
          fill="#bac99d"
        />
        <polyline
          points={city.river.points.map(([x, z]) => `${x},${z}`).join(' ')}
          fill="none"
          stroke="#d9cfb6"
          strokeWidth={city.river.width + city.river.promenadeWidth * 2}
        />
        <polyline
          points={city.river.points.map(([x, z]) => `${x},${z}`).join(' ')}
          fill="none"
          stroke="#77b6bd"
          strokeWidth={city.river.width}
        />
        {city.blocks.map((block) => (
          <rect
            key={block.id}
            x={-block.width / 2}
            y={-block.depth / 2}
            width={block.width}
            height={block.depth}
            transform={`matrix(1 0 ${block.shear} 1 ${block.x} ${block.z})`}
            fill={block.kind === 'plaza' ? '#e4d9bd' : block.park ? '#adc28a' : '#eef0e6'}
          />
        ))}
        {city.roads.map((road, i) => (
          <line
            key={i}
            x1={road.from[0]}
            y1={road.from[1]}
            x2={road.to[0]}
            y2={road.to[1]}
            stroke="#83908b"
            strokeWidth={road.width}
          />
        ))}
        {city.buildings.map((b) => (
          <rect
            key={b.id}
            x={b.position[0] - b.width / 2}
            y={b.position[2] - b.depth / 2}
            width={b.width}
            height={b.depth}
            transform={`rotate(${(-b.rotation * 180) / Math.PI} ${b.position[0]} ${b.position[2]})`}
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
