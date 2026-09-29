import { useEffect, useState } from 'react';
import { Gauge, Terminal } from 'lucide-react';
import { documentsApi } from '../../api/documents';
import { apiErrorMessage } from '../../api/client';
import { formatEventType } from '../map/eventStyles';

const SET_INFO = {
  main: {
    title: 'Template set',
    note: 'DDRs generated from the same phrase templates the rules were developed against - checks the pipeline end to end.',
  },
  challenge: {
    title: 'Challenge set',
    note: 'Different phrase bank, 1-2 events per report, negated distractors, mixed units and heavily degraded scans - a more realistic estimate.',
  },
};

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

function Bar({ value }) {
  return (
    <div className="h-1.5 bg-royal-100 rounded-full overflow-hidden" aria-hidden="true">
      <div
        className="h-full bg-royal-500 rounded-full"
        style={{ width: `${(value || 0) * 100}%` }}
      />
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-royal-50 border border-royal-100 rounded-lg p-2.5">
      <span className="text-[10px] text-ink-600 block">{label}</span>
      <span className="text-lg font-bold text-royal-900 tabular-nums">{value}</span>
      {sub && <span className="text-[10px] text-ink-600 block tabular-nums">{sub}</span>}
    </div>
  );
}

function EvalCard({ setName, run }) {
  const info = SET_INFO[setName];
  const e = run.events;
  return (
    <section className="border border-line rounded-xl p-4 space-y-3" aria-label={info.title}>
      <div>
        <h3 className="text-sm font-bold text-royal-900">
          {info.title}{' '}
          <span className="text-[11px] font-normal text-ink-600">
            · {run.documents} labelled DDRs (
            {Object.entries(run.documents_by_kind || {})
              .map(([k, n]) => `${n} ${k}`)
              .join(', ')}
            ) · {run.model_version} · {run.ts?.slice(0, 16).replace('T', ' ')}
          </span>
        </h3>
        <p className="text-[11px] text-ink-600">{info.note}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat
          label="Event F1"
          value={e.f1.toFixed(3)}
          sub={`P ${e.precision.toFixed(3)} · R ${e.recall.toFixed(3)}`}
        />
        <Stat
          label="Formation-top F1"
          value={run.formation_tops.tp ? run.formation_tops.f1.toFixed(3) : 'n/a'}
          sub={`${run.formation_tops.tp} matched`}
        />
        <Stat
          label="Auto-accepted"
          value={pct(run.auto_accept.rate)}
          sub={`precision ${pct(run.auto_accept.precision)}`}
        />
        <Stat
          label="Hallucinated values"
          value={run.hallucinated_candidates}
          sub="rejected by evidence check"
        />
      </div>
      <div className="grid md:grid-cols-3 gap-4 text-xs">
        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            By PDF kind
          </h4>
          {Object.entries(run.events_by_kind || {}).map(([k, m]) => (
            <div key={k} className="mb-1.5">
              <div className="flex justify-between capitalize">
                <span>{k}</span>
                <span className="tabular-nums">F1 {m.f1.toFixed(3)}</span>
              </div>
              <Bar value={m.f1} />
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            By event type
          </h4>
          {Object.entries(run.events_by_type || {}).map(([k, m]) => (
            <div key={k} className="flex justify-between capitalize tabular-nums">
              <span>{formatEventType(k)}</span>
              <span>
                F1 {m.f1.toFixed(2)}{' '}
                <span className="text-ink-600">
                  ({m.tp}/{m.tp + m.fn})
                </span>
              </span>
            </div>
          ))}
        </div>
        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
            Field accuracy (matched events)
          </h4>
          {Object.entries(run.field_accuracy || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between tabular-nums">
              <span>{k.replace(/_/g, ' ')}</span>
              <span>{pct(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function EvaluationTab() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    documentsApi
      .metrics()
      .then((res) => setMetrics(res.data))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load metrics.')));
  }, []);

  if (error)
    return (
      <p className="m-4 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
        {error}
      </p>
    );
  if (!metrics) return <p className="p-6 text-xs text-ink-600 animate-pulse">Loading metrics…</p>;

  const items = metrics.review_items || {};
  const evals = metrics.evaluations || {};

  return (
    <div className="p-4 space-y-4">
      <section aria-label="Live pipeline">
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-2 flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5" aria-hidden="true" /> Live pipeline (uploaded documents)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat
            label="Documents"
            value={Object.values(metrics.documents || {}).reduce((a, b) => a + b, 0)}
          />
          <Stat
            label="Auto-accepted items"
            value={items.auto_accepted || 0}
            sub={`rate ${pct(metrics.auto_accept_rate)}`}
          />
          <Stat label="Pending review" value={items.pending || 0} />
          <Stat
            label="Approved / rejected"
            value={`${items.approved || 0} / ${items.rejected || 0}`}
          />
          <Stat label="Gold-set corrections" value={metrics.gold_set_size ?? 0} />
        </div>
      </section>

      {['challenge', 'main'].map((s) =>
        evals[s] ? <EvalCard key={s} setName={s} run={evals[s]} /> : null
      )}

      <div className="text-[11px] text-ink-600 bg-slate-50 border border-line rounded-lg p-3 space-y-1">
        <p className="flex items-center gap-1 font-semibold text-royal-900">
          <Terminal className="w-3.5 h-3.5" aria-hidden="true" /> Re-run the evaluation (backend
          folder)
        </p>
        <code className="block font-mono">
          python scripts/evaluate_extraction.py --set main --store
        </code>
        <code className="block font-mono">
          python scripts/evaluate_extraction.py --set challenge --store
        </code>
        <p>
          All figures are on synthetic demo documents. Real extraction quality must be measured on
          OIL&apos;s own WCR/DDR reports; reviewer corrections accumulate in the gold set for that
          purpose.
        </p>
      </div>
    </div>
  );
}
