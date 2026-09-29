import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Play, RefreshCw, Square, XCircle } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { riskApi, simulatorApi } from '../../api/risk';
import { apiErrorMessage } from '../../api/client';
import { pct } from './adminUtils';

const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function Stat({ label, value, sub, ok }) {
  return (
    <div className="bg-royal-50 border border-royal-100 rounded-lg p-3">
      <span className="text-[10px] text-ink-600 block">{label}</span>
      <span className="text-lg font-bold text-royal-900 tabular-nums flex items-center gap-1.5">
        {value}
        {ok === true && (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-label="within target" />
        )}
        {ok === false && <XCircle className="w-4 h-4 text-[#C62D3B]" aria-label="outside target" />}
      </span>
      {sub && <span className="text-[10px] text-ink-600 block">{sub}</span>}
    </div>
  );
}

function Group({ title, children, note }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase font-bold tracking-wider text-royal-700">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>
      {note && <p className="text-[10px] text-ink-600">{note}</p>}
    </section>
  );
}

function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = () => {
    setState((s) => ({ ...s, loading: true }));
    return fn()
      .then((res) => setState({ data: res.data, error: null, loading: false }))
      .catch((err) =>
        setState({ data: null, error: apiErrorMessage(err, 'Request failed.'), loading: false })
      );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);
  return [state, reload];
}

function Status({ state, children }) {
  const { t } = useTranslation();
  if (state.error) return <p className="text-xs text-red-700">{state.error}</p>;
  if (!state.data)
    return <p className="text-xs text-ink-600 animate-pulse">{t('common.loading')}</p>;
  return children;
}

/** KPIs to report (Section 14): extraction, search, risk, alerts, system latency. */
export function OverviewTab() {
  const { t } = useTranslation();
  const [state, reload] = useLoad(adminApi.metrics);
  const m = state.data;
  return (
    <Status state={state}>
      {m && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1 text-xs text-royal-600 hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {t('common.refresh')}
            </button>
          </div>
          <Group title="Data">
            <Stat
              label="Wells"
              value={m.counts.wells}
              sub={`${m.counts.drilling_ts_wells} with drilling logs`}
            />
            <Stat
              label="Events"
              value={m.counts.events}
              sub={`${m.counts.verified_events} verified`}
            />
            <Stat
              label="Documents"
              value={m.counts.documents}
              sub={`${m.counts.lessons} lessons curated`}
            />
            <Stat label="Users" value={m.counts.users} />
          </Group>
          <Group
            title="Document extraction"
            note="F1 from the latest offline evaluation (scripts/evaluate_extraction.py) on labelled synthetic DDRs."
          >
            <Stat
              label="Event F1 (main set)"
              value={num(m.extraction.evaluations?.main?.events?.f1, 3)}
              sub={
                m.extraction.evaluations?.main
                  ? `P ${num(m.extraction.evaluations.main.events.precision, 3)} · R ${num(m.extraction.evaluations.main.events.recall, 3)}`
                  : 'not evaluated yet'
              }
            />
            <Stat
              label="Event F1 (challenge set)"
              value={num(m.extraction.evaluations?.challenge?.events?.f1, 3)}
            />
            <Stat
              label="Auto-accepted"
              value={pct(m.extraction.auto_accept_rate)}
              sub="of extracted items"
            />
            <Stat
              label="Gold set"
              value={m.extraction.gold_set_size}
              sub="reviewer-corrected items"
            />
          </Group>
          <Group title="Search & advisor">
            <Stat
              label="Benchmark"
              value={
                m.advisor.latest_benchmark
                  ? `${m.advisor.latest_benchmark.passed}/${m.advisor.latest_benchmark.questions}`
                  : '—'
              }
              sub="questions with correct citations"
            />
            <Stat
              label="Citation precision"
              value={num(m.advisor.latest_benchmark?.mean_event_citation_precision, 2)}
            />
            <Stat label="Questions asked" value={m.advisor.questions_asked} />
            <Stat
              label="Rated useful"
              value={`${m.advisor.feedback.useful} / ${m.advisor.feedback.useful + m.advisor.feedback.not_useful}`}
            />
          </Group>
          <Group
            title="Risk model (leave-one-well-out replay)"
            note={
              m.risk
                ? `${m.risk.version} · trained ${when(m.risk.trained_at)} · synthetic data`
                : 'No trained model - rules only.'
            }
          >
            <Stat
              label="Events warned"
              value={pct(m.risk?.replay?.event_recall)}
              sub={
                m.risk?.replay
                  ? `${m.risk.replay.events_warned}/${m.risk.replay.events_scored} events`
                  : null
              }
            />
            <Stat
              label="Median lead distance"
              value={
                m.risk?.replay?.median_lead_m != null ? `${m.risk.replay.median_lead_m} m` : '—'
              }
              sub="before the event top"
            />
            <Stat label="Warning+ precision" value={pct(m.risk?.replay?.serious_precision)} />
            <Stat
              label="False warnings / 1000 m"
              value={num(m.risk?.replay?.serious_false_per_1000m, 2)}
              sub={
                m.risk?.replay ? `all levels ${num(m.risk.replay.false_alerts_per_1000m, 2)}` : null
              }
            />
          </Group>
          <Group title="Alerts in operation">
            <Stat label="Alerts raised" value={m.alerts.total} />
            <Stat label="Acknowledged / closed" value={pct(m.alerts.acknowledged_share)} />
            <Stat
              label="Rated useful"
              value={pct(m.alerts.useful_share)}
              sub={`${m.alerts.rated} rated`}
            />
            <Stat
              label="Mean time to acknowledge"
              value={
                m.alerts.mean_time_to_ack_s != null
                  ? `${num(m.alerts.mean_time_to_ack_s, 0)} s`
                  : '—'
              }
            />
          </Group>
          <Group
            title="System (since API start)"
            note="In-process measurements; they reset when the API restarts."
          >
            <Stat
              label="API p95 latency"
              value={
                m.system.api.overall.p95_ms != null ? `${m.system.api.overall.p95_ms} ms` : '—'
              }
              sub={`${m.system.api.overall.count} requests · p50 ${m.system.api.overall.p50_ms ?? '—'} ms`}
            />
            <Stat
              label="Live data → alert (p95)"
              value={
                m.system.live_pipeline.p95_ms != null ? `${m.system.live_pipeline.p95_ms} ms` : '—'
              }
              ok={
                m.system.live_pipeline.p95_ms != null
                  ? m.system.live_pipeline.p95_ms < m.system.alert_latency_target_ms
                  : undefined
              }
              sub={`target < ${m.system.alert_latency_target_ms / 1000} s · ${m.system.live_pipeline.count} evaluations`}
            />
            <Stat label="Uptime" value={`${Math.round(m.system.api.uptime_s / 60)} min`} />
            <Stat
              label="Slowest route (p95)"
              value={
                m.system.api.slowest_routes[0]?.p95_ms != null
                  ? `${m.system.api.slowest_routes[0].p95_ms} ms`
                  : '—'
              }
              sub={m.system.api.slowest_routes[0]?.route}
            />
          </Group>
        </div>
      )}
    </Status>
  );
}

const SOURCE_OK = new Set(['connected', 'running', 'enabled', 'simulator', 'reachable']);

export function SourcesTab() {
  const [state] = useLoad(adminApi.sources);
  return (
    <Status state={state}>
      {state.data && (
        <div className="space-y-3">
          <p className="text-[11px] p-2 rounded bg-gold-100 text-[#6B5310] border border-gold-500/40">
            {state.data.dataset}. NWIS reads from eRTMAC and never writes to it.
          </p>
          <ul className="divide-y divide-line border border-line rounded-lg">
            {state.data.sources.map((s) => (
              <li key={s.name} className="p-3 flex items-start gap-3 text-xs">
                {SOURCE_OK.has(s.status) ? (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle className="w-4 h-4 text-ink-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-royal-900">
                    {s.name} <span className="font-normal text-ink-600">· {s.kind}</span>
                  </p>
                  <p className="text-ink-600 break-words">{s.detail}</p>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-royal-50 border border-line text-[10px] font-semibold text-royal-900">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Status>
  );
}

export function ModelsTab() {
  const { t } = useTranslation();
  const [state, reload] = useLoad(adminApi.models);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const retrain = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await riskApi.train();
      const r = res.data.replay;
      setMsg(
        `Trained ${res.data.version}: ${Math.round((r.event_recall || 0) * 100)} % of events warned, median lead ${r.median_lead_m} m.`
      );
      reload();
    } catch (err) {
      setMsg(apiErrorMessage(err, 'Training failed.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Status state={state}>
      {state.data && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={retrain}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {busy ? t('admin.models.retraining') : t('admin.models.retrain')}
            </button>
            {msg && (
              <span role="status" className="text-ink-600">
                {msg}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-royal-50 text-royal-700 uppercase text-[10px] tracking-wider text-left">
                  <th className="px-3 py-2">{t('admin.models.version')}</th>
                  <th className="px-3 py-2">{t('admin.models.trained')}</th>
                  <th className="px-3 py-2">Wells / samples</th>
                  <th className="px-3 py-2">PR-AUC mud loss · kick · stuck</th>
                  <th className="px-3 py-2">Replay: warned · lead · warning+ precision</th>
                </tr>
              </thead>
              <tbody>
                {state.data.risk_models.map((m, i) => {
                  const pt = m.metrics?.per_type || {};
                  const r = m.metrics?.replay || {};
                  return (
                    <tr key={m._id} className="border-b border-line/60 hover:bg-royal-50/50">
                      <td className="px-3 py-2 font-mono">
                        {m.version}
                        {i === 0 && (
                          <span className="ml-1 text-[10px] px-1 rounded bg-emerald-50 text-emerald-700 font-sans font-semibold">
                            {t('admin.models.current')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {when(m.trained_at)} · {m.trained_by || '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {m.training_wells?.length} / {m.samples}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {['mud_loss', 'kick', 'stuck_pipe']
                          .map((k) => num(pt[k]?.pr_auc, 2))
                          .join(' · ')}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {pct(r.event_recall)} · {r.median_lead_m ?? '—'} m ·{' '}
                        {pct(r.serious_precision)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3 className="text-xs uppercase font-bold tracking-wider text-royal-700">
            {t('admin.models.evaluations')}
          </h3>
          <ul className="space-y-1">
            {state.data.evaluations.map((e) => (
              <li key={e._id} className="flex flex-wrap gap-2 border-b border-line/60 pb-1">
                <span className="font-semibold text-royal-900 w-20">{e.set}</span>
                <span className="text-ink-600">{when(e.ts)}</span>
                <span className="text-ink-600">
                  {e.set === 'risk' &&
                    e.replay &&
                    `recall ${pct(e.replay.event_recall)}, lead ${e.replay.median_lead_m} m`}
                  {e.events?.f1 != null && `event F1 ${num(e.events.f1, 3)}`}
                  {e.passed != null && `${e.passed}/${e.questions} passed`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Status>
  );
}

/** Admin simulator control (Section 10.10): start/stop replays for any replayable well. */
export function SimulatorTab() {
  const { t } = useTranslation();
  const [state, reload] = useLoad(simulatorApi.status);
  const [speed, setSpeed] = useState(10);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const act = async (wellId, running) => {
    setBusy(wellId);
    setError(null);
    try {
      if (running) await simulatorApi.stop(wellId);
      else await simulatorApi.start({ wellId, speed, startMd: 0 });
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err, 'Simulator request failed.'));
    } finally {
      setBusy(null);
    }
  };
  const runs = Object.fromEntries((state.data?.runs || []).map((r) => [r.well_id, r]));
  return (
    <Status state={state}>
      {state.data && (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-ink-600">Speed</span>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="border border-line rounded-md px-2 py-1 bg-white"
              >
                {[5, 10, 20, 50].map((s) => (
                  <option key={s} value={s}>
                    {s} m/s
                  </option>
                ))}
              </select>
            </label>
            <span className="text-ink-600">
              Replays start at surface; open Risk &amp; Alerts to watch one live.
            </span>
          </div>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <h3 className="text-xs uppercase font-bold tracking-wider text-royal-700">
            {t('admin.simulator.replayable')}
          </h3>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {state.data.replayable_wells.map((w) => {
              const r = runs[w];
              const running = r?.status === 'running';
              return (
                <li key={w} className="border border-line rounded-lg p-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-royal-900">{w}</p>
                    <p className="text-[10px] text-ink-600 tabular-nums">
                      {r
                        ? `${r.status} · ${Math.round(r.depth_md)} / ${Math.round(r.total_depth_md)} m · ${r.alerts_fired} alerts`
                        : 'idle'}
                    </p>
                  </div>
                  {running && (
                    <Link to="/alerts" className="text-royal-600 hover:underline text-[11px]">
                      view
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busy === w}
                    onClick={() => act(w, running)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-white text-[11px] font-medium disabled:opacity-50 ${running ? 'bg-red-600 hover:bg-red-700' : 'bg-royal-700 hover:bg-royal-900'}`}
                  >
                    {running ? (
                      <Square className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Play className="w-3 h-3" aria-hidden="true" />
                    )}
                    {running ? t('admin.simulator.stop') : t('admin.simulator.start')}
                  </button>
                </li>
              );
            })}
          </ul>
          <h3 className="text-xs uppercase font-bold tracking-wider text-royal-700">
            {t('admin.simulator.runs')}
          </h3>
          <ul className="space-y-1">
            {state.data.recent.map((r) => (
              <li
                key={r._id}
                className="flex flex-wrap gap-2 border-b border-line/60 pb-1 tabular-nums"
              >
                <span className="font-semibold text-royal-900 w-24">{r.well_id}</span>
                <span className="text-ink-600">
                  {when(r.started_at)} by {r.started_by}
                </span>
                <span className="text-ink-600">
                  {r.status} · {Math.round(r.start_md)}→{Math.round(r.depth_md)} m ·{' '}
                  {r.alerts_fired} alerts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Status>
  );
}
