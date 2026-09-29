import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { wellsApi, eventsApi } from '../../api/wells';
import { apiErrorMessage } from '../../api/client';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';

const CHART_HEIGHT = 560;
const TARGET_POINTS = 700;

/** Depth tracks (depth increases downwards, as on a mud log). */
const TRACKS = [
  { keys: ['rop'], label: 'ROP', unit: 'm/h', colors: ['#1D4FB8'] },
  { keys: ['wob'], label: 'WOB', unit: 't', colors: ['#475569'] },
  { keys: ['torque'], label: 'Torque', unit: 'kN·m', colors: ['#7C3AED'] },
  { keys: ['spp'], label: 'SPP', unit: 'psi', colors: ['#0A2A66'] },
  {
    keys: ['flow_in', 'flow_out'],
    label: 'Flow in / out',
    unit: 'gpm',
    colors: ['#1E8E5A', '#E8871E'],
  },
  { keys: ['pit_volume'], label: 'Pit volume', unit: 'bbl', colors: ['#C62D3B'] },
  { keys: ['gas_units'], label: 'Gas', unit: 'units', colors: ['#C9A227'] },
];

function Track({ track, records, maxDepth, events, cursorDepth }) {
  const values = records.flatMap((r) => track.keys.map((k) => r[k]).filter((v) => v != null));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (v) => 4 + ((v - min) / span) * 92;
  const y = (d) => (d / maxDepth) * CHART_HEIGHT;

  return (
    <div className="flex-1 min-w-[88px]">
      <div className="text-[10px] font-semibold text-royal-900 text-center truncate">
        {track.label}
      </div>
      <div className="text-[9px] text-ink-600 text-center tabular-nums">
        {min.toFixed(0)}–{max.toFixed(0)} {track.unit}
      </div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full border border-line bg-white rounded-sm"
        style={{ height: CHART_HEIGHT }}
        aria-label={`${track.label} versus depth`}
        role="img"
      >
        {events.map((e) => (
          <rect
            key={e._id}
            x="0"
            width="100"
            y={y(e.depth_from_md)}
            height={Math.max(2, y(e.depth_to_md) - y(e.depth_from_md))}
            fill={EVENT_TYPE_COLORS[e.type] || '#94A3B8'}
            opacity="0.18"
          />
        ))}
        {track.keys.map((k, i) => (
          <polyline
            key={k}
            fill="none"
            stroke={track.colors[i]}
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
            points={records
              .filter((r) => r[k] != null)
              .map((r) => `${x(r[k])},${y(r.depth_md)}`)
              .join(' ')}
          />
        ))}
        {cursorDepth != null && (
          <line
            x1="0"
            x2="100"
            y1={y(cursorDepth)}
            y2={y(cursorDepth)}
            stroke="#0A2A66"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

export default function DrillingTab({ wellIds }) {
  const [wellId, setWellId] = useState(wellIds?.[0] || '');
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const tracksRef = useRef(null);

  useEffect(() => {
    if (!wellId && wellIds?.length) setWellId(wellIds[0]);
  }, [wellIds, wellId]);

  useEffect(() => {
    if (!wellId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Ask once for the size, then downsample to ~TARGET_POINTS records
        const probe = await wellsApi.getDrillingTs(wellId, { limit: 1 });
        const every = Math.max(1, Math.ceil(probe.data.total / TARGET_POINTS));
        const [ts, ev] = await Promise.all([
          wellsApi.getDrillingTs(wellId, { every, limit: 5000 }),
          eventsApi.listEvents({ well_id: wellId, limit: 100 }),
        ]);
        if (cancelled) return;
        setRecords(ts.data.records);
        setTotal(ts.data.total);
        setEvents(ev.data.events);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load drilling data.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wellId]);

  const maxDepth = useMemo(() => Math.max(1, ...records.map((r) => r.depth_md)), [records]);
  const cursorRecord = useMemo(() => {
    if (cursor == null || !records.length) return null;
    return records.reduce((best, r) =>
      Math.abs(r.depth_md - cursor) < Math.abs(best.depth_md - cursor) ? r : best
    );
  }, [cursor, records]);
  const cursorEvents =
    cursor == null
      ? []
      : events.filter((e) => e.depth_from_md <= cursor && cursor <= e.depth_to_md);

  const onMove = (e) => {
    const svg = tracksRef.current?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const rel = (e.clientY - rect.top) / rect.height;
    setCursor(rel >= 0 && rel <= 1 ? rel * maxDepth : null);
  };

  if (!wellIds?.length) {
    return (
      <div className="p-8 text-center text-xs text-ink-600">
        <Activity className="w-8 h-8 mx-auto text-ink-600/30 mb-2" aria-hidden="true" />
        No drilling time-series loaded. Run{' '}
        <code className="font-mono">python scripts/seed_drilling_ts.py</code> in the backend.
      </div>
    );
  }

  const ticks = Array.from({ length: 9 }, (_, i) => Math.round((maxDepth / 8) * i));

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs flex items-center gap-2">
          <span className="text-ink-600">Well</span>
          <select
            value={wellId}
            onChange={(e) => setWellId(e.target.value)}
            className="text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
          >
            {wellIds.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] text-ink-600 tabular-nums">
          {loading
            ? 'Loading…'
            : `${total.toLocaleString()} records · showing ${records.length} (downsampled) · ${events.length} events shaded`}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-100 text-[#6B5310] border border-gold-500/40">
          Synthetic demo data
        </span>
      </div>
      {error && (
        <p className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>
      )}

      {records.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div
              className="flex gap-1 min-w-[680px]"
              ref={tracksRef}
              onMouseMove={onMove}
              onMouseLeave={() => setCursor(null)}
            >
              <div className="w-12 shrink-0 relative" aria-hidden="true">
                <div className="text-[10px] font-semibold text-royal-900 text-center">MD</div>
                <div className="text-[9px] text-ink-600 text-center">m</div>
                <div className="relative" style={{ height: CHART_HEIGHT }}>
                  {ticks.map((t) => (
                    <span
                      key={t}
                      className="absolute right-1 text-[9px] text-ink-600 tabular-nums -translate-y-1/2"
                      style={{ top: `${(t / maxDepth) * 100}%` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {TRACKS.map((t) => (
                <Track
                  key={t.label}
                  track={t}
                  records={records}
                  maxDepth={maxDepth}
                  events={events}
                  cursorDepth={cursor}
                />
              ))}
            </div>
          </div>

          <aside className="w-56 shrink-0 text-xs space-y-3" aria-live="polite">
            <div className="bg-royal-50 border border-royal-100 rounded-lg p-2.5">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
                Readout
              </h4>
              {cursorRecord ? (
                <dl className="grid grid-cols-2 gap-y-0.5 tabular-nums">
                  <dt className="text-ink-600">Depth</dt>
                  <dd className="font-semibold text-royal-900">{cursorRecord.depth_md} m</dd>
                  <dt className="text-ink-600">Time</dt>
                  <dd>{cursorRecord.ts?.slice(0, 16).replace('T', ' ')}</dd>
                  {TRACKS.flatMap((t) => t.keys).map((k) => (
                    <div key={k} className="contents">
                      <dt className="text-ink-600">{k.replace(/_/g, ' ')}</dt>
                      <dd>{cursorRecord[k]}</dd>
                    </div>
                  ))}
                  <dt className="text-ink-600">MW in</dt>
                  <dd>{cursorRecord.mud_weight_in} sg</dd>
                </dl>
              ) : (
                <p className="text-ink-600">Hover the tracks to read values at a depth.</p>
              )}
              {cursorEvents.map((e) => (
                <p
                  key={e._id}
                  className="mt-1.5 font-medium capitalize"
                  style={{ color: EVENT_TYPE_COLORS[e.type] }}
                >
                  ▲ {formatEventType(e.type)} ({e.depth_from_md}–{e.depth_to_md} m)
                </p>
              ))}
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
                Event bands
              </h4>
              <ul className="space-y-0.5">
                {[...new Set(events.map((e) => e.type))].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 capitalize">
                    <span
                      className="w-3 h-2 rounded-sm"
                      style={{ background: EVENT_TYPE_COLORS[t], opacity: 0.5 }}
                      aria-hidden="true"
                    />
                    {formatEventType(t)}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-ink-600 mt-1.5">
                Flow track: green = in, orange = out.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
