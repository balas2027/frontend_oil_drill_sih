import { useMemo } from 'react';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';
import { formationCss } from '../map/formationStyles';
import {
  EVENT_CODES,
  TRACKS,
  depthForY,
  yForDepth,
  depthTicks,
  formationBands,
  ratioStop,
  sharedTops,
  valueDomain,
} from './correlationUtils';

/*
 * Multi-well depth-track chart (Development Guide Section 10.5): one shared
 * depth axis, per well a formation column, an event lane and parameter tracks,
 * with formation tops joined across wells. Hand-drawn SVG using presentation
 * attributes only, so the same markup exports to PNG unchanged.
 */

const AXIS_W = 52;
const DENSITY_W = 46;
const LEAD_GAP = 16;
const GAP = 44;
const FM_W = 72;
const EV_W = 30;
const TRACK_W = 64;
const HEADER_H = 68;
const PAD_BOTTOM = 18;
const FONT = 'Noto Sans, Inter, Arial, sans-serif';

function layout(wells, show) {
  let x = AXIS_W + DENSITY_W + LEAD_GAP;
  const cols = wells.map((w) => {
    const col = { well: w, x0: x, fm: x, ev: x + FM_W, tracks: [] };
    let tx = x + FM_W + EV_W;
    for (const key of Object.keys(TRACKS)) {
      if (show[key]) {
        col.tracks.push({ key, x: tx });
        tx += TRACK_W;
      }
    }
    col.x1 = tx;
    x = tx + GAP;
    return col;
  });
  return { cols, width: (cols.length ? cols[cols.length - 1].x1 : x) + 20 };
}

const shortName = (w) => (w.name || w.well_id).replace('Upper Assam ', '');

function alignmentNote(w, isRef) {
  if (isRef) return 'Reference well';
  const a = w.alignment || {};
  if (a.method === 'formation') return `Aligned on ${a.shared_formations.length} tops`;
  if (a.method === 'md_fallback') return 'Own MD (no alignment)';
  if (a.method === 'tvd') return 'TVD from surveys';
  return 'Measured depth';
}

export default function DepthTrackChart({
  data,
  show,
  ppm,
  headerRef,
  bodyRef,
  selectedHotspotId,
  onSelectHotspot,
  selectedEventId,
  onSelectEvent,
  cursor,
  onCursor,
}) {
  const { cols, width } = useMemo(() => layout(data.wells, show), [data.wells, show]);
  const domains = useMemo(
    () => ({
      mw: valueDomain(data.wells, 'mw', 'mw_points'),
      rop: valueDomain(data.wells, 'rop'),
      torque: valueDomain(data.wells, 'torque'),
    }),
    [data.wells]
  );
  const maxDepth = data.max_depth || 1;
  const height = Math.round(yForDepth(maxDepth, ppm) + PAD_BOTTOM);
  const y = (d) => yForDepth(d, ppm);
  const ticks = depthTicks(maxDepth, Math.max(6, Math.round((maxDepth * ppm) / 70)));
  const refId = data.reference_well_id;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const d = depthForY(e.clientY - rect.top, ppm);
    onCursor(d >= 0 && d <= maxDepth ? d : null);
  };

  const trackX = (key, x, v) => {
    const dom = domains[key];
    return x + 3 + ((v - dom[0]) / (dom[1] - dom[0])) * (TRACK_W - 6);
  };

  return (
    <div>
      {/* Header: sticky while the body scrolls */}
      <svg
        ref={headerRef}
        width={width}
        height={HEADER_H}
        className="sticky top-0 z-10 block"
        fontFamily={FONT}
        role="presentation"
      >
        <rect width={width} height={HEADER_H} fill="#FFFFFF" />
        <text x={AXIS_W - 6} y={52} fontSize="9" fill="#475569" textAnchor="end">
          Depth
        </text>
        <text x={AXIS_W - 6} y={62} fontSize="9" fill="#475569" textAnchor="end">
          {data.align === 'tvd' ? 'm TVD' : 'm'}
        </text>
        <text x={AXIS_W + DENSITY_W / 2} y={52} fontSize="9" fill="#475569" textAnchor="middle">
          Wells w/
        </text>
        <text x={AXIS_W + DENSITY_W / 2} y={62} fontSize="9" fill="#475569" textAnchor="middle">
          events
        </text>
        {cols.map((c) => {
          const isRef = c.well.well_id === refId;
          return (
            <g key={c.well.well_id}>
              <rect
                x={c.x0}
                y={4}
                width={c.x1 - c.x0}
                height={32}
                rx={6}
                fill={isRef ? '#FBF3D6' : '#F4F7FE'}
                stroke={isRef ? '#C9A227' : '#D6DFEE'}
              />
              <text x={c.x0 + 6} y={17} fontSize="11" fontWeight="700" fill="#0A2A66">
                {isRef ? '★ ' : ''}
                {c.well.well_id} · {shortName(c.well)}
              </text>
              <text x={c.x0 + 6} y={30} fontSize="9" fill="#475569">
                TD {Math.round(c.well.total_depth_md || 0).toLocaleString('en-IN')} m MD ·{' '}
                {alignmentNote(c.well, isRef)}
              </text>
              <text x={c.fm + FM_W / 2} y={56} fontSize="9" fill="#475569" textAnchor="middle">
                Formation
              </text>
              <text x={c.ev + EV_W / 2} y={56} fontSize="9" fill="#475569" textAnchor="middle">
                Events
              </text>
              {c.tracks.map((t) => {
                const def = TRACKS[t.key];
                const dom = domains[t.key];
                return (
                  <g key={t.key}>
                    <text
                      x={t.x + TRACK_W / 2}
                      y={52}
                      fontSize="9"
                      fontWeight="600"
                      fill={def.color}
                      textAnchor="middle"
                    >
                      {def.label} ({def.unit})
                    </text>
                    <text
                      x={t.x + TRACK_W / 2}
                      y={63}
                      fontSize="8"
                      fill="#475569"
                      textAnchor="middle"
                    >
                      {dom
                        ? `${dom[0].toFixed(def.digits)}–${dom[1].toFixed(def.digits)}`
                        : 'no data'}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <line x1={0} x2={width} y1={HEADER_H - 0.5} y2={HEADER_H - 0.5} stroke="#D6DFEE" />
      </svg>

      <svg
        ref={bodyRef}
        width={width}
        height={height}
        className="block"
        fontFamily={FONT}
        onMouseMove={onMove}
        onMouseLeave={() => onCursor(null)}
        role="img"
        aria-label={`Depth correlation of ${data.wells.length} wells, ${data.axis_label}`}
      >
        <rect width={width} height={height} fill="#FFFFFF" />

        {/* Depth grid + axis */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke="#E6ECF7" />
            <text
              x={AXIS_W - 6}
              y={y(t) + 3}
              fontSize="9"
              fill="#475569"
              textAnchor="end"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {t.toLocaleString('en-IN')}
            </text>
          </g>
        ))}

        {/* Hotspot bands behind everything */}
        {data.hotspots.map((h) => {
          const sel = h.id === selectedHotspotId;
          return (
            <rect
              key={h.id}
              x={AXIS_W}
              width={width - AXIS_W}
              y={y(h.depth_from)}
              height={Math.max(2, y(h.depth_to) - y(h.depth_from))}
              fill="#E8871E"
              fillOpacity={sel ? 0.24 : 0.1}
              stroke={sel ? '#E8871E' : 'none'}
              strokeDasharray="4 3"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectHotspot(sel ? null : h.id)}
            >
              <title>{`Hotspot ${h.depth_from}–${h.depth_to} m: ${h.summary}`}</title>
            </rect>
          );
        })}

        {/* Share of wells with events per bin */}
        <rect
          x={AXIS_W + 2}
          y={y(0)}
          width={DENSITY_W - 4}
          height={y(maxDepth) - y(0)}
          fill="#F4F7FE"
        />
        {data.bins
          .filter((b) => b.wells_with_events > 0)
          .map((b) => (
            <rect
              key={b.i}
              x={AXIS_W + 2}
              y={y(b.from)}
              width={Math.max(2, (DENSITY_W - 4) * b.event_ratio)}
              height={Math.max(1, y(b.to) - y(b.from) - 0.3)}
              fill={ratioStop(b.event_ratio).color}
            >
              <title>{`${b.from}–${b.to} m: ${b.wells_with_events} of ${b.wells_drilled} wells had events`}</title>
            </rect>
          ))}

        {/* Formation-top correlation lines between neighbouring wells */}
        {cols
          .slice(0, -1)
          .map((c, i) =>
            sharedTops(c.well, cols[i + 1].well).map((s) => (
              <line
                key={`${c.well.well_id}-${s.formation}`}
                x1={c.x1}
                x2={cols[i + 1].x0}
                y1={y(s.left)}
                y2={y(s.right)}
                stroke={formationCss(s.formation)}
                strokeWidth="1.5"
              />
            ))
          )}

        {cols.map((c) => {
          const w = c.well;
          const td = w.td_aligned ?? maxDepth;
          const bands = formationBands(w.tops, w.td_aligned);
          return (
            <g key={w.well_id}>
              {/* Formation column */}
              {bands.map((b) => (
                <g key={b.formation}>
                  <rect
                    x={c.fm}
                    y={y(b.top)}
                    width={FM_W}
                    height={Math.max(0.5, y(b.base) - y(b.top))}
                    fill={formationCss(b.formation, 0.55)}
                    stroke="#FFFFFF"
                    strokeWidth="0.5"
                  >
                    <title>{`${b.formation}: top ${Math.round(b.md)} m MD`}</title>
                  </rect>
                  {y(b.base) - y(b.top) >= 12 && (
                    <text
                      x={c.fm + 4}
                      y={y(b.top) + 10}
                      fontSize="9"
                      fontWeight="600"
                      fill="#0F172A"
                    >
                      {b.formation}
                    </text>
                  )}
                  {/* top marker across this well's tracks */}
                  <line
                    x1={c.fm}
                    x2={c.x1}
                    y1={y(b.top)}
                    y2={y(b.top)}
                    stroke={formationCss(b.formation, 0.7)}
                    strokeDasharray="2 2"
                  />
                </g>
              ))}

              {/* Parameter tracks */}
              {c.tracks.map((t) => {
                const def = TRACKS[t.key];
                const dom = domains[t.key];
                const pts = (w.params || []).filter((p) => p.d != null && p[t.key] != null);
                const markers = t.key === 'mw' ? w.mw_points || [] : [];
                return (
                  <g key={t.key}>
                    <rect
                      x={t.x}
                      y={y(0)}
                      width={TRACK_W}
                      height={y(td) - y(0)}
                      fill="none"
                      stroke="#D6DFEE"
                    />
                    {dom && pts.length > 1 && (
                      <polyline
                        fill="none"
                        stroke={def.color}
                        strokeWidth="1.2"
                        points={pts
                          .map((p) => `${trackX(t.key, t.x, p[t.key])},${y(p.d)}`)
                          .join(' ')}
                      />
                    )}
                    {dom &&
                      markers.map((p, k) => {
                        const px = trackX(t.key, t.x, p.mw);
                        const py = y(p.d);
                        return (
                          <path
                            key={k}
                            d={`M${px},${py - 4}L${px + 4},${py}L${px},${py + 4}L${px - 4},${py}Z`}
                            fill="#FFFFFF"
                            stroke={def.color}
                            strokeWidth="1.2"
                          >
                            <title>{`MW ${p.mw} sg reported at ${p.md} m MD`}</title>
                          </path>
                        );
                      })}
                    {!pts.length && !markers.length && (
                      <text
                        x={t.x + TRACK_W / 2}
                        y={y(0) + 14}
                        fontSize="8"
                        fill="#94A3B8"
                        textAnchor="middle"
                      >
                        no log
                      </text>
                    )}
                  </g>
                );
              })}

              {/* TD */}
              <line x1={c.fm} x2={c.x1} y1={y(td)} y2={y(td)} stroke="#0F172A" strokeWidth="1.5" />
              <text x={c.x1 - 2} y={y(td) + 11} fontSize="8" fill="#0F172A" textAnchor="end">
                TD
              </text>

              {/* Event lane */}
              <line
                x1={c.ev + EV_W / 2}
                x2={c.ev + EV_W / 2}
                y1={y(0)}
                y2={y(td)}
                stroke="#D6DFEE"
              />
              {w.events.map((e) => {
                const color = EVENT_TYPE_COLORS[e.type] || '#94A3B8';
                const sel = e._id === selectedEventId;
                const cx = c.ev + EV_W / 2;
                const cy = y(e.from);
                return (
                  <g
                    key={e._id}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      onSelectEvent(sel ? null : { ...e, well_id: w.well_id, well_name: w.name })
                    }
                  >
                    <title>
                      {`${formatEventType(e.type)} · ${e.depth_from_md}–${e.depth_to_md} m MD · ${e.formation || ''} · severity ${e.severity}/5`}
                    </title>
                    <rect
                      x={cx - 3}
                      y={cy}
                      width={6}
                      height={Math.max(3, y(e.to) - y(e.from))}
                      fill={color}
                      opacity="0.8"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={sel ? 8.5 : 6.5}
                      fill={color}
                      stroke={sel ? '#0A2A66' : '#FFFFFF'}
                      strokeWidth={sel ? 2 : 1.2}
                    />
                    <text
                      x={cx}
                      y={cy + 3}
                      fontSize="8"
                      fontWeight="700"
                      fill="#FFFFFF"
                      textAnchor="middle"
                    >
                      {EVENT_CODES[e.type] || '?'}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {cursor != null && (
          <line
            x1={AXIS_W}
            x2={width}
            y1={y(cursor)}
            y2={y(cursor)}
            stroke="#0A2A66"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}
