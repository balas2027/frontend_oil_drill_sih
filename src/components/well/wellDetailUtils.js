/** Pure helpers for the Well Detail page (no DOM). */

export const WELL_TABS = ['overview', 'tops', 'events', 'casing', 'mud', 'trajectory', 'documents'];

/** Horizontal displacement from the wellhead (m) for each survey station. */
export function withDisplacement(surveys) {
  return (surveys || []).map((s) => ({
    ...s,
    disp: Math.hypot(s.north || 0, s.east || 0),
  }));
}

/** Min/max of a numeric field, padded so a flat line still gets a visible range. */
export function extent(rows, key, pad = 0.05) {
  const vals = (rows || []).map((r) => r[key]).filter((v) => v != null && !Number.isNaN(v));
  if (!vals.length) return null;
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

/** Linear scale factory: domain -> range. */
export const scale =
  ([d0, d1], [r0, r1]) =>
  (v) =>
    d1 === d0 ? r0 : r0 + ((v - d0) * (r1 - r0)) / (d1 - d0);

/** SVG polyline points string from rows. */
export const polyline = (rows, x, y, xKey, yKey) =>
  rows
    .filter((r) => r[xKey] != null && r[yKey] != null)
    .map((r) => `${x(r[xKey]).toFixed(1)},${y(r[yKey]).toFixed(1)}`)
    .join(' ');

/** Mud-weight samples vs depth from drilling records (drops gaps, keeps order by depth). */
export function mudWeightProfile(records) {
  return (records || [])
    .filter((r) => r.depth_md != null && r.mud_weight_in != null)
    .map((r) => ({ depth: r.depth_md, mw: r.mud_weight_in }))
    .sort((a, b) => a.depth - b.depth);
}

/**
 * Mud-weight intervals: consecutive samples whose weight stays within `tol`
 * sg are merged, so the programme reads like a table (from, to, weight).
 */
export function mudIntervals(profile, tol = 0.02) {
  const out = [];
  for (const p of profile || []) {
    const last = out[out.length - 1];
    if (last && Math.abs(p.mw - last.mw) <= tol) {
      last.to = p.depth;
      last.n += 1;
      last.sum += p.mw;
      last.mw = Math.round((last.sum / last.n) * 100) / 100;
    } else {
      out.push({ from: p.depth, to: p.depth, mw: p.mw, sum: p.mw, n: 1 });
    }
  }
  return out.map(({ from, to, mw }) => ({ from, to, mw }));
}

/** Casing strings with the open-hole interval each one covers (previous shoe -> this shoe). */
export function casingIntervals(casing) {
  const sorted = [...(casing || [])].sort((a, b) => (a.shoe_md || 0) - (b.shoe_md || 0));
  return sorted.map((c, i) => ({ ...c, from_md: i ? sorted[i - 1].shoe_md || 0 : 0 }));
}

/** Events within [from, to] m MD (overlap test). */
export const eventsInInterval = (events, from, to) =>
  (events || []).filter((e) => e.depth_from_md <= to && (e.depth_to_md ?? e.depth_from_md) >= from);

/** Maximum inclination and final displacement for the trajectory summary. */
export function trajectorySummary(surveys) {
  const rows = withDisplacement(surveys);
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  return {
    stations: rows.length,
    max_inc: Math.max(...rows.map((r) => r.inclination || 0)),
    displacement: last.disp,
    td_md: last.md,
    td_tvd: last.tvd,
  };
}
