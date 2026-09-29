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
