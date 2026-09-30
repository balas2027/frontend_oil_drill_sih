import i18n from '../../i18n';
import { Check, Loader2, X, Circle } from 'lucide-react';
import { PIPELINE_STEPS } from '../../api/documents';

const STEP_STYLE = {
  done: { icon: Check, cls: 'bg-emerald-600 text-white border-emerald-600', get label() { return i18n.t('pipeline.done'); } },
  running: { icon: Loader2, cls: 'bg-gold-100 text-[#6B5310] border-gold-500', get label() { return i18n.t('pipeline.running'); } },
  failed: { icon: X, cls: 'bg-red-600 text-white border-red-600', get label() { return i18n.t('pipeline.failed'); } },
  pending: { icon: Circle, cls: 'bg-white text-ink-600/40 border-line', get label() { return i18n.t('pipeline.pending'); } },
};

/** OCR -> Extraction -> Normalise -> Validate -> Index progress (Section 10.8). */
export function PipelineStepper({ steps, compact = false }) {
  const byAgent = Object.fromEntries((steps || []).map((s) => [s.agent, s]));
  return (
    <ol className="flex items-center gap-0.5" aria-label={i18n.t('pipeline.aria')}>
      {PIPELINE_STEPS.map(({ agent }, i) => {
        const label = i18n.t(`pipeline.${agent}`);
        const status = byAgent[agent]?.status || 'pending';
        const st = STEP_STYLE[status] || STEP_STYLE.pending;
        const Icon = st.icon;
        return (
          <li key={agent} className="flex items-center gap-0.5" title={`${label}: ${st.label}`}>
            <span
              className={`inline-flex items-center gap-1 rounded-full border ${st.cls} ${compact ? 'p-0.5' : 'px-1.5 py-0.5'}`}
            >
              <Icon
                className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {!compact && <span className="text-[10px] font-medium">{label}</span>}
              <span className="sr-only">
                {label} {st.label}
              </span>
            </span>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className="w-2 h-px bg-line" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const DOC_STATUS = {
  queued: 'bg-slate-100 text-ink-600 border-line',
  processing: 'bg-gold-100 text-[#6B5310] border-gold-500/40',
  review: 'bg-orange-50 text-orange-800 border-orange-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

export function DocStatusChip({ status }) {
  const label = i18n.t(`doc_status.${status}`, { defaultValue: status });
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold capitalize ${DOC_STATUS[status] || DOC_STATUS.queued}`}
    >
      {label}
    </span>
  );
}

const ITEM_STATUS = {
  pending: 'bg-orange-50 text-orange-800 border-orange-200',
  auto_accepted: 'bg-royal-50 text-royal-700 border-royal-100',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export function ItemStatusChip({ status }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${ITEM_STATUS[status] || ''}`}
    >
      {i18n.t(`item_status.${status}`, { defaultValue: (status || '').replace('_', ' ') })}
    </span>
  );
}

/** Confidence with colour + label (never colour alone). */
export function ConfidenceBadge({ value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const [cls, word] =
    value >= 0.85
      ? ['bg-emerald-50 text-emerald-800 border-emerald-200', 'high']
      : value >= 0.6
        ? ['bg-gold-100 text-[#6B5310] border-gold-500/40', 'medium']
        : ['bg-red-50 text-red-700 border-red-200', 'low'];
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums ${cls}`}
      title={i18n.t('confidence.label', { level: i18n.t(`confidence.${word}`) })}
    >
      {pct}% {i18n.t(`confidence.${word}`)}
    </span>
  );
}
