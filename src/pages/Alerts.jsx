import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Bell, RefreshCw, Search } from 'lucide-react';
import { alertsApi } from '../api/risk';
import { wellsApi } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import { useAuthStore, canActOnAlerts } from '../store/authStore';
import { AlertCard } from '../components/risk/AlertFeed';
import { AlertLevelIcon } from '../components/risk/LevelChip';
import { alertLevel, mergeAlerts, RISK_TYPES } from '../components/risk/riskUtils';
import { Pagination } from '../components/common/DataTable';
import RiskEmailDialog from '../components/risk/RiskEmailDialog';
import { useMapStore } from '../store/mapStore';

const LIMIT = 25;
const POLL_MS = 15000;
const LEVELS = ['critical', 'warning', 'watch', 'info'];
const STATUSES = ['active', 'open', 'ack', 'resolved', 'dismissed', ''];
const select =
  'text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';

/** All alerts across wells in one place: filter, search, act (separate from the live monitor). */
export default function Alerts() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get('status') ?? 'active',
    level: params.get('level') || '',
    well_id: params.get('well') || '',
    type: params.get('type') || '',
  };
  const page = Number(params.get('page')) || 1;
  const [q, setQ] = useState('');
  const [data, setData] = useState({ alerts: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [emailAlert, setEmailAlert] = useState(null);
  const radiusKm = useMapStore((s) => s.radiusKm);

  const setFilter = (k, v) => {
    const next = Object.fromEntries(params.entries());
    const key = k === 'well_id' ? 'well' : k;
    if (v === '' && k !== 'status') delete next[key];
    else next[key] = v;
    delete next.page;
    setParams(next);
  };

  const key = `${filters.status}|${filters.level}|${filters.well_id}|${filters.type}|${page}`;
  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        alertsApi.list({ ...filters, page, limit: LIMIT }),
        alertsApi.summary(),
      ]);
      setData(list.data);
      setSummary(sum.data);
      setError(null);
      setUpdated(new Date());
    } catch (err) {
      setError(apiErrorMessage(err, t('risk.page.alerts_failed')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, t]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    wellsApi
      .listWells({ limit: 100, sort: 'well_id' })
      .then((res) => setWells(res.data.wells))
      .catch(() => {});
  }, []);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      const res = await alertsApi[action](id);
      setData((d) => ({ ...d, alerts: mergeAlerts(d.alerts, [res.data]) }));
      load();
    } catch (err) {
      setError(apiErrorMessage(err, t('risk.page.action_failed')));
    } finally {
      setBusyId(null);
    }
  };

  const feedback = async (id, useful) => {
    setBusyId(id);
    try {
      const res = await alertsApi.feedback(id, useful);
      setData((d) => ({ ...d, alerts: mergeAlerts(d.alerts, [res.data.alert]) }));
    } catch (err) {
      setError(apiErrorMessage(err, t('risk.page.feedback_failed')));
    } finally {
      setBusyId(null);
    }
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data.alerts;
    return data.alerts.filter((a) =>
      [a.title, a.message, a.well_id, a.well_name, a.formation]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(needle))
    );
  }, [data.alerts, q]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-line shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1.5">
              <Bell className="w-4 h-4" aria-hidden="true" /> {t('alerts.kicker')}
            </span>
            <h2 className="text-xl font-bold text-royal-900 font-serif">{t('alerts.title')}</h2>
            <p className="text-xs text-ink-600 mt-1">{t('alerts.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line text-[11px] text-royal-900 hover:bg-royal-100"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {t('common.refresh')}
            </button>
            <Link
              to="/monitor"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-royal-700 hover:bg-royal-900 text-white text-[11px] font-medium"
            >
              <Activity className="w-3.5 h-3.5" aria-hidden="true" /> {t('nav.monitor')}
            </Link>
          </div>
        </div>

        {/* Active counts by level - click to filter */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => {
              setParams({ status: 'active' });
            }}
            className={`text-left p-2.5 rounded-lg border ${
              filters.status === 'active' && !filters.level
                ? 'border-royal-700 bg-royal-100'
                : 'border-line hover:bg-royal-50'
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider text-ink-600">
              {t('alerts.active')}
            </span>
            <span className="block text-xl font-bold text-royal-900 tabular-nums">
              {summary?.active ?? '—'}
            </span>
            <span className="text-[10px] text-ink-600">
              {t('alerts.unacked', { n: summary?.open ?? 0 })}
            </span>
          </button>
          {LEVELS.map((lv) => {
            const l = alertLevel(lv);
            const on = filters.level === lv;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setFilter('level', on ? '' : lv)}
                aria-pressed={on}
                className={`text-left p-2.5 rounded-lg border ${on ? 'ring-2 ring-offset-1' : 'hover:bg-royal-50'}`}
                style={{ borderColor: l.color, ...(on ? { '--tw-ring-color': l.color } : {}) }}
              >
                <span
                  className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1"
                  style={{ color: l.color }}
                >
                  <AlertLevelIcon level={lv} className="w-3.5 h-3.5" /> {l.label}
                </span>
                <span className="block text-xl font-bold text-royal-900 tabular-nums">
                  {summary?.by_level?.[lv] ?? '—'}
                </span>
                <span className="text-[10px] text-ink-600">{t('alerts.active_lower')}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">{t('alerts.search')}</span>
            <Search className="w-3.5 h-3.5 text-ink-600 absolute left-2 top-2" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('alerts.search')}
              className={`${select} pl-7 w-56`}
            />
          </label>
          <select
            aria-label={t('explorer.cols.status')}
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className={select}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s === 'active'
                  ? t('alerts.status_active')
                  : s
                    ? t(`risk.alert_status.${s}`)
                    : t('risk.feed.all')}
              </option>
            ))}
          </select>
          <select
            aria-label={t('risk.feed.level')}
            value={filters.level}
            onChange={(e) => setFilter('level', e.target.value)}
            className={select}
          >
            <option value="">{t('alerts.any_level')}</option>
            {LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {alertLevel(lv).label}
              </option>
            ))}
          </select>
          <select
            aria-label={t('explorer.cols.well')}
            value={filters.well_id}
            onChange={(e) => setFilter('well_id', e.target.value)}
            className={select}
          >
            <option value="">{t('explorer.all_wells')}</option>
            {wells.map((w) => (
              <option key={w.well_id} value={w.well_id}>
                {w.well_id} · {w.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('kn.lesson.risk_type')}
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value)}
            className={select}
          >
            <option value="">{t('lessons.all_risk_types')}</option>
            {RISK_TYPES.map((rt) => (
              <option key={rt.key} value={rt.key}>
                {rt.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-ink-600 tabular-nums">
            {t('alerts.count', { n: data.total })}
            {updated && ` · ${t('alerts.updated', { time: updated.toLocaleTimeString() })}`}
          </span>
        </div>
      </div>

      {error && (
        <p className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">{error}</p>
      )}

      <div className="bg-white rounded-xl border border-line shadow-sm p-3">
        {loading && !data.alerts.length ? (
          <p className="p-6 text-xs text-ink-600 animate-pulse">{t('common.loading')}</p>
        ) : shown.length ? (
          <div className="grid lg:grid-cols-2 gap-2" aria-live="polite">
            {shown.map((a) => (
              <ul key={a._id} className="space-y-0.5">
                <AlertCard
                  alert={a}
                  canAct={canActOnAlerts(user)}
                  busy={busyId === a._id}
                  onAction={act}
                  onFeedback={feedback}
                  onEmail={canActOnAlerts(user) ? setEmailAlert : undefined}
                />
                <li className="flex gap-3 px-1 text-[11px]">
                  <Link
                    to={`/monitor?well=${a.well_id}`}
                    className="text-royal-600 hover:underline"
                  >
                    {t('alerts.open_monitor')}
                  </Link>
                  <Link to={`/wells/${a.well_id}`} className="text-royal-600 hover:underline">
                    {t('map.drawer.open_well')}
                  </Link>
                </li>
              </ul>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-xs text-ink-600">{t('alerts.empty')}</p>
        )}
        <Pagination
          page={page}
          limit={LIMIT}
          total={data.total}
          onPage={(p) => setParams({ ...Object.fromEntries(params.entries()), page: String(p) })}
        />
      </div>
      {emailAlert && (
        <RiskEmailDialog
          wellId={emailAlert.well_id}
          risk={{ type: emailAlert.type, label: emailAlert.title, probability: emailAlert.probability }}
          depthMd={emailAlert.depth_md}
          radiusKm={radiusKm}
          alert={emailAlert}
          onClose={() => setEmailAlert(null)}
        />
      )}
    </div>
  );
}
