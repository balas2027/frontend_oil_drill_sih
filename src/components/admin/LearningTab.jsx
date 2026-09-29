import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Circle, Loader2, Play, XCircle } from 'lucide-react';
import { learningApi } from '../../api/admin';
import { apiErrorMessage } from '../../api/client';
import { METRIC_LABELS, fmtMetric, metricDelta } from './adminUtils';

const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const STEP_ICONS = { done: CheckCircle2, failed: XCircle, running: Loader2, pending: Circle };
const STEP_COLORS = {
  done: 'text-emerald-600',
  failed: 'text-[#C62D3B]',
  running: 'text-royal-600',
  pending: 'text-ink-600/50',
};

function Steps({ steps }) {
  return (
    <ol className="space-y-1">
      {steps.map((s) => {
        const Icon = STEP_ICONS[s.status] || Circle;
        return (
          <li key={s.name} className="flex gap-2 text-[11px]">
            <Icon
              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${STEP_COLORS[s.status]} ${s.status === 'running' ? 'animate-spin' : ''}`}
              aria-label={s.status}
            />
            <span className="font-semibold text-royal-900 w-36 shrink-0">
              {s.name.replace(/_/g, ' ')}
            </span>
            <span className="text-ink-600">{s.summary || s.status}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Flags({ flags }) {
  const { t } = useTranslation();
  if (!flags?.length)
    return (
      <p className="text-[11px] text-emerald-700 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.learning.no_flags')}
      </p>
    );
  return (
    <ul className="space-y-1">
      {flags.map((f) => (
        <li
          key={f.metric}
          className={`text-[11px] flex items-start gap-1.5 ${f.severity === 'critical' ? 'text-[#A1202D]' : 'text-[#6B5310]'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <b className="uppercase text-[10px]">{f.severity}</b> {f.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Agent 12: schedule, run-now, feedback collected, cycles with metrics and drift flags. */
export default function LearningTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [runs, setRuns] = useState([]);
  const [retrain, setRetrain] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([learningApi.status(), learningApi.runs()]);
      setStatus(s.data);
      setRuns(r.data.runs);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the learning loop.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const running = status?.running;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [running, load]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Request failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (!status && !error)
    return <p className="text-xs text-ink-600 animate-pulse">{t('common.loading')}</p>;
  const sched = status?.schedule;
  const fb = status?.feedback;

  return (
    <div className="space-y-5 text-xs">
      {error && (
        <p role="alert" className="p-2 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </p>
      )}

      {status && (
        <div className="grid lg:grid-cols-3 gap-3">
          <section className="bg-royal-50 border border-royal-100 rounded-lg p-3 space-y-2">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
              {t('admin.learning.schedule')}
            </h3>
            <p className="text-royal-900 font-semibold">
              {sched.enabled ? t('admin.learning.enabled') : t('admin.learning.disabled')} ·{' '}
              {t('admin.learning.every', { hours: sched.interval_hours })}
            </p>
            {sched.enabled && (
              <p className="text-ink-600">
                {t('admin.learning.next_run', { time: when(sched.next_run_at) })}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => learningApi.updateSchedule({ enabled: !sched.enabled }))}
              className="px-2 py-1 rounded-md border border-line bg-white hover:bg-royal-100 disabled:opacity-50"
            >
              {sched.enabled ? t('admin.users.deactivate') : t('admin.users.activate')}
            </button>
          </section>

          <section className="bg-royal-50 border border-royal-100 rounded-lg p-3 space-y-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
                {t('admin.learning.retrain')}
              </span>
              <select
                value={retrain}
                onChange={(e) => setRetrain(e.target.value)}
                className="border border-line rounded-md px-2 py-1.5 bg-white"
              >
                {['auto', 'always', 'never'].map((m) => (
                  <option key={m} value={m}>
                    {t(`admin.learning.retrain_${m}`)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !!running}
              onClick={() => act(() => learningApi.start(retrain))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {running ? t('admin.learning.running') : t('admin.learning.run_now')}
            </button>
            <div>
              <span className="text-[10px] text-ink-600 block">{t('admin.learning.stale')}</span>
              {status.retrain_reasons.length ? (
                <ul className="list-disc pl-4 text-ink-900">
                  {status.retrain_reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-700">{t('admin.learning.up_to_date')}</p>
              )}
            </div>
          </section>

          <section className="bg-royal-50 border border-royal-100 rounded-lg p-3 space-y-1">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
              {t('admin.learning.feedback')}
            </h3>
            <p>
              Gold set: <b>{fb.gold_set.total}</b> reviewer examples ({fb.gold_set.new} new,{' '}
              {fb.gold_set.rejected} rejections)
            </p>
            {fb.gold_set.most_corrected_fields.length > 0 && (
              <p className="text-ink-600">
                Most corrected:{' '}
                {fb.gold_set.most_corrected_fields.map((f) => `${f.field} (${f.count})`).join(', ')}
              </p>
            )}
            <p>
              Alert ratings:{' '}
              {Object.entries(fb.alerts.by_rule)
                .map(([rule, r]) => `${rule} ${r.useful}/${r.useful + r.not_useful} useful`)
                .join(' · ') || 'none yet'}
            </p>
            {Object.entries(fb.alerts.threshold_offsets).some(([, v]) => v) && (
              <p className="text-ink-600">
                Tuned thresholds:{' '}
                {Object.entries(fb.alerts.threshold_offsets)
                  .filter(([, v]) => v)
                  .map(([rule, v]) => `${rule} +${v}`)
                  .join(', ')}
              </p>
            )}
            <p>
              Advisor answers: {fb.advisor.useful} useful / {fb.advisor.not_useful} not useful
            </p>
          </section>
        </div>
      )}

      {running && (
        <section className="border border-royal-100 rounded-lg p-3" aria-live="polite">
          <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-2">
            {t('admin.learning.running')} · {when(running.started_at)} · {running.trigger}
          </h3>
          <Steps steps={running.steps} />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700">
          {t('admin.learning.runs')}
        </h3>
        {!runs.length && <p className="text-ink-600">{t('admin.learning.no_runs')}</p>}
        {runs
          .filter((r) => r.status !== 'running')
          .map((r, i, done) => {
            const prev = done.slice(i + 1).find((x) => x.status === 'done');
            return (
              <details key={r._id} className="border border-line rounded-lg" open={i === 0}>
                <summary className="px-3 py-2 cursor-pointer flex flex-wrap items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.status === 'done'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="font-semibold text-royal-900">{when(r.started_at)}</span>
                  <span className="text-ink-600">
                    {r.trigger} · {r.requested_by || 'schedule'}
                    {r.retrained ? ' · risk model retrained' : ''}
                  </span>
                  <span
                    className={`ml-auto ${r.flags?.length ? 'text-[#A1202D] font-semibold' : 'text-ink-600'}`}
                  >
                    {r.flags?.length || 0} {t('admin.learning.flags').toLowerCase()}
                  </span>
                </summary>
                <div className="px-3 pb-3 grid lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Steps steps={r.steps} />
                    <Flags flags={r.flags} />
                    {r.error && <p className="text-red-700">{r.error}</p>}
                  </div>
                  {r.metrics && (
                    <table className="w-full text-[11px] self-start">
                      <tbody>
                        {Object.entries(r.metrics).map(([k, v]) => {
                          const d = metricDelta(v, prev?.metrics?.[k]);
                          return (
                            <tr key={k} className="border-b border-line/60">
                              <td className="py-1 pr-2 text-ink-600">{METRIC_LABELS[k] || k}</td>
                              <td className="py-1 text-right font-semibold tabular-nums text-royal-900">
                                {fmtMetric(v)}
                              </td>
                              <td
                                className={`py-1 pl-2 text-right tabular-nums w-16 ${
                                  d == null ? '' : d < 0 ? 'text-[#A1202D]' : 'text-emerald-700'
                                }`}
                              >
                                {d == null || d === 0
                                  ? ''
                                  : `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)} pt`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>
            );
          })}
      </section>
    </div>
  );
}
