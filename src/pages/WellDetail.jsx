import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  Compass,
  Droplets,
  FileDown,
  FileText,
  Layers,
  ListOrdered,
  MapPin,
  Navigation,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { wellsApi } from '../api/wells';
import { documentsApi } from '../api/documents';
import { downloadBriefPdf } from '../api/risk';
import { apiErrorMessage } from '../api/client';
import { useMapStore } from '../store/mapStore';
import {
  EVENT_TYPE_COLORS,
  formatEventType,
  formatStatusWord,
} from '../components/map/eventStyles';
import { formationCss } from '../components/map/formationStyles';
import { DocStatusChip } from '../components/documents/DocBadges';
import {
  WELL_TABS,
  casingIntervals,
  eventsInInterval,
  extent,
  mudIntervals,
  mudWeightProfile,
  polyline,
  scale,
  trajectorySummary,
  withDisplacement,
} from '../components/well/wellDetailUtils';

const TAB_ICONS = {
  overview: Compass,
  tops: Layers,
  events: ListOrdered,
  casing: Shield,
  mud: Droplets,
  trajectory: Navigation,
  documents: FileText,
};

const card = 'bg-white rounded-xl border border-line shadow-sm';
const th = 'px-3 py-2 text-left';
const fmt = (v, d = 0) =>
  v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });
const day = (iso) => (iso ? String(iso).slice(0, 10) : '—');

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-600">{label}</dt>
      <dd className="text-sm font-semibold text-royal-900 tabular-nums">{value ?? '—'}</dd>
    </div>
  );
}

function Empty({ children }) {
  return <p className="p-6 text-center text-xs text-ink-600">{children}</p>;
}

function SourceLink({ event }) {
  const { t } = useTranslation();
  if (!event.source?.doc_id)
    return <span className="text-[10px] text-ink-600">{t('explorer.events.no_source')}</span>;
  return (
    <Link
      to={`/documents/${event.source.doc_id}?page=${event.source.page || 1}${
        event.source.bbox ? `&bbox=${event.source.bbox.join(',')}` : ''
      }`}
      className="inline-flex items-center gap-1 text-[11px] text-royal-600 hover:underline"
    >
      <FileText className="w-3 h-3" aria-hidden="true" />
      {t('explorer.events.view_source', { page: event.source.page || 1 })}
    </Link>
  );
}

/* ------------------------------------------------------------------ Overview */
function OverviewTab({ well, tops, events }) {
  const { t } = useTranslation();
  const s = well.summary || {};
  const byType = Object.entries(s.event_counts || {}).sort((a, b) => b[1] - a[1]);
  const npt = events.reduce((acc, e) => acc + (e.impact?.npt_hours || 0), 0);
  const worst = [...events].sort((a, b) => (b.severity || 0) - (a.severity || 0)).slice(0, 3);
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className={`${card} p-4 lg:col-span-2`}>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Fact
            label={t('explorer.wells.basin_block')}
            value={`${well.basin || '—'} / ${well.block || '—'}`}
          />
          <Fact label={t('explorer.cols.status')} value={formatStatusWord(well.status)} />
          <Fact label={t('map.drawer.trajectory')} value={formatStatusWord(well.trajectory_type)} />
          <Fact label={t('map.drawer.mud_system')} value={well.mud_system} />
          <Fact label={t('explorer.wells.target')} value={well.formation_target} />
          <Fact
            label={t('explorer.wells.spud_td')}
            value={`${day(well.spud_date)} → ${day(well.td_date)}`}
          />
          <Fact
            label={t('explorer.wells.td_md_tvd')}
            value={`${fmt(well.total_depth_md)} / ${fmt(well.total_depth_tvd)} m`}
          />
          <Fact
            label={t('well.elevation')}
            value={well.kb_elevation_m != null ? `${fmt(well.kb_elevation_m, 1)} m KB` : '—'}
          />
          <Fact label={t('well.tops')} value={s.formation_tops} />
          <Fact label={t('well.stations')} value={s.survey_stations} />
          <Fact label={t('explorer.wells.drilling_records')} value={fmt(s.drilling_ts_records)} />
          <Fact label={t('well.npt_total')} value={`${fmt(npt, 1)} h`} />
        </dl>
        {tops.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
              {t('well.column')}
            </h3>
            <div className="flex h-6 rounded overflow-hidden border border-line" aria-hidden="true">
              {tops.map((tp) => (
                <div
                  key={tp._id || tp.formation}
                  title={`${tp.formation} ${fmt(tp.top_md)}–${fmt(tp.base_md)} m`}
                  style={{
                    flex: Math.max(1, (tp.base_md ?? well.total_depth_md) - tp.top_md),
                    background: formationCss(tp.formation, 0.8),
                  }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] text-ink-600">
              {tops.map((tp) => (
                <span key={tp._id || tp.formation} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ background: formationCss(tp.formation) }}
                    aria-hidden="true"
                  />
                  {tp.formation}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className={`${card} p-4 space-y-3`}>
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
          {t('explorer.wells.events_by_type')}
        </h3>
        {byType.length ? (
          <ul className="space-y-1 text-xs">
            {byType.map(([type, n]) => (
              <li key={type} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: EVENT_TYPE_COLORS[type] }}
                    aria-hidden="true"
                  />
                  {formatEventType(type)}
                </span>
                <b className="tabular-nums text-royal-900">{n}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-600">{t('well.no_events')}</p>
        )}
        {worst.length > 0 && (
          <>
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 pt-2 border-t border-line">
              {t('well.most_severe')}
            </h3>
            <ul className="space-y-1.5 text-xs">
              {worst.map((e) => (
                <li key={e._id}>
                  <span className="font-semibold text-royal-900">{formatEventType(e.type)}</span>{' '}
                  <span className="text-ink-600 tabular-nums">
                    · {fmt(e.depth_from_md)}–{fmt(e.depth_to_md)} m · {e.formation} ·{' '}
                    {t('severity.short', { value: e.severity })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Formation tops */
function TopsTab({ well, tops, events }) {
  const { t } = useTranslation();
  if (!tops.length) return <Empty>{t('well.no_tops')}</Empty>;
  const td = well.total_depth_md || tops[tops.length - 1].base_md || 1;
  const H = 420;
  const y = (d) => (d / td) * H;
  return (
    <div className={`${card} p-4 grid md:grid-cols-[120px,1fr] gap-4`}>
      <svg
        viewBox={`0 0 120 ${H + 10}`}
        className="w-[120px] h-auto"
        role="img"
        aria-label={t('well.column')}
      >
        {tops.map((tp) => {
          const base = tp.base_md ?? td;
          const n = eventsInInterval(events, tp.top_md, base).length;
          return (
            <g key={tp._id || tp.formation}>
              <rect
                x="0"
                y={y(tp.top_md)}
                width="70"
                height={Math.max(1, y(base) - y(tp.top_md))}
                fill={formationCss(tp.formation, 0.85)}
                stroke="#fff"
              />
              {y(base) - y(tp.top_md) > 12 && (
                <text x="74" y={y(tp.top_md) + 11} fontSize="9" fill="#0F172A">
                  {tp.formation}
                  {n ? ` (${n})` : ''}
                </text>
              )}
            </g>
          );
        })}
        {events.map((e) => (
          <circle
            key={e._id}
            cx="62"
            cy={y(e.depth_from_md)}
            r="3"
            fill={EVENT_TYPE_COLORS[e.type]}
            stroke="#fff"
          >
            <title>{`${formatEventType(e.type)} ${e.depth_from_md} m`}</title>
          </circle>
        ))}
      </svg>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-royal-50 text-royal-700 uppercase text-[10px] tracking-wider">
              <th className={th}>{t('docs.fields.formation')}</th>
              <th className={th}>{t('well.top_md')}</th>
              <th className={th}>{t('well.top_tvd')}</th>
              <th className={th}>{t('well.base_md')}</th>
              <th className={th}>{t('well.thickness')}</th>
              <th className={th}>{t('docs.fields.lithology')}</th>
              <th className={th}>{t('explorer.tabs.events')}</th>
            </tr>
          </thead>
          <tbody>
            {tops.map((tp) => {
              const base = tp.base_md ?? td;
              return (
                <tr key={tp._id || tp.formation} className="border-b border-line/60">
                  <td className="px-3 py-1.5 font-semibold text-royal-900">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                      style={{ background: formationCss(tp.formation) }}
                      aria-hidden="true"
                    />
                    {tp.formation}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(tp.top_md)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(tp.top_tvd)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(tp.base_md)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(base - tp.top_md)}</td>
                  <td className="px-3 py-1.5">{tp.lithology || '—'}</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {eventsInInterval(events, tp.top_md, base).length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Events timeline */
function EventsTab({ events }) {
  const { t } = useTranslation();
  const [type, setType] = useState('');
  const [order, setOrder] = useState('depth');
  const types = [...new Set(events.map((e) => e.type))];
  const rows = useMemo(() => {
    const list = events.filter((e) => !type || e.type === type);
    return order === 'date'
      ? [...list].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      : [...list].sort((a, b) => a.depth_from_md - b.depth_from_md);
  }, [events, type, order]);
  if (!events.length) return <Empty>{t('well.no_events')}</Empty>;
  return (
    <div className={`${card} p-4 space-y-3`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label={t('kn.search.event_type')}
          className="border border-line rounded-md px-2 py-1 bg-white"
        >
          <option value="">{t('kn.search.any_event_type')}</option>
          {types.map((x) => (
            <option key={x} value={x}>
              {formatEventType(x)}
            </option>
          ))}
        </select>
        <div
          className="inline-flex rounded-md border border-line overflow-hidden"
          role="radiogroup"
        >
          {['depth', 'date'].map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={order === o}
              onClick={() => setOrder(o)}
              className={`px-2 py-1 ${order === o ? 'bg-royal-700 text-white' : 'bg-white text-royal-900 hover:bg-royal-100'}`}
            >
              {t(`well.order_${o}`)}
            </button>
          ))}
        </div>
        <span className="ml-auto text-ink-600">{t('well.n_events', { n: rows.length })}</span>
      </div>
      <ol className="relative border-l-2 border-royal-100 ml-2 space-y-3">
        {rows.map((e) => (
          <li key={e._id} className="pl-4 relative">
            <span
              className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white"
              style={{ background: EVENT_TYPE_COLORS[e.type] }}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <b className="text-royal-900">{formatEventType(e.type)}</b>
              <span className="tabular-nums text-ink-600">
                {fmt(e.depth_from_md)}–{fmt(e.depth_to_md)} m MD · {e.formation || '—'} ·{' '}
                {day(e.date)}
              </span>
              <span className="text-[10px] px-1 rounded bg-royal-50 text-royal-900">
                {t('severity.short', { value: e.severity })}
              </span>
              {e.extraction?.status && (
                <span className="text-[10px] text-ink-600">
                  {t(`explorer.review_status.${e.extraction.status}`, {
                    defaultValue: e.extraction.status,
                  })}
                </span>
              )}
            </div>
            {e.description && <p className="text-[11px] text-ink-900 mt-0.5">{e.description}</p>}
            <p className="text-[11px] text-ink-600 mt-0.5">
              {e.mitigation && (
                <>
                  {t('docs.fields.mitigation')}: <b className="text-royal-900">{e.mitigation}</b>
                </>
              )}
              {e.outcome && ` → ${e.outcome}`}
              {e.impact?.npt_hours != null && ` · NPT ${e.impact.npt_hours} h`}
              {e.impact?.volume_lost_bbl != null &&
                ` · ${t('explorer.events.lost', { bbl: e.impact.volume_lost_bbl })}`}
            </p>
            <SourceLink event={e} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ Casing & cementing */
function CasingTab({ well, casing, events }) {
  const { t } = useTranslation();
  const strings = casingIntervals(casing);
  const cementing = events.filter((e) => e.type === 'cementing_issue');
  if (!strings.length) return <Empty>{t('well.no_casing')}</Empty>;
  const td = well.total_depth_md || strings[strings.length - 1].shoe_md || 1;
  const H = 360;
  const y = (d) => (d / td) * H;
  const maxSize = Math.max(...strings.map((c) => c.size_in || 1));
  return (
    <div className="grid lg:grid-cols-[180px,1fr] gap-4">
      <section className={`${card} p-3`}>
        <svg
          viewBox={`0 0 160 ${H + 20}`}
          className="w-full h-auto"
          role="img"
          aria-label={t('well.schematic')}
        >
          <rect x="78" y="0" width="4" height={y(td)} fill="#CBD5E1" />
          {strings.map((c, i) => {
            const half = 12 + ((c.size_in || 1) / maxSize) * 58;
            return (
              <g key={`${c.size_in}-${c.shoe_md}`}>
                <line
                  x1={80 - half}
                  x2={80 - half}
                  y1="0"
                  y2={y(c.shoe_md)}
                  stroke="#123C8F"
                  strokeWidth="2.5"
                />
                <line
                  x1={80 + half}
                  x2={80 + half}
                  y1="0"
                  y2={y(c.shoe_md)}
                  stroke="#123C8F"
                  strokeWidth="2.5"
                />
                <polygon
                  points={`${80 - half},${y(c.shoe_md)} ${80 - half - 6},${y(c.shoe_md)} ${80 - half},${y(c.shoe_md) - 8}`}
                  fill="#123C8F"
                />
                <polygon
                  points={`${80 + half},${y(c.shoe_md)} ${80 + half + 6},${y(c.shoe_md)} ${80 + half},${y(c.shoe_md) - 8}`}
                  fill="#123C8F"
                />
                <text
                  x={80 + half + 8}
                  y={Math.max(10, y(c.shoe_md) - 2)}
                  fontSize="8"
                  fill="#0F172A"
                >
                  {`${c.size_in}″`}
                </text>
                {i === strings.length - 1 && (
                  <text x="80" y={H + 14} fontSize="8" textAnchor="middle" fill="#475569">
                    {`TD ${fmt(td)} m`}
                  </text>
                )}
              </g>
            );
          })}
          {cementing.map((e) => (
            <circle
              key={e._id}
              cx="80"
              cy={y(e.depth_from_md)}
              r="4"
              fill={EVENT_TYPE_COLORS.cementing_issue}
            >
              <title>{`${formatEventType(e.type)} ${e.depth_from_md} m`}</title>
            </circle>
          ))}
        </svg>
      </section>
      <section className={`${card} p-4 space-y-3 overflow-x-auto`}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-royal-50 text-royal-700 uppercase text-[10px] tracking-wider">
              <th className={th}>{t('well.size')}</th>
              <th className={th}>{t('well.grade')}</th>
              <th className={th}>{t('well.shoe_md')}</th>
              <th className={th}>{t('well.shoe_tvd')}</th>
              <th className={th}>{t('well.hole_interval')}</th>
              <th className={th}>{t('well.interval_events')}</th>
            </tr>
          </thead>
          <tbody>
            {strings.map((c) => {
              const evs = eventsInInterval(events, c.from_md, c.shoe_md);
              return (
                <tr key={`${c.size_in}-${c.shoe_md}`} className="border-b border-line/60 align-top">
                  <td className="px-3 py-1.5 font-semibold text-royal-900">{c.size_in}″</td>
                  <td className="px-3 py-1.5">{c.grade || '—'}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(c.shoe_md)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(c.shoe_tvd)}</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {fmt(c.from_md)}–{fmt(c.shoe_md)} m
                  </td>
                  <td className="px-3 py-1.5">
                    {evs.length
                      ? Object.entries(
                          evs.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {})
                        )
                          .map(([k, n]) => `${formatEventType(k)} ×${n}`)
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div>
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            {t('well.cementing')}
          </h3>
          {cementing.length ? (
            <ul className="space-y-1.5 text-xs">
              {cementing.map((e) => (
                <li key={e._id}>
                  <b className="text-royal-900 tabular-nums">
                    {fmt(e.depth_from_md)}–{fmt(e.depth_to_md)} m
                  </b>{' '}
                  · {e.description || e.formation} {e.mitigation && `· ${e.mitigation}`}{' '}
                  <SourceLink event={e} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-600">{t('well.no_cementing')}</p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Mud programme */
function MudTab({ well, events, records, loading }) {
  const { t } = useTranslation();
  const profile = useMemo(() => mudWeightProfile(records), [records]);
  const intervals = useMemo(() => mudIntervals(profile), [profile]);
  const eventMw = events
    .filter((e) => e.drilling_context?.mud_weight != null)
    .map((e) => ({ depth: e.depth_from_md, mw: e.drilling_context.mud_weight, e }));
  const all = [...profile, ...eventMw];
  const W = 520;
  const H = 360;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const dDom = [0, well.total_depth_md || extent(all, 'depth')?.[1] || 1];
  const mDom = extent(all, 'mw') || [1, 2];
  const x = scale(mDom, [pad.l, W - pad.r]);
  const y = scale(dDom, [pad.t, H - pad.b]);
  const ticks = 5;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr),320px] gap-4">
      <section className={`${card} p-4`}>
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
          {t('well.mw_vs_depth')}
        </h3>
        {loading ? (
          <p className="text-xs text-ink-600 animate-pulse">{t('common.loading')}</p>
        ) : !all.length ? (
          <Empty>{t('well.no_mud')}</Empty>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label={t('well.mw_vs_depth')}
          >
            {Array.from(
              { length: ticks + 1 },
              (_, i) => dDom[0] + ((dDom[1] - dDom[0]) * i) / ticks
            ).map((d) => (
              <g key={d}>
                <line x1={pad.l} x2={W - pad.r} y1={y(d)} y2={y(d)} stroke="#E2E8F0" />
                <text x={pad.l - 4} y={y(d) + 3} fontSize="9" textAnchor="end" fill="#475569">
                  {fmt(d)}
                </text>
              </g>
            ))}
            {Array.from({ length: 5 }, (_, i) => mDom[0] + ((mDom[1] - mDom[0]) * i) / 4).map(
              (m) => (
                <text key={m} x={x(m)} y={H - 8} fontSize="9" textAnchor="middle" fill="#475569">
                  {m.toFixed(2)}
                </text>
              )
            )}
            <polyline
              points={polyline(profile, x, y, 'mw', 'depth')}
              fill="none"
              stroke="#0A2A66"
              strokeWidth="1.5"
            />
            {eventMw.map(({ depth, mw, e }) => (
              <rect
                key={e._id}
                x={x(mw) - 4}
                y={y(depth) - 4}
                width="8"
                height="8"
                transform={`rotate(45 ${x(mw)} ${y(depth)})`}
                fill={EVENT_TYPE_COLORS[e.type]}
                stroke="#fff"
              >
                <title>{`${formatEventType(e.type)} · ${depth} m · ${mw} sg`}</title>
              </rect>
            ))}
            <text x={W / 2} y={H} fontSize="9" textAnchor="middle" fill="#475569">
              {t('well.mw_axis')}
            </text>
          </svg>
        )}
        <p className="text-[10px] text-ink-600 mt-1">{t('well.mw_legend')}</p>
      </section>
      <section className={`${card} p-4 space-y-2 text-xs`}>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label={t('map.drawer.mud_system')} value={well.mud_system} />
          <Fact
            label={t('well.mw_range')}
            value={
              profile.length
                ? `${extent(profile, 'mw', 0)
                    .map((v) => v.toFixed(2))
                    .join('–')} sg`
                : '—'
            }
          />
        </dl>
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 pt-2 border-t border-line">
          {t('well.mud_intervals')}
        </h3>
        {intervals.length ? (
          <table className="w-full">
            <tbody>
              {intervals.map((iv) => (
                <tr key={iv.from} className="border-b border-line/60 tabular-nums">
                  <td className="py-1">
                    {fmt(iv.from)}–{fmt(iv.to)} m
                  </td>
                  <td className="py-1 text-right font-semibold text-royal-900">
                    {iv.mw.toFixed(2)} sg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-600">{t('well.no_mud_logs')}</p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Trajectory */
function TrajectoryTab({ surveys }) {
  const { t } = useTranslation();
  const rows = useMemo(() => withDisplacement(surveys), [surveys]);
  const sum = trajectorySummary(surveys);
  if (!rows.length) return <Empty>{t('well.no_surveys')}</Empty>;
  const S = 300;
  const pad = 34;
  const tvdDom = [0, extent(rows, 'tvd', 0)[1]];
  const dispMax = Math.max(50, ...rows.map((r) => r.disp));
  const xs = scale([0, dispMax], [pad, S - 10]);
  const ys = scale(tvdDom, [10, S - pad]);
  const ext = Math.max(
    50,
    ...rows.map((r) => Math.max(Math.abs(r.north || 0), Math.abs(r.east || 0)))
  );
  const px = scale([-ext, ext], [pad, S - 10]);
  const py = scale([ext, -ext], [10, S - pad]);
  return (
    <div className="space-y-4">
      <section className={`${card} p-4`}>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Fact label={t('well.stations')} value={sum.stations} />
          <Fact label={t('well.max_inc')} value={`${fmt(sum.max_inc, 1)}°`} />
          <Fact label={t('well.displacement')} value={`${fmt(sum.displacement)} m`} />
          <Fact label="MD" value={`${fmt(sum.td_md)} m`} />
          <Fact label="TVD" value={`${fmt(sum.td_tvd)} m`} />
        </dl>
      </section>
      <div className="grid md:grid-cols-2 gap-4">
        <section className={`${card} p-3`}>
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            {t('well.section_view')}
          </h3>
          <svg
            viewBox={`0 0 ${S} ${S}`}
            className="w-full h-auto"
            role="img"
            aria-label={t('well.section_view')}
          >
            <line x1={pad} x2={pad} y1="10" y2={S - pad} stroke="#CBD5E1" />
            <line x1={pad} x2={S - 10} y1={S - pad} y2={S - pad} stroke="#CBD5E1" />
            <polyline
              points={polyline(rows, xs, ys, 'disp', 'tvd')}
              fill="none"
              stroke="#123C8F"
              strokeWidth="2"
            />
            <text x={pad - 4} y="16" fontSize="8" textAnchor="end" fill="#475569">
              0
            </text>
            <text x={pad - 4} y={S - pad} fontSize="8" textAnchor="end" fill="#475569">
              {fmt(tvdDom[1])}
            </text>
            <text x={S - 10} y={S - pad + 12} fontSize="8" textAnchor="end" fill="#475569">
              {fmt(dispMax)} m
            </text>
            <text x={(S + pad) / 2} y={S - 6} fontSize="9" textAnchor="middle" fill="#475569">
              {t('well.displacement')}
            </text>
          </svg>
        </section>
        <section className={`${card} p-3`}>
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            {t('well.plan_view')}
          </h3>
          <svg
            viewBox={`0 0 ${S} ${S}`}
            className="w-full h-auto"
            role="img"
            aria-label={t('well.plan_view')}
          >
            <line x1={px(0)} x2={px(0)} y1="10" y2={S - pad} stroke="#E2E8F0" />
            <line x1={pad} x2={S - 10} y1={py(0)} y2={py(0)} stroke="#E2E8F0" />
            <polyline
              points={polyline(rows, px, py, 'east', 'north')}
              fill="none"
              stroke="#123C8F"
              strokeWidth="2"
            />
            <circle cx={px(0)} cy={py(0)} r="4" fill="#C9A227" stroke="#0A2A66" />
            <text x={px(0) + 4} y="18" fontSize="9" fill="#475569">
              N
            </text>
            <text x={S - 14} y={py(0) - 4} fontSize="9" fill="#475569">
              E
            </text>
            <text x={(S + pad) / 2} y={S - 6} fontSize="9" textAnchor="middle" fill="#475569">
              ±{fmt(ext)} m
            </text>
          </svg>
        </section>
      </div>
      <details className={`${card} p-3 text-xs`}>
        <summary className="cursor-pointer font-semibold text-royal-700">
          {t('well.survey_table', { n: rows.length })}
        </summary>
        <div className="overflow-x-auto max-h-80 overflow-y-auto mt-2">
          <table className="w-full tabular-nums">
            <thead className="sticky top-0 bg-royal-50">
              <tr className="text-royal-700 uppercase text-[10px] tracking-wider">
                <th className={th}>MD</th>
                <th className={th}>{t('well.inc')}</th>
                <th className={th}>{t('well.azi')}</th>
                <th className={th}>TVD</th>
                <th className={th}>N</th>
                <th className={th}>E</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.md} className="border-b border-line/60">
                  <td className="px-3 py-1">{fmt(r.md, 1)}</td>
                  <td className="px-3 py-1">{fmt(r.inclination, 2)}</td>
                  <td className="px-3 py-1">{fmt(r.azimuth, 1)}</td>
                  <td className="px-3 py-1">{fmt(r.tvd, 1)}</td>
                  <td className="px-3 py-1">{fmt(r.north, 1)}</td>
                  <td className="px-3 py-1">{fmt(r.east, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ Documents */
function DocumentsTab({ docs, events }) {
  const { t } = useTranslation();
  const linked = events.filter((e) => e.source?.doc_id).length;
  return (
    <div className={`${card} overflow-hidden`}>
      <p className="px-4 py-2 text-[11px] text-ink-600 border-b border-line">
        {t('well.docs_note', { n: docs.length, linked })}
      </p>
      {docs.length ? (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d._id} className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
              <FileText className="w-4 h-4 text-royal-700" aria-hidden="true" />
              <Link
                to={`/documents/${d._id}`}
                className="font-medium text-royal-600 hover:underline break-all"
              >
                {d.filename}
              </Link>
              <span className="text-ink-600">
                {d.doc_type} · {t('docs.upload.pages', { n: d.pages })} · {day(d.uploaded_at)}
              </span>
              <span className="ml-auto">
                <DocStatusChip status={d.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          {t('well.no_docs')}{' '}
          <Link to="/documents" className="text-royal-600 hover:underline">
            {t('kn.cite.documents_link')}
          </Link>
        </Empty>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Page */
export default function WellDetail() {
  const { t } = useTranslation();
  const { wellId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = WELL_TABS.includes(params.get('tab')) ? params.get('tab') : 'overview';
  const setActiveWell = useMapStore((s) => s.setActiveWell);
  const toggleCorrelationWell = useMapStore((s) => s.toggleCorrelationWell);
  const correlationWellIds = useMapStore((s) => s.correlationWellIds);
  const radiusKm = useMapStore((s) => s.radiusKm);

  const [allWells, setAllWells] = useState([]);
  const [well, setWell] = useState(null);
  const [tops, setTops] = useState([]);
  const [timeline, setTimeline] = useState({ events: [], casing: [] });
  const [surveys, setSurveys] = useState([]);
  const [docs, setDocs] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [briefBusy, setBriefBusy] = useState(false);

  useEffect(() => {
    wellsApi
      .listWells({ limit: 100, sort: 'well_id' })
      .then((res) => setAllWells(res.data.wells))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWell(null);
    setError(null);
    setRecords([]);
    Promise.all([
      wellsApi.getWell(wellId),
      wellsApi.getWellTops(wellId),
      wellsApi.getWellTimeline(wellId),
      wellsApi.getWellTrajectory(wellId),
      documentsApi.list({ well_id: wellId, limit: 100 }).catch(() => ({ data: { documents: [] } })),
    ])
      .then(([w, tp, tl, tr, dc]) => {
        if (cancelled) return;
        setWell(w.data);
        setTops(tp.data.tops);
        setTimeline(tl.data);
        setSurveys(tr.data.surveys);
        setDocs(dc.data.documents);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, t('well.load_error'))));
    return () => {
      cancelled = true;
    };
  }, [wellId, t]);

  // Drilling records (mud-weight profile) are loaded only when the Mud tab opens
  useEffect(() => {
    if (tab !== 'mud' || !well || records.length || !well.summary?.drilling_ts_records) return;
    let cancelled = false;
    setRecordsLoading(true);
    const every = Math.max(1, Math.ceil(well.summary.drilling_ts_records / 600));
    wellsApi
      .getDrillingTs(wellId, { every, limit: 5000 })
      .then((res) => !cancelled && setRecords(res.data.records))
      .catch(() => {})
      .finally(() => !cancelled && setRecordsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, well, wellId, records.length]);

  const brief = async () => {
    setBriefBusy(true);
    try {
      await downloadBriefPdf(wellId, radiusKm);
    } catch (err) {
      setError(apiErrorMessage(err, t('risk.page.brief_failed')));
    } finally {
      setBriefBusy(false);
    }
  };

  if (error && !well)
    return (
      <div className="space-y-3">
        <Link
          to="/data"
          className="text-xs text-royal-600 hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> {t('well.back')}
        </Link>
        <p className="p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </p>
      </div>
    );
  if (!well)
    return <p className="p-6 text-sm text-royal-700 animate-pulse">{t('common.loading')}</p>;

  const events = timeline.events || [];
  const inCorrelation = correlationWellIds.includes(wellId);
  const btn =
    'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-royal-600';

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/data"
              className="text-[11px] text-royal-600 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden="true" /> {t('well.back')}
            </Link>
            <h2 className="text-xl font-bold text-royal-900 font-serif flex items-center gap-2">
              {well.name}
              <span className="text-xs font-mono font-normal text-ink-600">{well.well_id}</span>
            </h2>
            <p className="text-xs text-ink-600">
              {well.field || well.block} · {formatStatusWord(well.status)} ·{' '}
              {formatStatusWord(well.trajectory_type)} · {t('well.n_events', { n: events.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs">
              <span className="sr-only">{t('well.switch')}</span>
              <select
                value={wellId}
                onChange={(e) => navigate(`/wells/${e.target.value}?tab=${tab}`)}
                className="text-xs border border-line rounded-md px-2 py-1.5 bg-white"
              >
                {!allWells.some((w) => w.well_id === wellId) && (
                  <option value={wellId}>{wellId}</option>
                )}
                {allWells.map((w) => (
                  <option key={w.well_id} value={w.well_id}>
                    {w.well_id} · {w.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setActiveWell(well);
                navigate('/map');
              }}
              className={`${btn} border-royal-700 bg-royal-700 text-white hover:bg-royal-900`}
            >
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />{' '}
              {t('explorer.wells.show_on_map')}
            </button>
            <button
              type="button"
              onClick={() => toggleCorrelationWell(wellId)}
              aria-pressed={inCorrelation}
              className={`${btn} border-line bg-white text-royal-900 hover:bg-royal-100`}
            >
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              {inCorrelation ? t('well.in_correlation') : t('well.add_correlation')}
            </button>
            <Link
              to={`/monitor?well=${wellId}`}
              className={`${btn} border-line bg-white text-royal-900 hover:bg-royal-100`}
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {t('risk.title')}
            </Link>
            <button
              type="button"
              onClick={brief}
              disabled={briefBusy}
              className={`${btn} border-royal-700 bg-white text-royal-700 hover:bg-royal-100 disabled:opacity-50`}
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
              {briefBusy ? t('common.loading') : t('risk.brief_pdf')}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div
          role="tablist"
          aria-label={t('well.tabs_aria')}
          className="flex flex-wrap gap-1 border-t border-line pt-3"
        >
          {WELL_TABS.map((k) => {
            const Icon = TAB_ICONS[k];
            return (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setParams({ tab: k })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                  tab === k
                    ? 'bg-royal-700 text-white'
                    : 'text-ink-600 hover:bg-royal-100 hover:text-royal-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {t(`well.tabs.${k}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab well={well} tops={tops} events={events} />}
        {tab === 'tops' && <TopsTab well={well} tops={tops} events={events} />}
        {tab === 'events' && <EventsTab events={events} />}
        {tab === 'casing' && <CasingTab well={well} casing={timeline.casing} events={events} />}
        {tab === 'mud' && (
          <MudTab well={well} events={events} records={records} loading={recordsLoading} />
        )}
        {tab === 'trajectory' && <TrajectoryTab surveys={surveys} />}
        {tab === 'documents' && <DocumentsTab docs={docs} events={events} />}
      </div>
    </div>
  );
}
