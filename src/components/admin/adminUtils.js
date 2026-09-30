/** Pure helpers for the admin page. */
import i18n from '../../i18n';

/** Share 0..1 as a percentage with one decimal. */
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 1000) / 10}%`);

/** Compact one-line rendering of an audit entry's details. */
export function detailText(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .map(
      ([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : v}`
    )
    .join(' · ');
}

/** Metrics tracked by the learning loop (backend feedback_agent.snapshot_metrics). */
const METRIC_KEYS = [
  'extraction_f1_main',
  'extraction_f1_challenge',
  'advisor_pass_rate',
  'advisor_citation_precision',
  'risk_event_recall',
  'risk_warning_precision',
  'risk_pr_auc_mud_loss',
  'risk_pr_auc_kick',
];
export const METRIC_LABELS = Object.defineProperties(
  {},
  Object.fromEntries(
    METRIC_KEYS.map((k) => [
      k,
      { enumerable: true, get: () => i18n.t(`admin.metrics.${k}`) },
    ])
  )
);

export const fmtMetric = (v) => (v == null ? '—' : Number(v).toFixed(3));

/** Change since the previous cycle (null when either side is missing). */
export function metricDelta(current, previous) {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10000) / 10000;
}
