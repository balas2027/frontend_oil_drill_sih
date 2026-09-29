/** Review form helpers: item values (canonical units) <-> editable form, and the
 * minimal set of edits sent to POST /review/{id}/approve (saved to the gold set). */

const NUMERIC = new Set([
  'severity',
  'depth_from_md',
  'depth_to_md',
  'mud_weight',
  'volume_lost_bbl',
  'npt_hours',
  'top_md',
  'base_md',
]);

export function initialForm(item) {
  const v = item.values || {};
  if (item.kind === 'formation_top') {
    return {
      formation: v.formation ?? '',
      top_md: v.top_md ?? '',
      base_md: v.base_md ?? '',
      lithology: v.lithology ?? '',
    };
  }
  return {
    type: v.type ?? '',
    severity: v.severity ?? 3,
    depth_from_md: v.depth_from_md ?? '',
    depth_to_md: v.depth_to_md ?? '',
    formation: v.formation ?? '',
    mud_weight: v.drilling_context?.mud_weight ?? '',
    volume_lost_bbl: v.impact?.volume_lost_bbl ?? '',
    npt_hours: v.impact?.npt_hours ?? '',
    mitigation: v.mitigation ?? '',
    outcome: v.outcome ?? '',
  };
}

/** Changed, non-empty fields only; numbers are sent as numbers. */
export function formEdits(initial, current) {
  const edits = {};
  for (const [k, v] of Object.entries(current)) {
    if (String(v) === String(initial[k])) continue;
    if (v === '' || v == null) continue;
    edits[k] = NUMERIC.has(k) ? Number(v) : v;
  }
  return edits;
}
