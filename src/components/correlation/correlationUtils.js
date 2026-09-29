/** Pure helpers for the depth-correlation chart (no DOM). */

export const ALIGN_OPTIONS = [
  {
    key: 'formation',
    label: 'Formation',
    hint: 'Offsets stretched so shared formation tops line up',
  },
  { key: 'tvd', label: 'TVD', hint: 'True vertical depth from surveys' },
  { key: 'md', label: 'MD', hint: 'Each well on its own measured depth' },
];

/** Parameter tracks shown per well in the correlation chart. */
export const TRACKS = {
  mw: { label: 'MW', unit: 'sg', color: '#0A2A66', digits: 2 },
  rop: { label: 'ROP', unit: 'm/h', color: '#1D4FB8', digits: 0 },
  torque: { label: 'Torque', unit: 'kN·m', color: '#7C3AED', digits: 0 },
};

/** Vertical geometry of the chart body: depth (m) <-> y (px). */
const CHART_PAD_TOP = 10;
export const yForDepth = (d, ppm) => CHART_PAD_TOP + d * ppm;
export const depthForY = (y, ppm) => (y - CHART_PAD_TOP) / ppm;

/** Short code per event type, so markers never rely on colour alone. */
export const EVENT_CODES = {
  mud_loss: 'L',
  kick: 'K',
  stuck_pipe: 'S',
  torque_spike: 'T',
  overpressure: 'O',
  cementing_issue: 'C',
  fishing: 'F',
  wellbore_instability: 'W',
  npt: 'N',
  other: '?',
};

/** Risk scale for the share of wells with events in a bin (colour + label). */
export const RATIO_STOPS = [
  { min: 0, color: '#1E8E5A', label: 'Low' },
  { min: 0.25, color: '#E0A100', label: 'Watch' },
  { min: 0.5, color: '#E8871E', label: 'High' },
  { min: 0.75, color: '#C62D3B', label: 'Critical' },
];

export function ratioStop(ratio) {
  return [...RATIO_STOPS].reverse().find((s) => ratio >= s.min) || RATIO_STOPS[0];
}

/**
 * Convert a depth on the aligned axis back to a well's own MD using its
 * mapping control points [[md, aligned], ...]. Returns null outside the
 * drilled interval (above surface / below TD).
 */
export function mdAtDepth(mapping, depth) {
  if (!mapping?.length || depth == null) return null;
  const first = mapping[0];
  const last = mapping[mapping.length - 1];
  if (depth < first[1] || depth > last[1]) return null;
  for (let i = 1; i < mapping.length; i += 1) {
    const [m1, d1] = mapping[i - 1];
    const [m2, d2] = mapping[i];
    if (depth <= d2) {
      return d2 === d1 ? m1 : m1 + ((depth - d1) * (m2 - m1)) / (d2 - d1);
    }
  }
  return last[0];
}

/** Formation of a well at an aligned depth, from its aligned tops. */
export function formationAtDepth(tops, depth, tdAligned) {
  const sorted = [...(tops || [])].filter((t) => t.top != null).sort((a, b) => a.top - b.top);
  for (let i = 0; i < sorted.length; i += 1) {
    const base = sorted[i].base ?? sorted[i + 1]?.top ?? tdAligned;
    if (depth >= sorted[i].top && (base == null || depth < base)) return sorted[i].formation;
  }
  return null;
}

/** Aligned [top, base] bands for the formation column (base falls back to next top / TD). */
export function formationBands(tops, tdAligned) {
  const sorted = [...(tops || [])].filter((t) => t.top != null).sort((a, b) => a.top - b.top);
  return sorted.map((t, i) => {
    let base = t.base ?? sorted[i + 1]?.top ?? tdAligned ?? t.top;
    if (tdAligned != null) base = Math.min(base, tdAligned);
    return { formation: t.formation, top: t.top, base: Math.max(base, t.top), md: t.top_md };
  });
}

/** Round step for about `target` ticks between 0 and max. */
export function depthTicks(max, target = 10) {
  if (!(max > 0)) return [0];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw);
  const ticks = [];
  for (let d = 0; d <= max + 1e-6; d += step) ticks.push(Math.round(d));
  return ticks;
}

/** Shared [min, max] of a parameter across every well (so tracks are comparable). */
export function valueDomain(wells, key, extraKey) {
  const values = [];
  for (const w of wells || []) {
    for (const p of w.params || []) if (p[key] != null) values.push(p[key]);
    if (extraKey) for (const p of w[extraKey] || []) if (p[key] != null) values.push(p[key]);
  }
  if (!values.length) return null;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

/** Parameter sample nearest to an aligned depth (within maxGap metres). */
export function paramAtDepth(params, depth, maxGap) {
  let best = null;
  for (const p of params || []) {
    if (p.d == null) continue;
    const gap = Math.abs(p.d - depth);
    if (gap <= maxGap && (!best || gap < Math.abs(best.d - depth))) best = p;
  }
  return best;
}

/** Formations whose top is present in both wells (for correlation lines). */
export function sharedTops(a, b) {
  const tb = new Map((b?.tops || []).filter((t) => t.top != null).map((t) => [t.formation, t]));
  return (a?.tops || [])
    .filter((t) => t.top != null && tb.has(t.formation))
    .map((t) => ({ formation: t.formation, left: t.top, right: tb.get(t.formation).top }));
}

/**
 * Section of a 3D well path ([x, y, tvd, md] points) between two MDs, with
 * interpolated end points. Below the last station the path continues straight
 * down (same convention as the backend's position_at_md).
 */
export function pathBetween(path, mdFrom, mdTo) {
  if (!path?.length) return [];
  const at = (md) => {
    const last = path[path.length - 1];
    if (md >= last[3]) return [last[0], last[1], last[2] + (md - last[3]), md];
    if (md <= path[0][3]) return [...path[0].slice(0, 3), md];
    const i = path.findIndex((p) => p[3] >= md);
    const [a, b] = [path[i - 1], path[i]];
    const t = b[3] === a[3] ? 0 : (md - a[3]) / (b[3] - a[3]);
    return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t).concat(md);
  };
  const inside = path.filter((p) => p[3] > mdFrom && p[3] < mdTo);
  return [at(mdFrom), ...inside, at(mdTo)];
}

export const fmtDepth = (d) => (d == null ? '—' : `${Math.round(d).toLocaleString('en-IN')} m`);
