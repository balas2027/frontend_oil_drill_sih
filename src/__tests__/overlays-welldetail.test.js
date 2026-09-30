import { describe, expect, it } from 'vitest';
import {
  RING_RADII_KM,
  buildArcs,
  buildBoundaries,
  buildHexbins,
  buildRings,
} from '../components/map/mapOverlays';
import {
  casingIntervals,
  eventsInInterval,
  extent,
  mudIntervals,
  mudWeightProfile,
  scale,
  trajectorySummary,
  withDisplacement,
} from '../components/well/wellDetailUtils';

const CENTER = [95.0, 27.4];

describe('map overlays (item 5)', () => {
  it('builds one ring and one label per radius', () => {
    const { rings, labels } = buildRings(CENTER);
    expect(rings.features).toHaveLength(RING_RADII_KM.length);
    expect(labels.features.map((f) => f.properties.km)).toEqual(RING_RADII_KM);
    // a 5 km ring's first vertex is ~5 km from the centre (0.045 deg of latitude)
    const [, lat] = rings.features[0].geometry.coordinates[0];
    expect(Math.abs(lat - CENTER[1])).toBeGreaterThan(0.04);
  });

  it('returns empty collections without an active well', () => {
    expect(buildRings(null).rings.features).toHaveLength(0);
    expect(buildArcs(null, []).features).toHaveLength(0);
  });

  it('draws a curved arc per offset well carrying its similarity', () => {
    const nearby = [
      { well: { well_id: 'A', location: { coordinates: [95.05, 27.42] } }, similarity: 0.8, distance_km: 5 },
      { well: { well_id: 'B', location: { coordinates: [94.95, 27.38] } }, similarity: 0.4, distance_km: 6 },
      { well: { well_id: 'C' } }, // no location -> skipped
    ];
    const arcs = buildArcs(CENTER, nearby, 10);
    expect(arcs.features).toHaveLength(2);
    const a = arcs.features[0];
    expect(a.properties).toMatchObject({ well_id: 'A', similarity: 0.8 });
    expect(a.geometry.coordinates.length).toBeGreaterThanOrEqual(10);
    // curved: the midpoint is off the straight chord
    const mid = a.geometry.coordinates[Math.floor(a.geometry.coordinates.length / 2)];
    expect(mid).not.toEqual([(95.0 + 95.05) / 2, (27.4 + 27.42) / 2]);
  });

  it('bins events into hexagons with counts and severity weight', () => {
    const pt = (lon, lat, severity) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { severity },
    });
    const geo = {
      type: 'FeatureCollection',
      features: [pt(95.0, 27.4, 3), pt(95.0005, 27.4005, 5), pt(95.2, 27.6, 1)],
    };
    const cells = buildHexbins(geo, 2);
    const counts = cells.features.map((f) => f.properties.count).sort();
    expect(counts).toEqual([1, 2]);
    expect(Math.max(...cells.features.map((f) => f.properties.weight))).toBeGreaterThan(0);
  });

  it('buffers a hull around each block', () => {
    const w = (id, lon, lat) => ({ well_id: id, block: 'B-1', location: { coordinates: [lon, lat] } });
    const b = buildBoundaries([w('1', 95, 27.4), w('2', 95.1, 27.45), w('3', 95.05, 27.5)]);
    expect(b.features).toHaveLength(1);
    expect(['Polygon', 'MultiPolygon']).toContain(b.features[0].geometry.type);
  });
});

describe('well detail helpers (item 3)', () => {
  const surveys = [
    { md: 0, tvd: 0, north: 0, east: 0, inclination: 0 },
    { md: 1000, tvd: 990, north: 30, east: 40, inclination: 12 },
    { md: 2000, tvd: 1800, north: 300, east: 400, inclination: 45 },
  ];

  it('computes displacement and a trajectory summary', () => {
    expect(withDisplacement(surveys)[1].disp).toBe(50);
    expect(trajectorySummary(surveys)).toMatchObject({
      stations: 3,
      max_inc: 45,
      displacement: 500,
      td_md: 2000,
    });
    expect(trajectorySummary([])).toBeNull();
  });

  it('merges mud weights into intervals within tolerance', () => {
    const profile = mudWeightProfile([
      { depth_md: 300, mud_weight_in: 1.1 },
      { depth_md: 100, mud_weight_in: 1.1 },
      { depth_md: 200, mud_weight_in: 1.11 },
      { depth_md: 400, mud_weight_in: 1.3 },
      { depth_md: 500, mud_weight_in: null },
    ]);
    expect(profile.map((p) => p.depth)).toEqual([100, 200, 300, 400]);
    expect(mudIntervals(profile)).toEqual([
      { from: 100, to: 300, mw: 1.1 },
      { from: 400, to: 400, mw: 1.3 },
    ]);
  });

  it('derives the open-hole interval of each casing string', () => {
    const c = casingIntervals([
      { size_in: 9.625, shoe_md: 1900 },
      { size_in: 20, shoe_md: 80 },
    ]);
    expect(c.map((x) => [x.from_md, x.shoe_md])).toEqual([
      [0, 80],
      [80, 1900],
    ]);
  });

  it('finds events overlapping a depth interval', () => {
    const ev = [
      { depth_from_md: 50, depth_to_md: 90 },
      { depth_from_md: 500, depth_to_md: 510 },
    ];
    expect(eventsInInterval(ev, 80, 1900)).toHaveLength(2);
    expect(eventsInInterval(ev, 100, 400)).toHaveLength(0);
  });

  it('pads extents and scales linearly', () => {
    expect(extent([{ v: 1 }, { v: 1 }], 'v', 0)).toEqual([0, 2]);
    expect(extent([], 'v')).toBeNull();
    expect(scale([0, 10], [0, 100])(2.5)).toBe(25);
  });
});
