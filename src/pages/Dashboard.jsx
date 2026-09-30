import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Compass,
  FileDown,
  FileText,
  Gauge,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { dashboardApi } from '../api/admin';
import { downloadBriefPdf } from '../api/risk';
import { wellsApi } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import { useMapStore } from '../store/mapStore';
import MiniMap from '../components/dashboard/MiniMap';
import { depthProgress, fmtInt } from '../components/dashboard/dashboardUtils';
import { AlertLevelChip, RiskLevelChip } from '../components/risk/LevelChip';
import { alertLevel, fmtPct, levelFor } from '../components/risk/riskUtils';

const LIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 30000;
const DASH_WELL_KEY = 'nwis_dashboard_well';

function Kpi({ icon: Icon, label, value, sub, tone = 'royal', to }) {
  // Telemetry card (DESIGN.md): uppercase label + icon on a 1px divider, large tabular
  // value; tone colours the icon only (never colour alone - label + value)
  const tones = {
    royal: { icon: 'text-navy-900' },
    gold: { icon: 'text-saffron-600' },
    red: { icon: 'text-hazard-700' },
    green: { icon: 'text-statutory-800' },
  };
  const tn = tones[tone] || tones.royal;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
        <span className="text-[11px] font-display font-semibold uppercase tracking-[0.05em] text-ink-900 truncate">
          {label}
        </span>
        <Icon className={`w-4 h-4 shrink-0 ${tn.icon}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-[28px] leading-none font-display font-bold text-navy-900 tabular-nums">
        {value}
      </p>
      {sub && <span className="mt-1.5 text-[11px] text-ink-600 block truncate">{sub}</span>}
    </>
  );
  const cls = 'bg-white p-3.5 rounded border border-line flex flex-col';
  return to ? (
    <Link to={to} className={`${cls} hover:bg-royal-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Horizontal strip of the look-ahead ribbon (top risk per 10 m bin) with the bit marker. */
function MiniRibbon({ ribbon, depth }) {
  if (!ribbon?.length) return null;
  const lo = ribbon[0].from;
  const hi = ribbon[ribbon.length - 1].to;
  const pct = (d) => ((d - lo) / (hi - lo)) * 100;
  return (
    <div>
      <div
        className="relative h-5 rounded overflow-hidden border border-line flex"
        role="img"
        aria-label={`Risk from ${lo} to ${hi} m MD`}
      >
        {ribbon.map((b) => {
          const l = levelFor(b.top_p);
          return (
            <span
              key={b.from}
              className="h-full"
              style={{
                width: `${((b.to - b.from) / (hi - lo)) * 100}%`,
                background: l.color,
                opacity: b.drilled ? 0.15 : 0.15 + 0.85 * Math.min(1, b.top_p / 0.75),
              }}
              title={`${b.from}–${b.to} m · ${b.top_type.replace(/_/g, ' ')} ${fmtPct(b.top_p)}`}
            />
          );
        })}
        {depth != null && (
          <span
            className="absolute top-0 bottom-0 w-0.5 bg-royal-900"
            style={{ left: `${pct(depth)}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] text-ink-600 tabular-nums mt-0.5">
        <span>{fmtInt(lo)} m</span>
        <span>{fmtInt(hi)} m MD</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const radiusKm = useMapStore((s) => s.radiusKm);
  const [wellId, setWellId] = useState(() => {
    try {
      return localStorage.getItem(DASH_WELL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [wells, setWells] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [briefBusy, setBriefBusy] = useState(false);

  useEffect(() => {
    wellsApi
      .listWells({ limit: 100 })
      .then((res) => setWells(res.data.wells))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    return dashboardApi
      .get({ well_id: wellId || undefined, radius_km: radiusKm })
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((err) => {
        if (err?.response?.status === 404 && wellId) setWellId('');
        else setError(apiErrorMessage(err, i18n.t('dashboard.load_error')));
      });
  }, [wellId, radiusKm]);

  useEffect(() => {
    load();
  }, [load]);

  const live = data?.active_well?.live;
  useEffect(() => {
    const timer = setInterval(load, live ? LIVE_POLL_MS : IDLE_POLL_MS);
    return () => clearInterval(timer);
  }, [load, live]);

  const chooseWell = (id) => {
    setWellId(id);
    try {
      localStorage.setItem(DASH_WELL_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };

  const brief = async () => {
    setBriefBusy(true);
    try {
      await downloadBriefPdf(data.active_well.well_id, radiusKm);
    } catch (err) {
      setError(apiErrorMessage(err, t('risk.page.brief_failed')));
    } finally {
      setBriefBusy(false);
    }
  };

  const k = data?.kpis;
  const a = data?.active_well;
  const worst = ['critical', 'warning', 'watch', 'info'].find((l) => k?.alerts_by_level?.[l]);
  const progress = depthProgress(a?.depth_md, a?.total_depth_md);
  const quick = [
    { to: '/knowledge', icon: BookOpen, label: t('dashboard.quick.ask') },
    { to: '/documents', icon: Upload, label: t('dashboard.quick.upload') },
    { to: '/correlation', icon: TrendingUp, label: t('dashboard.quick.correlation') },
    { to: '/map', icon: MapPin, label: t('dashboard.quick.map') },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-royal-700">
            {t('dashboard.eyebrow')}
          </span>
          <h2 className="text-xl font-bold text-royal-900 font-serif">{t('dashboard.title')}</h2>
          <p className="text-xs text-ink-600 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-ink-600">{t('dashboard.active.choose')}</span>
            <select
              value={a?.well_id || ''}
              onChange={(e) => chooseWell(e.target.value)}
              className="text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
            >
              {!a && <option value="">—</option>}
              {wells.map((w) => (
                <option key={w.well_id} value={w.well_id}>
                  {w.well_id} · {w.status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded"
        >
          {error}
        </p>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Kpi
          icon={Compass}
          label={t('dashboard.kpi.active_wells')}
          value={fmtInt(k?.active_wells)}
          sub={k && t('dashboard.kpi.active_wells_sub', { total: k.total_wells })}
          to="/data"
        />
        <Kpi
          icon={AlertTriangle}
          tone={worst === 'critical' ? 'red' : worst ? 'gold' : 'green'}
          label={t('dashboard.kpi.open_alerts')}
          value={fmtInt(k?.open_alerts)}
          sub={
            k &&
            ['critical', 'warning', 'watch', 'info']
              .filter((l) => k.alerts_by_level[l])
              .map((l) => `${k.alerts_by_level[l]} ${alertLevel(l).label.toLowerCase()}`)
              .join(' · ')
          }
          to="/alerts"
        />
        <Kpi
          icon={ShieldCheck}
          tone="green"
          label={t('dashboard.kpi.verified_events')}
          value={fmtInt(k?.verified_events)}
          sub={k && t('dashboard.kpi.verified_events_sub', { total: fmtInt(k.total_events) })}
          to="/documents"
        />
        <Kpi
          icon={FileText}
          tone="gold"
          label={t('dashboard.kpi.documents')}
          value={fmtInt(k?.documents_processed)}
          sub={k && t('dashboard.kpi.documents_sub', { total: k.documents_total })}
          to="/documents"
        />
        <Kpi
          icon={Users}
          label={t('dashboard.kpi.offsets')}
          value={fmtInt(k?.offset_wells_in_range)}
          sub={t('dashboard.kpi.offsets_sub', { radius: radiusKm })}
          to="/map"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Active well */}
        <section
          className="lg:col-span-2 bg-white p-5 rounded-xl border border-line shadow-sm space-y-4"
          aria-labelledby="active-well-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3
                id="active-well-title"
                className="text-sm font-bold text-royal-900 flex items-center gap-1.5"
              >
                <Gauge className="w-4 h-4 text-royal-700" aria-hidden="true" />{' '}
                {t('dashboard.active.title')}
                {live && (
                  <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                      aria-hidden="true"
                    />
                    {t('header.live')}
                  </span>
                )}
              </h3>
              {a && (
                <p className="text-xs text-ink-600">
                  {a.well_id} · {a.name} · {a.status} ·{' '}
                  {t('dashboard.active.td', { m: fmtInt(a.total_depth_md) })}
                </p>
              )}
            </div>
            {a && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={brief}
                  disabled={briefBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-royal-700 text-royal-700 bg-white hover:bg-royal-100 text-xs font-medium disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                  {briefBusy ? t('common.loading') : t('dashboard.active.brief')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/monitor')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white text-xs font-medium"
                >
                  {t('dashboard.active.open_risk')}{' '}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {!a ? (
            <p className="text-xs text-ink-600 animate-pulse">{t('common.loading')}</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-royal-50 border border-royal-100 rounded-lg p-3">
                  <span className="text-ink-600 block">{t('dashboard.active.depth')}</span>
                  {a.depth_md != null ? (
                    <>
                      <p className="text-lg font-bold text-royal-900 tabular-nums">
                        {fmtInt(Math.round(a.depth_md))} m MD
                      </p>
                      <div className="h-1.5 bg-royal-100 rounded mt-1" aria-hidden="true">
                        <div
                          className="h-1.5 bg-royal-700 rounded"
                          style={{ width: `${(progress || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ink-600">{a.depth_source}</span>
                    </>
                  ) : (
                    <p className="text-[11px] text-ink-600 mt-1">{t('dashboard.active.no_live')}</p>
                  )}
                </div>
                <div className="bg-royal-50 border border-royal-100 rounded-lg p-3">
                  <span className="text-ink-600 block">{t('dashboard.active.formation')}</span>
                  <p className="text-lg font-bold text-royal-900">{a.formation || '—'}</p>
                  <span className="text-[10px] text-ink-600">{a.confidence?.reason}</span>
                </div>
                <div className="bg-royal-50 border border-royal-100 rounded-lg p-3">
                  <span className="text-ink-600 block">
                    {a.depth_md == null
                      ? t('dashboard.active.path_risk')
                      : a.next_risk?.threshold_met === false
                        ? t('dashboard.active.highest_ahead')
                        : t('dashboard.active.next_risk')}
                  </span>
                  {a.next_risk ? (
                    <>
                      <p className="font-bold text-royal-900">
                        {a.next_risk.label}{' '}
                        <span className="tabular-nums">
                          {fmtInt(a.next_risk.from)}–{fmtInt(a.next_risk.to)} m
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <RiskLevelChip p={a.next_risk.p} />
                        <span className="text-[10px] text-ink-600 tabular-nums">
                          {fmtPct(a.next_risk.p)}
                          {a.depth_md != null &&
                            ` · ${t('dashboard.active.ahead', { m: fmtInt(a.next_risk.distance_m) })}`}
                          {a.next_risk.formation && ` · ${a.next_risk.formation}`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-ink-600">
                      {t('dashboard.active.next_risk_none')}
                    </p>
                  )}
                </div>
              </div>
              <MiniRibbon ribbon={a.ribbon} depth={a.depth_md} />
              <div>
                <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
                  {t('dashboard.active.top_risks')}
                </h4>
                <ul className="flex flex-wrap gap-2">
                  {a.top_risks.map((r) => (
                    <li
                      key={r.type}
                      className="flex items-center gap-2 text-xs bg-white border border-line rounded-lg px-2 py-1"
                    >
                      <span className="font-semibold text-royal-900">{r.label}</span>
                      <span className="tabular-nums text-ink-600">{fmtPct(r.probability)}</span>
                      <RiskLevelChip p={r.probability} />
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        {/* Mini map */}
        <section
          className="bg-white p-5 rounded-xl border border-line shadow-sm"
          aria-labelledby="minimap-title"
        >
          <div className="flex items-center justify-between mb-2">
            <h3
              id="minimap-title"
              className="text-sm font-bold text-royal-900 flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4 text-royal-700" aria-hidden="true" />{' '}
              {t('dashboard.map.title')}
            </h3>
            <Link to="/map" className="text-[11px] text-royal-600 hover:underline">
              {t('dashboard.map.open')}
            </Link>
          </div>
          <MiniMap map={data?.map} onSelect={chooseWell} />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent alerts */}
        <section
          className="lg:col-span-2 bg-white rounded-xl border border-line shadow-sm"
          aria-labelledby="recent-alerts"
        >
          <div className="p-4 border-b border-line flex items-center justify-between">
            <h3
              id="recent-alerts"
              className="text-sm font-bold text-royal-900 flex items-center gap-2"
            >
              <Activity className="w-4 h-4 text-royal-700" aria-hidden="true" />{' '}
              {t('dashboard.alerts.title')}
            </h3>
            <Link to="/alerts" className="text-[11px] text-royal-600 hover:underline">
              {t('dashboard.alerts.all')}
            </Link>
          </div>
          {data?.recent_alerts?.length ? (
            <ul className="divide-y divide-line">
              {data.recent_alerts.map((al) => (
                <li
                  key={al._id}
                  className="px-4 py-2.5 flex items-start gap-3 text-xs"
                >
                  <AlertLevelChip level={al.level} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-royal-900 truncate">{al.title}</p>
                    <p className="text-[10px] text-ink-600 tabular-nums">
                      {al.well_id} · bit {fmtInt(Math.round(al.depth_md))} m ·{' '}
                      {new Date(al.ts).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}{' '}
                      · {al.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-xs text-ink-600">{t('dashboard.alerts.empty')}</p>
          )}
        </section>

        {/* Quick actions */}
        <section
          className="bg-white p-5 rounded-xl border border-line shadow-sm"
          aria-labelledby="quick-actions"
        >
          <h3 id="quick-actions" className="text-sm font-bold text-royal-900 mb-3">
            {t('dashboard.quick.title')}
          </h3>
          <ul className="space-y-2">
            {quick.map((q) => (
              <li key={q.to}>
                <Link
                  to={q.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-line hover:bg-royal-50 text-xs font-medium text-royal-900"
                >
                  <q.icon className="w-4 h-4 text-royal-700" aria-hidden="true" />
                  {q.label}
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-ink-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
