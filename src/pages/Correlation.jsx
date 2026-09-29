import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Star,
  X,
  Plus,
  Wand2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ImageDown,
  Printer,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { useMapStore, MAX_CORRELATION_WELLS } from '../store/mapStore';
import { wellsApi, nearbyApi } from '../api/wells';
import { correlationApi } from '../api/correlation';
import { apiErrorMessage } from '../api/client';
import DepthTrackChart from '../components/correlation/DepthTrackChart';
import HotspotPanel from '../components/correlation/HotspotPanel';
import CorrelationEventCard from '../components/correlation/CorrelationEventCard';
import { exportChartPng } from '../components/correlation/exportChart';
import {
  ALIGN_OPTIONS,
  EVENT_CODES,
  RATIO_STOPS,
  TRACKS,
  fmtDepth,
  formationAtDepth,
  mdAtDepth,
  paramAtDepth,
  yForDepth,
} from '../components/correlation/correlationUtils';
import { EVENT_TYPE_COLORS, formatEventType } from '../components/map/eventStyles';

const FIT_HEIGHT = 640; // px the full depth range occupies at zoom 1
const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8];
const BIN_OPTIONS = [10, 25, 50];

function Readout({ data, cursor }) {
  if (cursor == null) {
    return (
      <p className="text-ink-600">
        Hover the chart to compare wells at one depth. Click an event marker or a shaded hotspot for
        details.
      </p>
    );
  }
  const bin = data.bins[Math.min(data.bins.length - 1, Math.floor(cursor / data.bin_m))];
  return (
    <div className="space-y-1.5">
      <p className="font-bold text-royal-900 tabular-nums">
        {fmtDepth(cursor)} {data.align === 'tvd' ? 'TVD' : ''}
        {bin?.wells_drilled > 0 && (
          <span className="font-normal text-ink-600">
            {' '}
            · {bin.wells_with_events}/{bin.wells_drilled} wells with events
          </span>
        )}
      </p>
      <ul className="space-y-1">
        {data.wells.map((w) => {
          const md = mdAtDepth(w.mapping, cursor);
          const p = paramAtDepth(w.params, cursor, data.bin_m);
          const evs = w.events.filter(
            (e) => e.from <= cursor && cursor <= Math.max(e.to, e.from + data.bin_m)
          );
          return (
            <li key={w.well_id} className="tabular-nums">
              <span className="font-semibold text-royal-900">{w.well_id}</span>{' '}
              {md == null ? (
                <span className="text-ink-600">below TD</span>
              ) : (
                <span className="text-ink-600">
                  {Math.round(md).toLocaleString('en-IN')} m MD ·{' '}
                  {formationAtDepth(w.tops, cursor, w.td_aligned) || '—'}
                  {p?.mw != null && ` · ${p.mw.toFixed(2)} sg`}
                  {p?.rop != null && ` · ${p.rop.toFixed(0)} m/h`}
                </span>
              )}
              {evs.map((e) => (
                <span
                  key={e._id}
                  className="block font-medium"
                  style={{ color: EVENT_TYPE_COLORS[e.type] }}
                >
                  ▲ <span className="capitalize">{formatEventType(e.type)}</span> ({e.depth_from_md}
                  –{e.depth_to_md} m MD)
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Correlation() {
  const correlationWellIds = useMapStore((s) => s.correlationWellIds);
  const toggleCorrelationWell = useMapStore((s) => s.toggleCorrelationWell);
  const setCorrelationWells = useMapStore((s) => s.setCorrelationWells);
  const activeWellId = useMapStore((s) => s.activeWellId);
  const radiusKm = useMapStore((s) => s.radiusKm);

  const [allWells, setAllWells] = useState([]);
  const [eventTypeOptions, setEventTypeOptions] = useState([]);
  const [reference, setReference] = useState(null);
  const [align, setAlign] = useState('formation');
  const [binM, setBinM] = useState(10);
  const [minWells, setMinWells] = useState(2);
  const [eventTypes, setEventTypes] = useState([]);
  const [show, setShow] = useState({ mw: true, rop: true, torque: false });
  const [zoomIdx, setZoomIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [cursor, setCursor] = useState(null);
  const scrollRef = useRef(null);
  const headerRef = useRef(null);
  const bodyRef = useRef(null);
  const requestSeq = useRef(0);

  const ids = correlationWellIds;
  const refId = ids.includes(reference)
    ? reference
    : ids.includes(activeWellId)
      ? activeWellId
      : ids[0];

  useEffect(() => {
    Promise.all([wellsApi.listWells({ limit: 100 }), wellsApi.getFilterOptions()])
      .then(([w, o]) => {
        setAllWells(w.data.wells);
        setEventTypeOptions(o.data.event_types || []);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load wells.')));
  }, []);

  const idKey = ids.join(',');
  const typesKey = eventTypes.join(',');
  useEffect(() => {
    if (ids.length < 2) {
      setData(null);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    correlationApi
      .get({ wellIds: ids, align, reference: refId, binM, minWells, eventTypes })
      .then((res) => {
        if (seq !== requestSeq.current) return;
        setData(res.data);
        setSelectedHotspotId((id) => (res.data.hotspots.some((h) => h.id === id) ? id : null));
      })
      .catch((err) => {
        if (seq === requestSeq.current) setError(apiErrorMessage(err, 'Correlation failed.'));
      })
      .finally(() => seq === requestSeq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, align, refId, binM, minWells, typesKey]);

  const fitPpm = data ? FIT_HEIGHT / Math.max(1, data.max_depth) : 0.15;
  const ppm = fitPpm * ZOOMS[zoomIdx];

  const selectHotspot = (id) => {
    setSelectedHotspotId(id);
    const h = data?.hotspots.find((x) => x.id === id);
    if (h && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: Math.max(0, yForDepth(h.depth_from, ppm) - 40),
        behavior: 'smooth',
      });
    }
  };

  const suggest = async () => {
    const base = refId || activeWellId || allWells.find((w) => w.status === 'drilling')?.well_id;
    if (!base) return;
    setSuggesting(true);
    setError(null);
    try {
      const res = await nearbyApi.getNearbyWells({
        well_id: base,
        radius_km: radiusKm,
        limit: MAX_CORRELATION_WELLS - 1,
      });
      const offsets = res.data.nearby_wells.map((r) => r.well.well_id);
      if (!offsets.length) setError(`No offset wells within ${radiusKm} km of ${base}.`);
      setCorrelationWells([base, ...offsets]);
      setReference(base);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not fetch nearby wells.'));
    } finally {
      setSuggesting(false);
    }
  };

  const exportPng = async () => {
    try {
      await exportChartPng(
        headerRef.current,
        bodyRef.current,
        `NWIS_correlation_${align}_${ids.join('_')}.png`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const wellName = useMemo(
    () => Object.fromEntries(allWells.map((w) => [w.well_id, w.name])),
    [allWells]
  );
  const addable = allWells.filter((w) => !ids.includes(w.well_id));
  const presentTypes = useMemo(
    () => [...new Set((data?.wells || []).flatMap((w) => w.events.map((e) => e.type)))],
    [data]
  );

  const btn =
    'inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-line bg-white text-[11px] font-medium text-royal-900 hover:bg-royal-100 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-royal-600';

  return (
    <div className="space-y-4">
      {/* Title + well set */}
      <div className="bg-white p-4 rounded-xl border border-line shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" aria-hidden="true" /> Phase 5 · Correlation agent
            </span>
            <h2 className="text-xl font-bold text-royal-900 font-serif">Depth Correlation</h2>
            <p className="text-xs text-ink-600 mt-0.5">
              Align up to {MAX_CORRELATION_WELLS} wells on formation tops and find the depth
              intervals where several of them had trouble.
            </p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-100 text-[#6B5310] border border-gold-500/40">
            Synthetic demo data
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {ids.map((id) => {
            const isRef = id === refId;
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-lg border text-[11px] ${
                  isRef ? 'bg-gold-100 border-gold-500' : 'bg-royal-50 border-line'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setReference(id)}
                  className="p-0.5 rounded hover:bg-white"
                  aria-label={
                    isRef ? `${id} is the reference well` : `Make ${id} the reference well`
                  }
                  aria-pressed={isRef}
                  title={isRef ? 'Reference well' : 'Make reference'}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${isRef ? 'fill-gold-500 text-gold-500' : 'text-ink-600'}`}
                  />
                </button>
                <span className="font-semibold text-royal-900">{id}</span>
                <span className="text-ink-600 hidden sm:inline">
                  {(wellName[id] || '').replace('Upper Assam ', '')}
                </span>
                <button
                  type="button"
                  onClick={() => toggleCorrelationWell(id)}
                  className="p-0.5 rounded hover:bg-white"
                  aria-label={`Remove ${id}`}
                >
                  <X className="w-3 h-3 text-ink-600" />
                </button>
              </span>
            );
          })}
          <label className="inline-flex items-center gap-1 text-[11px]">
            <Plus className="w-3.5 h-3.5 text-royal-700" aria-hidden="true" />
            <span className="sr-only">Add well</span>
            <select
              value=""
              disabled={ids.length >= MAX_CORRELATION_WELLS}
              onChange={(e) => e.target.value && toggleCorrelationWell(e.target.value)}
              className="text-[11px] border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none disabled:opacity-40"
            >
              <option value="">
                {ids.length >= MAX_CORRELATION_WELLS ? 'Maximum 5 wells' : 'Add well…'}
              </option>
              {addable.map((w) => (
                <option key={w.well_id} value={w.well_id}>
                  {w.well_id} · {w.name} ({w.status})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={suggest} disabled={suggesting} className={btn}>
            <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
            {suggesting ? 'Finding offsets…' : `Reference + nearest offsets (${radiusKm} km)`}
          </button>
          {ids.length > 0 && (
            <button type="button" onClick={() => setCorrelationWells([])} className={btn}>
              Clear
            </button>
          )}
        </div>

        {/* Alignment + display controls */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] print:hidden">
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Align by">
            <span className="text-ink-600">Align by</span>
            <div className="inline-flex rounded-md border border-line overflow-hidden">
              {ALIGN_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={align === o.key}
                  title={o.hint}
                  onClick={() => setAlign(o.key)}
                  className={`px-2.5 py-1.5 font-medium ${
                    align === o.key
                      ? 'bg-royal-700 text-white'
                      : 'bg-white text-royal-900 hover:bg-royal-100'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5">
            <span className="text-ink-600">Bin</span>
            <select
              value={binM}
              onChange={(e) => setBinM(Number(e.target.value))}
              className="border border-line rounded-md px-1.5 py-1 bg-white"
            >
              {BIN_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b} m
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-ink-600">Hotspot when ≥</span>
            <select
              value={minWells}
              onChange={(e) => setMinWells(Number(e.target.value))}
              className="border border-line rounded-md px-1.5 py-1 bg-white"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} wells
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Tracks</legend>
            <span className="text-ink-600">Tracks</span>
            {Object.entries(TRACKS).map(([k, t]) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={show[k]}
                  onChange={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
                  className="accent-royal-700"
                />
                {t.label}
              </label>
            ))}
          </fieldset>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              className={btn}
              onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
              disabled={zoomIdx === 0}
              aria-label="Zoom out depth"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="tabular-nums w-10 text-center text-ink-600">{ZOOMS[zoomIdx]}×</span>
            <button
              type="button"
              className={btn}
              onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}
              disabled={zoomIdx === ZOOMS.length - 1}
              aria-label="Zoom in depth"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => setZoomIdx(0)}
              aria-label="Fit depth"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btn} onClick={exportPng} disabled={!data}>
              <ImageDown className="w-3.5 h-3.5" aria-hidden="true" /> PNG
            </button>
            <button type="button" className={btn} onClick={() => window.print()} disabled={!data}>
              <Printer className="w-3.5 h-3.5" aria-hidden="true" /> Print / PDF
            </button>
          </div>
        </div>

        {eventTypeOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] print:hidden">
            <span className="text-ink-600">Event types</span>
            {eventTypeOptions.map((t) => {
              const on = eventTypes.length === 0 || eventTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setEventTypes((cur) => {
                      const base = cur.length ? cur : eventTypeOptions;
                      const next = base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
                      return next.length === eventTypeOptions.length ? [] : next;
                    })
                  }
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border capitalize ${
                    on ? 'bg-white text-ink-900' : 'bg-slate-50 text-ink-600/60 line-through'
                  }`}
                  style={{ borderColor: on ? EVENT_TYPE_COLORS[t] : '#D6DFEE' }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                    style={{ background: on ? EVENT_TYPE_COLORS[t] : '#94A3B8' }}
                    aria-hidden="true"
                  >
                    {EVENT_CODES[t]}
                  </span>
                  {formatEventType(t)}
                  {data && on && !presentTypes.includes(t) && (
                    <span className="text-ink-600/60 normal-case">(none)</span>
                  )}
                </button>
              );
            })}
            {eventTypes.length > 0 && (
              <button
                type="button"
                onClick={() => setEventTypes([])}
                className="text-royal-600 hover:underline"
              >
                All types
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p
          className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg"
          role="alert"
        >
          {error}
        </p>
      )}

      {ids.length < 2 ? (
        <div className="bg-white p-8 rounded-xl border border-line shadow-sm text-center text-sm text-ink-600 space-y-3">
          <TrendingUp className="w-10 h-10 mx-auto text-royal-700/30" aria-hidden="true" />
          <p>Select at least two wells to correlate.</p>
          <p className="text-xs">
            Add wells above, use <b>Reference + nearest offsets</b>, or queue them with{' '}
            <b>Add to correlation</b> in the map drawer.
          </p>
          <Link
            to="/map"
            className="inline-flex items-center gap-1 text-royal-600 hover:underline text-xs"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Open Map & Nearby Wells
          </Link>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 w-full bg-white rounded-xl border border-line shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-line flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-royal-900">
                {data?.axis_label || 'Loading…'}
                {loading && data && (
                  <span className="ml-2 text-ink-600 font-normal">Updating…</span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-ink-600">
                <span>Wells with events per bin:</span>
                {RATIO_STOPS.map((s) => (
                  <span key={s.label} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: s.color }}
                      aria-hidden="true"
                    />
                    {s.label} ≥{Math.round(s.min * 100)}%
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <span
                    className="w-3 h-2.5 rounded-sm bg-[#E8871E]/25 border border-dashed border-[#E8871E]"
                    aria-hidden="true"
                  />
                  Hotspot
                </span>
                <span>◇ MW reported at event</span>
              </span>
            </div>
            {data?.warnings?.length > 0 && (
              <ul className="px-3 py-1.5 bg-gold-100/60 border-b border-gold-500/30 text-[11px] text-[#6B5310] space-y-0.5">
                {data.warnings.map((w) => (
                  <li key={w} className="flex gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            <div
              ref={scrollRef}
              className="overflow-auto max-h-[calc(100vh-300px)] min-h-[420px] print:max-h-none print:overflow-visible"
            >
              {data ? (
                <DepthTrackChart
                  data={data}
                  show={show}
                  ppm={ppm}
                  headerRef={headerRef}
                  bodyRef={bodyRef}
                  selectedHotspotId={selectedHotspotId}
                  onSelectHotspot={selectHotspot}
                  selectedEventId={selectedEvent?._id}
                  onSelectEvent={setSelectedEvent}
                  cursor={cursor}
                  onCursor={setCursor}
                />
              ) : (
                <p className="p-6 text-sm text-royal-700 animate-pulse">Aligning wells…</p>
              )}
            </div>
          </div>

          {data && (
            <aside className="w-full xl:w-80 shrink-0 space-y-3">
              <section
                className="bg-royal-50 border border-royal-100 rounded-xl p-3 text-[11px] print:hidden"
                aria-live="polite"
              >
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
                  Readout
                </h3>
                <Readout data={data} cursor={cursor} />
              </section>
              {selectedEvent && (
                <CorrelationEventCard
                  event={selectedEvent}
                  align={data.align}
                  onClose={() => setSelectedEvent(null)}
                />
              )}
              <HotspotPanel
                data={data}
                selectedId={selectedHotspotId}
                onSelect={selectHotspot}
                onSelectEvent={setSelectedEvent}
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
