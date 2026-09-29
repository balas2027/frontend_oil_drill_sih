import { useTranslation } from 'react-i18next';
import { projectToMap } from './dashboardUtils';

const SIZE = 240;

/**
 * Offset wells around the active well with the search radius (Section 10.2).
 * Plain SVG - no map tiles, so it renders offline on the rig too.
 */
export default function MiniMap({ map, onSelect }) {
  const { t } = useTranslation();
  if (!map) return null;
  const origin = map.active.coordinates;
  const extent = map.radius_km * 1.35;
  const r = (SIZE / 2 / extent) * map.radius_km;
  const pts = map.wells
    .map((w) => ({ ...w, ...projectToMap(w.coordinates, origin, SIZE, extent) }))
    .filter((w) => w.x >= 0 && w.x <= SIZE && w.y >= 0 && w.y <= SIZE)
    .sort((a, b) => a.in_range - b.in_range);

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[280px] mx-auto block bg-royal-50 rounded-lg border border-line"
        role="img"
        aria-label={`${map.wells.filter((w) => w.in_range).length} ${t('dashboard.map.legend_offset')} · ${t('dashboard.map.radius', { radius: map.radius_km })}`}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={`v${f}`} x1={SIZE * f} x2={SIZE * f} y1="0" y2={SIZE} stroke="#E6ECF7" />
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={`h${f}`} y1={SIZE * f} y2={SIZE * f} x1="0" x2={SIZE} stroke="#E6ECF7" />
        ))}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill="#3B6FD8"
          fillOpacity="0.08"
          stroke="#1D4FB8"
          strokeDasharray="4 3"
        />
        {pts.map((w) => (
          <g key={w.well_id} onClick={() => onSelect?.(w.well_id)} className="cursor-pointer">
            <circle
              cx={w.x}
              cy={w.y}
              r={w.in_range ? 3 + 4 * (w.similarity || 0) : 2.5}
              fill={w.in_range ? '#123C8F' : '#94A3B8'}
              fillOpacity={w.in_range ? 0.85 : 0.6}
              stroke="#fff"
              strokeWidth="1"
            />
            <title>{`${w.well_id} · ${w.km.toFixed(1)} km · ${w.status}${w.similarity != null ? ` · similarity ${w.similarity.toFixed(2)}` : ''}`}</title>
          </g>
        ))}
        <g transform={`translate(${SIZE / 2},${SIZE / 2})`}>
          <polygon
            points="0,-9 2.6,-2.8 9,-2.8 3.9,1.2 5.6,7.6 0,3.8 -5.6,7.6 -3.9,1.2 -9,-2.8 -2.6,-2.8"
            fill="#C9A227"
            stroke="#0A2A66"
            strokeWidth="1"
          />
          <title>{map.active.well_id}</title>
        </g>
        <text x="6" y={SIZE - 6} fontSize="9" fill="#475569">
          {t('dashboard.map.radius', { radius: map.radius_km })}
        </text>
        <text x={SIZE - 8} y="14" fontSize="10" fill="#475569" textAnchor="end" fontWeight="700">
          N↑
        </text>
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-3 text-[10px] text-ink-600">
        <span className="flex items-center gap-1">
          <span className="text-gold-500" aria-hidden="true">
            ★
          </span>{' '}
          {t('dashboard.map.legend_active')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-royal-700" aria-hidden="true" />
          {t('dashboard.map.legend_offset')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden="true" />
          {t('dashboard.map.legend_other')}
        </span>
      </figcaption>
    </figure>
  );
}
