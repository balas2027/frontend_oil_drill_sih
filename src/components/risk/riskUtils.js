/** Pure helpers for the Risk & Alerts page (no DOM). Mirrors the backend risk engine.
 * Labels are getters so they always follow the current UI language. */
import i18n from '../../i18n';

const tr = (key) => i18n.t(key);

/** Risk types in display order, with a one-letter code so cells never rely on colour alone. */
export const RISK_TYPES = [
  { key: 'mud_loss', code: 'L', get label() { return tr('risk_types.mud_loss'); } },
  { key: 'kick', code: 'K', get label() { return tr('risk_types.kick'); } },
  { key: 'stuck_pipe', code: 'S', get label() { return tr('risk_types.stuck_pipe'); } },
  { key: 'torque_spike', code: 'T', get label() { return tr('risk_types.torque_spike'); } },
  { key: 'wellbore_instability', code: 'W', get label() { return tr('risk_types.wellbore_instability'); } },
  { key: 'cementing_issue', code: 'C', get label() { return tr('risk_types.cementing_issue'); } },
];

export const riskLabel = (key) => RISK_TYPES.find((t) => t.key === key)?.label || key;

/** Risk scale (Section 9): colour + icon + label. Thresholds match risk_service.RISK_LEVELS. */
export const RISK_LEVELS = [
  {
    key: 'critical',
    min: 0.75,
    get label() {
      return tr('risk_levels.critical');
    },
    color: '#C62D3B',
    bg: '#FDECEE',
    icon: 'octagon',
  },
  { key: 'high', get label() { return tr('risk_levels.high'); }, min: 0.5, color: '#E8871E', bg: '#FDF1E4', icon: 'triangle' },
  { key: 'watch', get label() { return tr('risk_levels.watch'); }, min: 0.3, color: '#E0A100', bg: '#FBF3D6', icon: 'eye' },
  { key: 'low', get label() { return tr('risk_levels.low'); }, min: 0, color: '#1E8E5A', bg: '#E7F5EE', icon: 'check' },
];

export function levelFor(p) {
  return RISK_LEVELS.find((l) => (p ?? 0) >= l.min) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

/** Alert levels (Section 4 alerts.level), lowest first. */
export const ALERT_LEVELS = {
  info: { rank: 0, get label() { return tr('alert_levels.info'); }, color: '#1D4FB8', bg: '#E6EEFB' },
  watch: { rank: 1, get label() { return tr('alert_levels.watch'); }, color: '#E0A100', bg: '#FBF3D6' },
  warning: { rank: 2, get label() { return tr('alert_levels.warning'); }, color: '#E8871E', bg: '#FDF1E4' },
  critical: { rank: 3, get label() { return tr('alert_levels.critical'); }, color: '#C62D3B', bg: '#FDECEE' },
};

export const alertLevel = (key) => ALERT_LEVELS[key] || ALERT_LEVELS.info;

export const ALERT_STATUS_LABELS = {
  get open() { return tr('risk.alert_status.open'); },
  get ack() { return tr('risk.alert_status.ack'); },
  get resolved() { return tr('risk.alert_status.resolved'); },
  get dismissed() { return tr('risk.alert_status.dismissed'); },
};

export const RULE_LABELS = {
  get offset_lookahead() { return tr('risk.rules.offset_lookahead'); },
  get fused_risk() { return tr('risk.rules.fused_risk'); },
  get live_anomaly() { return tr('risk.rules.live_anomaly'); },
};

export const fmtPct = (p) => (p == null ? '—' : `${Math.round(p * 100)}%`);

/** Insert or replace alerts by _id; newest first. */
export function mergeAlerts(current, incoming) {
  const byId = new Map((current || []).map((a) => [a._id, a]));
  for (const a of incoming || []) byId.set(a._id, { ...byId.get(a._id), ...a });
  return [...byId.values()].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/** Append live records (shallow -> deep), drop repeats of a depth, keep the last `max`. */
export function appendRecords(current, batch, max = 200) {
  const out = [...(current || [])];
  const lastDepth = () => (out.length ? out[out.length - 1].depth_md : -Infinity);
  for (const r of batch || []) {
    if (r.depth_md > lastDepth()) out.push(r);
  }
  return out.slice(-max);
}

/** Exponential reconnect delay with optional jitter (0..1 fraction of the delay). */
export function backoffDelay(attempt, { base = 1000, max = 30000, jitter = 0 } = {}) {
  const d = Math.min(max, base * 2 ** Math.max(0, attempt));
  return Math.round(d * (1 - jitter / 2 + Math.random() * jitter));
}

/** Derived live series for the mini charts. */
export const PARAM_SERIES = [
  { key: 'torque', get label() { return tr('params.torque'); }, unit: 'kN·m', color: '#7C3AED', value: (r) => r.torque },
  { key: 'spp', get label() { return tr('params.spp'); }, unit: 'psi', color: '#0A2A66', value: (r) => r.spp },
  {
    key: 'flow_delta',
    get label() {
      return tr('params.flow_delta');
    },
    unit: 'gpm',
    color: '#E8871E',
    value: (r) => (r.flow_out != null && r.flow_in != null ? r.flow_out - r.flow_in : null),
  },
  {
    key: 'pit_volume',
    get label() {
      return tr('params.pit_volume');
    },
    unit: 'bbl',
    color: '#C62D3B',
    value: (r) => r.pit_volume,
  },
  { key: 'gas_units', get label() { return tr('params.gas_units'); }, unit: 'units', color: '#C9A227', value: (r) => r.gas_units },
];

/** Polyline points (viewBox 0..100 x 0..h) for a series against depth. */
export function sparkPoints(records, value, h = 40) {
  const pts = (records || [])
    .map((r) => [r.depth_md, value(r)])
    .filter(([d, v]) => d != null && v != null);
  if (pts.length < 2) return { points: '', min: null, max: null, last: pts[0]?.[1] ?? null };
  const ds = pts.map((p) => p[0]);
  const vs = pts.map((p) => p[1]);
  const [d0, d1] = [Math.min(...ds), Math.max(...ds)];
  let [lo, hi] = [Math.min(...vs), Math.max(...vs)];
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const points = pts
    .map(([d, v]) => {
      const x = d1 === d0 ? 0 : ((d - d0) / (d1 - d0)) * 100;
      const y = h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return { points, min: lo, max: hi, last: vs[vs.length - 1] };
}

/** Driver bars: signed SHAP contributions scaled to the largest magnitude (percent). */
export function driverBars(drivers) {
  const maxAbs = Math.max(1e-9, ...(drivers || []).map((d) => Math.abs(d.contribution)));
  return (drivers || []).map((d) => ({
    ...d,
    width: Math.round((Math.abs(d.contribution) / maxAbs) * 100),
    raises: d.contribution > 0,
  }));
}

/** Ribbon bin that contains a depth. */
export function binAt(ribbon, depth) {
  return (ribbon || []).find((b) => depth >= b.from && depth < b.to) || null;
}
