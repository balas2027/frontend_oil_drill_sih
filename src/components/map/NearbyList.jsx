import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Radar, AlertTriangle } from 'lucide-react';
import { EVENT_DENSITY_STOPS, formatStatusWord } from './eventStyles';

const densityStop = (n) => [...EVENT_DENSITY_STOPS].reverse().find((s) => n >= s.min);

function SimilarityBadge({ value }) {
  const { t } = useTranslation();
  const pct = Math.round(value * 100);
  const cls =
    value >= 0.6
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : value >= 0.4
        ? 'bg-gold-100 text-[#7A5F0F] border-gold-500/40'
        : 'bg-slate-50 text-ink-600 border-line';
  return (
    <span
      className={`text-xs font-bold px-1.5 py-0.5 rounded border tabular-nums ${cls}`}
      title={t('map.list.similarity')}
    >
      {pct}%
    </span>
  );
}

export default function NearbyList({
  results,
  loading,
  error,
  warnings,
  latencyMs,
  radiusKm,
  selectedWellId,
  hoveredWellId,
  onSelect,
  onHover,
}) {
  const { t } = useTranslation();
  const itemRefs = useRef({});

  // Map click -> scroll the matching list row into view
  useEffect(() => {
    itemRefs.current[selectedWellId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedWellId]);

  return (
    <div className="flex-1 overflow-y-auto" aria-busy={loading}>
      <div className="px-3 py-2 flex items-center justify-between sticky top-0 bg-white z-10 border-b border-line">
        <span className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
          {t('map.list.title', { n: results.length })}
        </span>
        <span className="text-[10px] tabular-nums" aria-live="polite">
          {loading ? (
            <span className="text-gold-500 animate-pulse">{t('map.list.updating')}</span>
          ) : latencyMs != null ? (
            <span className="text-ink-600">{t('map.list.updated', { ms: latencyMs })}</span>
          ) : null}
        </span>
      </div>

      {error && (
        <div className="m-3 p-2.5 text-[11px] bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {warnings.map((w) => (
        <div
          key={w}
          className="m-3 p-2.5 text-[11px] bg-gold-100 border border-gold-500/40 text-[#6B5310] rounded-md flex gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          <span>{w}</span>
        </div>
      ))}

      <ul>
        {results.map((r, idx) => {
          const id = r.well.well_id;
          const selected = selectedWellId === id;
          const hovered = hoveredWellId === id;
          const density = densityStop(r.total_events);
          return (
            <li key={id} ref={(el) => (itemRefs.current[id] = el)}>
              <button
                onClick={() => onSelect(id)}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(id)}
                onBlur={() => onHover(null)}
                aria-pressed={selected}
                className={`w-full text-left px-3 py-2.5 border-b border-line/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-royal-600 ${
                  selected
                    ? 'bg-royal-100'
                    : hovered
                      ? 'bg-royal-50'
                      : 'hover:bg-royal-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-ink-600 tabular-nums w-4">{idx + 1}.</span>
                      <MapPin className="w-3 h-3 text-royal-600 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold text-royal-900 truncate">
                        {r.well.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 ml-[22px] text-[10px] text-ink-600 tabular-nums">
                      <span>{r.distance_km} {t('units.km')}</span>
                      <span aria-hidden="true">•</span>
                      <span className="capitalize">{formatStatusWord(r.well.status)}</span>
                      <span aria-hidden="true">•</span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full ring-2"
                          style={{ '--tw-ring-color': density.color }}
                          aria-hidden="true"
                        />
                        {t('map.list.events', { n: r.total_events })}
                      </span>
                    </div>
                  </div>
                  <SimilarityBadge value={r.similarity} />
                </div>
                {r.why_similar.length > 0 && (
                  <div className="mt-1.5 ml-[22px] flex flex-wrap gap-1">
                    {r.why_similar.slice(0, 2).map((reason) => (
                      <span
                        key={reason}
                        className="text-[9px] bg-royal-50 text-royal-700 px-1.5 py-0.5 rounded border border-royal-100 truncate max-w-full"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!loading && !error && results.length === 0 && (
        <div className="p-6 text-center text-xs text-ink-600">
          <Radar className="w-8 h-8 mx-auto text-ink-600/30 mb-2" aria-hidden="true" />
          {t('map.list.empty', { km: radiusKm })}
          <p className="mt-1 text-[11px]">{t('map.list.empty_hint')}</p>
        </div>
      )}
    </div>
  );
}
