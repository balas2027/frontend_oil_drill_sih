import { describe, it, expect } from 'vitest';
import {
  ALERT_LEVELS,
  RISK_TYPES,
  appendRecords,
  backoffDelay,
  binAt,
  driverBars,
  fmtPct,
  levelFor,
  mergeAlerts,
  sparkPoints,
  PARAM_SERIES,
} from '../components/risk/riskUtils';

describe('risk scale', () => {
  it('matches the backend thresholds and always carries a label', () => {
    expect([0, 0.29, 0.3, 0.5, 0.75, 1].map((p) => levelFor(p).key)).toEqual([
      'low',
      'low',
      'watch',
      'high',
      'critical',
      'critical',
    ]);
    expect(levelFor(null).key).toBe('low');
    RISK_TYPES.forEach((t) => expect(t.code).toMatch(/^[A-Z]$/));
    expect(new Set(RISK_TYPES.map((t) => t.code)).size).toBe(RISK_TYPES.length);
    expect(Object.values(ALERT_LEVELS).map((l) => l.rank)).toEqual([0, 1, 2, 3]);
    expect(fmtPct(0.456)).toBe('46%');
    expect(fmtPct(null)).toBe('—');
  });
});

describe('alert merging', () => {
  it('upserts by id and keeps newest first', () => {
    const cur = [
      { _id: 'a', ts: '2026-01-01T10:00:00', status: 'open' },
      { _id: 'b', ts: '2026-01-01T09:00:00', status: 'open' },
    ];
    const out = mergeAlerts(cur, [
      { _id: 'b', ts: '2026-01-01T09:00:00', status: 'ack' },
      { _id: 'c', ts: '2026-01-01T11:00:00', status: 'open' },
    ]);
    expect(out.map((a) => a._id)).toEqual(['c', 'a', 'b']);
    expect(out.find((a) => a._id === 'b').status).toBe('ack');
  });
});

describe('live records', () => {
  it('appends deeper records only and caps the buffer', () => {
    const cur = [{ depth_md: 10 }, { depth_md: 12 }];
    const out = appendRecords(cur, [{ depth_md: 12 }, { depth_md: 14 }, { depth_md: 16 }], 3);
    expect(out.map((r) => r.depth_md)).toEqual([12, 14, 16]);
    expect(appendRecords(null, [{ depth_md: 1 }])).toHaveLength(1);
  });

  it('builds sparkline points against depth, including derived flow delta', () => {
    const recs = [
      { depth_md: 100, flow_in: 700, flow_out: 695 },
      { depth_md: 102, flow_in: 700, flow_out: 690 },
      { depth_md: 104, flow_in: 700, flow_out: 700 },
    ];
    const flow = PARAM_SERIES.find((s) => s.key === 'flow_delta');
    const sp = sparkPoints(recs, flow.value, 40);
    expect(sp.min).toBe(-10);
    expect(sp.max).toBe(0);
    expect(sp.last).toBe(0);
    const pts = sp.points.split(' ').map((p) => p.split(',').map(Number));
    expect(pts[0][0]).toBe(0);
    expect(pts[2][0]).toBe(100);
    expect(pts[1][1]).toBeCloseTo(38); // the lowest value sits at the bottom
    expect(sparkPoints([recs[0]], flow.value).points).toBe('');
  });
});

describe('reconnect backoff', () => {
  it('doubles up to the cap', () => {
    expect([0, 1, 2, 3].map((a) => backoffDelay(a))).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffDelay(20)).toBe(30000);
    const jittered = backoffDelay(2, { jitter: 0.5 });
    expect(jittered).toBeGreaterThanOrEqual(3000);
    expect(jittered).toBeLessThanOrEqual(5000);
  });
});

describe('drivers and ribbon', () => {
  it('scales signed SHAP bars to the largest contribution', () => {
    const bars = driverBars([
      { feature: 'anomaly', contribution: 2 },
      { feature: 'prior_ahead', contribution: -1 },
    ]);
    expect(bars.map((b) => [b.width, b.raises])).toEqual([
      [100, true],
      [50, false],
    ]);
    expect(driverBars([])).toEqual([]);
  });

  it('finds the bin containing a depth', () => {
    const ribbon = [
      { from: 100, to: 110 },
      { from: 110, to: 120 },
    ];
    expect(binAt(ribbon, 110).from).toBe(110);
    expect(binAt(ribbon, 120)).toBeNull();
  });
});
