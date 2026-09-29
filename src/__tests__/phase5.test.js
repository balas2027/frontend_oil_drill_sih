import { describe, it, expect, beforeEach } from 'vitest';
import {
  EVENT_CODES,
  depthForY,
  depthTicks,
  formationAtDepth,
  formationBands,
  mdAtDepth,
  paramAtDepth,
  pathBetween,
  ratioStop,
  sharedTops,
  valueDomain,
  yForDepth,
} from '../components/correlation/correlationUtils';
import { EVENT_TYPE_COLORS } from '../components/map/eventStyles';
import { useMapStore, MAX_CORRELATION_WELLS } from '../store/mapStore';

// Offset aligned on formation tops: its Tipam top (550 m MD) sits at 500 m on the reference axis
const mapping = [
  [0, 0],
  [550, 500],
  [1550, 1500],
  [2050, 2000],
];
const tops = [
  { formation: 'Alluvium', top: 0, base: 80, top_md: 0 },
  { formation: 'Tipam', top: 500, base: null, top_md: 550 },
  { formation: 'Girujan', top: 1500, base: 2100, top_md: 1550 },
];

describe('correlation depth helpers', () => {
  it('converts an aligned depth back to the well MD, null below TD', () => {
    expect(mdAtDepth(mapping, 250)).toBeCloseTo(275);
    expect(mdAtDepth(mapping, 1000)).toBeCloseTo(1050);
    expect(mdAtDepth(mapping, 2000)).toBe(2050);
    expect(mdAtDepth(mapping, 2001)).toBeNull();
    expect(mdAtDepth([], 10)).toBeNull();
  });

  it('finds the formation at a depth using next top or TD as a missing base', () => {
    expect(formationAtDepth(tops, 40, 2000)).toBe('Alluvium');
    expect(formationAtDepth(tops, 90, 2000)).toBeNull(); // gap between Alluvium base and Tipam
    expect(formationAtDepth(tops, 900, 2000)).toBe('Tipam');
    expect(formationAtDepth(tops, 1600, 2000)).toBe('Girujan');
  });

  it('builds formation bands clipped to TD', () => {
    const bands = formationBands(tops, 2000);
    expect(bands.map((b) => [b.formation, b.top, b.base])).toEqual([
      ['Alluvium', 0, 80],
      ['Tipam', 500, 1500],
      ['Girujan', 1500, 2000],
    ]);
  });

  it('pairs formation tops present in both wells', () => {
    const other = {
      tops: [
        { formation: 'Tipam', top: 520 },
        { formation: 'Barail', top: 2400 },
      ],
    };
    expect(sharedTops({ tops }, other)).toEqual([{ formation: 'Tipam', left: 500, right: 520 }]);
  });

  it('makes round depth ticks and maps depth <-> pixels', () => {
    expect(depthTicks(4000, 8)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]);
    expect(depthTicks(0)).toEqual([0]);
    expect(depthForY(yForDepth(1234, 0.2), 0.2)).toBeCloseTo(1234);
  });

  it('shares a padded value domain across wells, including event markers', () => {
    const wells = [
      { params: [{ mw: 1.1 }, { mw: 1.3 }], mw_points: [{ mw: 1.5 }] },
      { params: [{ mw: null }] },
    ];
    const [lo, hi] = valueDomain(wells, 'mw', 'mw_points');
    expect(lo).toBeLessThan(1.1);
    expect(hi).toBeGreaterThan(1.5);
    expect(valueDomain(wells, 'rop')).toBeNull();
  });

  it('picks the nearest parameter sample within the bin', () => {
    const params = [
      { d: 100, rop: 10 },
      { d: 110, rop: 20 },
    ];
    expect(paramAtDepth(params, 108, 10).rop).toBe(20);
    expect(paramAtDepth(params, 200, 10)).toBeNull();
  });

  it('cuts a 3D path between two MDs and extends below the last station', () => {
    const path = [
      [0, 0, 0, 0],
      [0, 0, 100, 100],
      [10, 0, 190, 200],
    ];
    const seg = pathBetween(path, 50, 150);
    expect(seg[0]).toEqual([0, 0, 50, 50]);
    expect(seg[1]).toEqual([0, 0, 100, 100]);
    expect(seg[2]).toEqual([5, 0, 145, 150]);
    expect(pathBetween(path, 250, 260)[1]).toEqual([10, 0, 250, 260]);
  });

  it('labels every event type and grades the event share', () => {
    Object.keys(EVENT_TYPE_COLORS).forEach((t) => expect(EVENT_CODES[t]).toBeTruthy());
    expect(ratioStop(0).label).toBe('Low');
    expect(ratioStop(0.5).label).toBe('High');
    expect(ratioStop(1).label).toBe('Critical');
  });
});

describe('correlation well set', () => {
  beforeEach(() => useMapStore.setState({ correlationWellIds: [] }));

  it('replaces the set, de-duplicated and capped, and persists it', () => {
    const ids = ['A', 'B', 'A', 'C', 'D', 'E', 'F', 'G'];
    useMapStore.getState().setCorrelationWells(ids);
    const stored = useMapStore.getState().correlationWellIds;
    expect(stored).toEqual(['A', 'B', 'C', 'D', 'E'].slice(0, MAX_CORRELATION_WELLS));
    expect(JSON.parse(localStorage.getItem('nwis_correlation_wells'))).toEqual(stored);
  });
});
