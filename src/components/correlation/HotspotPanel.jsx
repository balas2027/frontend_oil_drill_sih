import { Flame, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EVENT_TYPE_COLORS, formatEventType } from '../map/eventStyles';
import { formationCss } from '../map/formationStyles';
import { EVENT_CODES, fmtDepth } from './correlationUtils';

function TypeChips({ types }) {
  return (
    <span className="flex flex-wrap gap-1">
      {Object.entries(types).map(([et, n]) => (
        <span
          key={et}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] capitalize"
          style={{ borderColor: EVENT_TYPE_COLORS[et], color: '#0F172A' }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
            style={{ background: EVENT_TYPE_COLORS[et] }}
            aria-hidden="true"
          >
            {EVENT_CODES[et]}
          </span>
          {formatEventType(et)} ×{n}
        </span>
      ))}
    </span>
  );
}

/** Hotspot list (Section 10.5): depth intervals where several wells had events. */
export default function HotspotPanel({ data, selectedId, onSelect, onSelectEvent }) {
  const { t } = useTranslation();
  const { hotspots, min_wells: minWells, bin_m: binM, wells } = data;
  return (
    <section className="bg-white rounded-xl border border-line shadow-sm overflow-hidden">
      <header className="px-3 py-2 border-b border-line bg-royal-50">
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1">
          <Flame className="w-3.5 h-3.5" aria-hidden="true" />{' '}
          {t('corr.hot.title', { n: hotspots.length })}
        </h3>
        <p className="text-[10px] text-ink-600 mt-0.5">
          {t('corr.hot.sub', { bin: binM, min: minWells, total: wells.length })}
        </p>
      </header>
      {hotspots.length === 0 ? (
        <p className="p-3 text-xs text-ink-600">
          {t('corr.hot.none')}
        </p>
      ) : (
        <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto">
          {hotspots.map((h) => {
            const sel = h.id === selectedId;
            return (
              <li key={h.id} className={sel ? 'bg-gold-100/50' : ''}>
                <button
                  type="button"
                  onClick={() => onSelect(sel ? null : h.id)}
                  aria-expanded={sel}
                  className="w-full text-left px-3 py-2 hover:bg-royal-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-royal-600"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-royal-900 tabular-nums">
                      {fmtDepth(h.depth_from)} – {fmtDepth(h.depth_to)}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-royal-100 text-royal-900">
                      {t('corr.hot.n_wells', { n: h.n_wells })}
                    </span>
                  </span>
                  {h.reference_formation && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-ink-600">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: formationCss(h.reference_formation) }}
                        aria-hidden="true"
                      />
                      {t('corr.hot.in_ref', { formation: h.reference_formation })}
                    </span>
                  )}
                  <span className="block mt-1">
                    <TypeChips types={h.types} />
                  </span>
                </button>
                {sel && (
                  <div className="px-3 pb-3 space-y-2 text-[11px]">
                    <p className="text-ink-900">{h.summary}.</p>
                    <div>
                      <h4 className="text-[10px] font-semibold text-ink-600 mb-0.5">
                        {t('corr.hot.depth_each')}
                      </h4>
                      <ul className="space-y-0.5 tabular-nums">
                        {h.wells.map((w) => (
                          <li key={w.well_id} className="flex justify-between">
                            <span>{w.well_id}</span>
                            <span>
                              {w.md_from}–{w.md_to} m MD
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {h.mitigations.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-semibold text-ink-600 mb-0.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3" aria-hidden="true" /> {t('corr.hot.done_before')}
                        </h4>
                        <ul className="list-disc pl-4">
                          {h.mitigations.map((m) => (
                            <li key={m.text}>
                              {m.text}
                              {m.count > 1 && <span className="text-ink-600"> (×{m.count})</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(h.volume_lost_bbl > 0 || h.npt_hours > 0) && (
                      <p className="text-ink-600 tabular-nums">
                        {h.volume_lost_bbl > 0 &&
                          `${t('explorer.events.lost', { bbl: h.volume_lost_bbl })} · `}
                        {h.npt_hours > 0 && `${h.npt_hours} h NPT`} ·{' '}
                        {t('corr.hot.max_sev', { v: h.max_severity })}
                      </p>
                    )}
                    <div>
                      <h4 className="text-[10px] font-semibold text-ink-600 mb-0.5">
                        {t('corr.hot.evidence', { n: h.event_count })}
                      </h4>
                      <ul className="space-y-1">
                        {h.events.map((e) => (
                          <li key={e._id}>
                            <button
                              type="button"
                              onClick={() => onSelectEvent(e)}
                              className="w-full text-left border border-line border-l-4 rounded px-2 py-1 hover:bg-royal-50"
                              style={{ borderLeftColor: EVENT_TYPE_COLORS[e.type] }}
                            >
                              <span className="capitalize font-medium text-royal-900">
                                {formatEventType(e.type)}
                              </span>{' '}
                              <span className="text-ink-600 tabular-nums">
                                · {e.well_id} · {e.depth_from_md}–{e.depth_to_md} m MD ·{' '}
                                {t('corr.hot.sev', { v: e.severity })}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
