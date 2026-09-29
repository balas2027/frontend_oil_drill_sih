import { useState } from 'react';
import { formationCss } from '../map/formationStyles';
import { RISK_LEVELS, RISK_TYPES, binAt, fmtPct, levelFor, riskLabel } from './riskUtils';

const PX_PER_M = 1.6;
const AXIS_W = 46;
const FM_W = 14;
const COL_W = 30;
const HEAD_H = 22;

/**
 * Vertical look-ahead ribbon (Section 10.6): one column per risk type, one row
 * per 10 m bin, from just above the bit to the end of the look-ahead window.
 * Cells show the percentage once a bin reaches "Watch", so colour is never the
 * only cue.
 */
export default function RiskRibbon({ ribbon, depth, horizonM, selectedType, onSelectType }) {
  const [hover, setHover] = useState(null);
  if (!ribbon?.length) return null;
  const top = ribbon[0].from;
  const bottom = ribbon[ribbon.length - 1].to;
  const y = (d) => HEAD_H + (d - top) * PX_PER_M;
  const height = y(bottom) + 4;
  const width = AXIS_W + FM_W + COL_W * RISK_TYPES.length + 4;
  const ticks = [];
  for (let d = Math.ceil(top / 50) * 50; d <= bottom; d += 50) ticks.push(d);
  const fmStarts = ribbon.filter((b, i) => b.formation && b.formation !== ribbon[i - 1]?.formation);
  const hoverBin = hover == null ? null : binAt(ribbon, hover);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const d = top + ((e.clientY - rect.top) * (height / rect.height) - HEAD_H) / PX_PER_M;
    setHover(d >= top && d < bottom ? d : null);
  };

  return (
    <div className="space-y-2" style={{ width }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block select-none"
        role="img"
        aria-label={`Risk ribbon from ${Math.round(top)} to ${Math.round(bottom)} m MD`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Column headers (clickable) */}
        {RISK_TYPES.map((t, i) => {
          const x = AXIS_W + FM_W + i * COL_W;
          const active = t.key === selectedType;
          return (
            <g
              key={t.key}
              onClick={() => onSelectType?.(t.key)}
              className="cursor-pointer"
              role="button"
              aria-label={`Show ${t.label}`}
            >
              <rect
                x={x + 1}
                y={2}
                width={COL_W - 2}
                height={HEAD_H - 5}
                rx={3}
                fill={active ? '#123C8F' : '#E6EEFB'}
              />
              <text
                x={x + COL_W / 2}
                y={14}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={active ? '#fff' : '#0A2A66'}
              >
                {t.code}
              </text>
              <title>{t.label}</title>
            </g>
          );
        })}

        {/* Depth axis */}
        {ticks.map((d) => (
          <g key={d}>
            <line x1={AXIS_W - 4} x2={width} y1={y(d)} y2={y(d)} stroke="#E6ECF7" />
            <text
              x={AXIS_W - 6}
              y={y(d) + 3}
              textAnchor="end"
              fontSize="9"
              fill="#475569"
              className="tabular-nums"
            >
              {d.toLocaleString('en-IN')}
            </text>
          </g>
        ))}

        {/* Formation column */}
        {ribbon.map((b) => (
          <rect
            key={`fm${b.from}`}
            x={AXIS_W}
            y={y(b.from)}
            width={FM_W - 2}
            height={(b.to - b.from) * PX_PER_M}
            fill={formationCss(b.formation, 0.45)}
          />
        ))}
        {fmStarts.map((b) => (
          <text
            key={`fl${b.from}`}
            x={AXIS_W + 4}
            y={y(b.from) + 3}
            fontSize="8"
            fill="#0A2A66"
            writingMode="vertical-rl"
            fontWeight="600"
          >
            {b.formation}
          </text>
        ))}

        {/* Cells */}
        {ribbon.map((b) =>
          RISK_TYPES.map((t, i) => {
            const p = b.risks[t.key] ?? 0;
            const l = levelFor(p);
            const x = AXIS_W + FM_W + i * COL_W;
            const h = (b.to - b.from) * PX_PER_M;
            return (
              <g
                key={`${b.from}${t.key}`}
                onClick={() => onSelectType?.(t.key)}
                className="cursor-pointer"
              >
                <rect
                  x={x + 1}
                  y={y(b.from) + 0.5}
                  width={COL_W - 2}
                  height={h - 1}
                  fill={l.color}
                  opacity={0.12 + 0.88 * Math.min(1, p / 0.75)}
                />
                {b.drilled && (
                  <rect
                    x={x + 1}
                    y={y(b.from) + 0.5}
                    width={COL_W - 2}
                    height={h - 1}
                    fill="url(#drilled)"
                  />
                )}
                {p >= RISK_LEVELS[2].min && h >= 10 && (
                  <text
                    x={x + COL_W / 2}
                    y={y(b.from) + h / 2 + 3}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="700"
                    fill={p >= 0.5 ? '#fff' : '#0F172A'}
                    className="tabular-nums"
                  >
                    {Math.round(p * 100)}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* Look-ahead horizon bracket */}
        {depth != null && horizonM && (
          <g>
            <line
              x1={width - 2}
              x2={width - 2}
              y1={y(depth)}
              y2={y(Math.min(bottom, depth + horizonM))}
              stroke="#C9A227"
              strokeWidth="3"
            />
            <title>{`Look-ahead window: next ${horizonM} m`}</title>
          </g>
        )}

        {/* Bit marker */}
        {depth != null && depth >= top && (
          <g>
            <line
              x1={AXIS_W - 6}
              x2={width}
              y1={y(depth)}
              y2={y(depth)}
              stroke="#0A2A66"
              strokeWidth="2"
            />
            <polygon
              points={`${AXIS_W - 12},${y(depth) - 5} ${AXIS_W - 4},${y(depth)} ${AXIS_W - 12},${y(depth) + 5}`}
              fill="#C9A227"
              stroke="#0A2A66"
            />
          </g>
        )}

        {hover != null && (
          <line
            x1={AXIS_W}
            x2={width}
            y1={y(hover)}
            y2={y(hover)}
            stroke="#1D4FB8"
            strokeDasharray="3 2"
          />
        )}

        <defs>
          <pattern
            id="drilled"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#fff" opacity="0.35" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>
      </svg>

      <div
        className="text-[11px] min-h-[64px] bg-royal-50 border border-royal-100 rounded-lg p-2"
        aria-live="polite"
      >
        {hoverBin ? (
          <>
            <p className="font-semibold text-royal-900 tabular-nums">
              {hoverBin.from.toLocaleString('en-IN')}–{hoverBin.to.toLocaleString('en-IN')} m MD
              {hoverBin.formation && ` · ${hoverBin.formation}`}
              {hoverBin.drilled && <span className="font-normal text-ink-600"> · drilled</span>}
            </p>
            <p className="text-ink-600">
              {RISK_TYPES.filter((t) => (hoverBin.risks[t.key] ?? 0) >= 0.05)
                .sort((a, b) => hoverBin.risks[b.key] - hoverBin.risks[a.key])
                .map((t) => `${riskLabel(t.key)} ${fmtPct(hoverBin.risks[t.key])}`)
                .join(' · ') || 'All risks below 5 %'}
            </p>
            <p className="text-ink-600">{hoverBin.wells_drilled} offset wells drilled this bin</p>
          </>
        ) : (
          <p className="text-ink-600">
            Hover a row for the bin&apos;s probabilities. Click a column to open that risk. Gold bar
            = look-ahead window; hatched = already drilled.
          </p>
        )}
      </div>
    </div>
  );
}
