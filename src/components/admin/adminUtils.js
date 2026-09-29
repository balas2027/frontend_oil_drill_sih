/** Pure helpers for the admin page. */

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
export const METRIC_LABELS = {
  extraction_f1_main: 'Extraction F1 (main set)',
  extraction_f1_challenge: 'Extraction F1 (challenge set)',
  advisor_pass_rate: 'Advisor benchmark pass rate',
  advisor_citation_precision: 'Advisor citation precision',
  risk_event_recall: 'Risk: events warned',
  risk_warning_precision: 'Risk: warning+ precision',
  risk_pr_auc_mud_loss: 'Risk PR-AUC mud loss',
  risk_pr_auc_kick: 'Risk PR-AUC kick',
};

export const fmtMetric = (v) => (v == null ? '—' : Number(v).toFixed(3));

/** Change since the previous cycle (null when either side is missing). */
export function metricDelta(current, previous) {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10000) / 10000;
}
