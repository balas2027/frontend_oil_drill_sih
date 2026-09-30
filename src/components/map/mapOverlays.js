/**
 * Pure GeoJSON builders for the analysis overlays on the well map
 * (Development Guide Section 8B-C/B and 10.3): distance rings, offset arcs,
 * event-density hex bins and field/block boundaries. No DOM, no map - testable.
 */
import * as turf from '@turf/turf';

const EMPTY = { type: 'FeatureCollection', features: [] };
export const RING_RADII_KM = [5, 10, 20];
export const HEX_CELL_KM = 2;

/** Isochrone-style rings (5/10/20 km) around the active well, with label points. */
export function buildRings(center, radii = RING_RADII_KM) {
  if (!center) return { rings: EMPTY, labels: EMPTY };
  const rings = radii.map((km) => {
    const c = turf.circle(center, km, { units: 'kilometers', steps: 96 });
    return turf.lineString(c.geometry.coordinates[0], { km });
  });
  const labels = radii.map((km) =>
    turf.destination(turf.point(center), km, 0, { units: 'kilometers', properties: { km, label: `${km} km` } })
  );
  return { rings: turf.featureCollection(rings), labels: turf.featureCollection(labels) };
}

/**
 * Curved arcs from the active well to each offset well; `similarity` drives width.
 * A quadratic Bezier bulging to the right of the chord keeps arcs distinguishable.
 */
export function buildArcs(center, nearby, steps = 24) {
  if (!center) return EMPTY;
  const features = [];
  for (const r of nearby || []) {
    const to = r.well?.location?.coordinates;
    if (!to) continue;
    const [x0, y0] = center;
    const [x1, y1] = to;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    // perpendicular offset proportional to the chord length
    const cx = mx - (y1 - y0) * 0.2;
    const cy = my + (x1 - x0) * 0.2;
    const coords = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const a = (1 - t) ** 2;
      const b = 2 * (1 - t) * t;
      const c = t ** 2;
      coords.push([a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1]);
    }
    features.push(
      turf.lineString(coords, {
        well_id: r.well.well_id,
        similarity: r.similarity ?? 0,
        distance_km: r.distance_km,
      })
    );
  }
  return turf.featureCollection(features);
}

/**
 * Hex grid (cellKm) over the events, each cell scored by severity-weighted
 * event count. Empty cells are dropped. `eventsGeo` is /events/geo output.
 */
export function buildHexbins(eventsGeo, cellKm = HEX_CELL_KM) {
  const pts = (eventsGeo?.features || []).filter((f) => f.geometry?.coordinates);
  if (!pts.length) return EMPTY;
  const bbox = turf.bbox(turf.buffer(turf.featureCollection(pts), cellKm, { units: 'kilometers' }));
  const grid = turf.hexGrid(bbox, cellKm, { units: 'kilometers' });
  const cells = [];
  for (const cell of grid.features) {
    let count = 0;
    let weight = 0;
    for (const p of pts) {
      if (turf.booleanPointInPolygon(p, cell)) {
        count += 1;
        weight += p.properties?.severity || 1;
      }
    }
    if (count) cells.push({ ...cell, properties: { count, weight } });
  }
  return turf.featureCollection(cells);
}

/**
 * Field / block outline derived from the well locations (convex hull buffered
 * by bufferKm). Labelled as derived - replace with licence-area GeoJSON when available.
 */
export function buildBoundaries(wells, bufferKm = 2) {
  const byBlock = {};
  for (const w of wells || []) {
    if (!w.location?.coordinates) continue;
    const key = w.block || w.field || 'Field';
    (byBlock[key] ||= []).push(turf.point(w.location.coordinates));
  }
  const features = [];
  for (const [name, points] of Object.entries(byBlock)) {
    const fc = turf.featureCollection(points);
    const hull = points.length >= 3 ? turf.convex(fc) : turf.envelope(fc);
    if (!hull) continue;
    const shape = turf.buffer(hull, bufferKm, { units: 'kilometers' });
    if (shape) features.push({ ...shape, properties: { name, wells: points.length } });
  }
  return turf.featureCollection(features);
}
