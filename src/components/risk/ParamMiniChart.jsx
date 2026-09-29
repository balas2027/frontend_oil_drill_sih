import { PARAM_SERIES, sparkPoints } from './riskUtils';

const H = 40;

/** One sparkline per live parameter against depth (Section 10.6 live mini-charts). */
export default function ParamMiniCharts({ records, events = [] }) {
  if (!records?.length) {
    return (
      <p className="text-xs text-ink-600">
        No live parameters yet - they stream here while a well is drilling or being replayed.
      </p>
    );
  }
  const d0 = records[0].depth_md;
  const d1 = records[records.length - 1].depth_md;
  const x = (d) => (d1 === d0 ? 0 : ((d - d0) / (d1 - d0)) * 100);
  const bands = events.filter((e) => e.depth_to_md >= d0 && e.depth_from_md <= d1);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {PARAM_SERIES.map((s) => {
        const sp = sparkPoints(records, s.value, H);
        return (
          <figure key={s.key} className="bg-white border border-line rounded-lg p-2">
            <figcaption className="flex justify-between text-[10px]">
              <span className="font-semibold text-royal-900">{s.label}</span>
              <span className="tabular-nums text-ink-600">
                {sp.last == null ? '—' : sp.last.toFixed(s.key === 'flow_delta' ? 1 : 0)} {s.unit}
              </span>
            </figcaption>
            <svg
              viewBox={`0 0 100 ${H}`}
              preserveAspectRatio="none"
              className="w-full h-10 mt-1"
              role="img"
              aria-label={`${s.label} over the last ${Math.round(d1 - d0)} m`}
            >
              {bands.map((e) => (
                <rect
                  key={e._id}
                  x={x(Math.max(d0, e.depth_from_md))}
                  width={Math.max(
                    0.8,
                    x(Math.min(d1, e.depth_to_md)) - x(Math.max(d0, e.depth_from_md))
                  )}
                  y="0"
                  height={H}
                  fill="#C62D3B"
                  opacity="0.12"
                />
              ))}
              {s.key === 'flow_delta' && sp.min < 0 && sp.max > 0 && (
                <line
                  x1="0"
                  x2="100"
                  y1={H - 2 - ((0 - sp.min) / (sp.max - sp.min)) * (H - 4)}
                  y2={H - 2 - ((0 - sp.min) / (sp.max - sp.min)) * (H - 4)}
                  stroke="#94A3B8"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <polyline
                points={sp.points}
                fill="none"
                stroke={s.color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <p className="text-[9px] text-ink-600 tabular-nums flex justify-between">
              <span>{Math.round(d0).toLocaleString('en-IN')} m</span>
              <span>{Math.round(d1).toLocaleString('en-IN')} m</span>
            </p>
          </figure>
        );
      })}
    </div>
  );
}
