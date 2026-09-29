/** Pure helpers for the command dashboard (no DOM). */

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON_EQ = 111.32;

/**
 * Local east/north offsets (km) of [lon, lat] from an origin - equirectangular,
 * accurate to well under 1 % over a field a few tens of km across.
 */
export function offsetKm([lon, lat], [lon0, lat0]) {
  return [
    (lon - lon0) * KM_PER_DEG_LON_EQ * Math.cos((lat0 * Math.PI) / 180),
    (lat - lat0) * KM_PER_DEG_LAT,
  ];
}

/** SVG coordinates for a point inside a square mini map showing `extentKm` around the origin. */
export function projectToMap(coords, origin, size, extentKm) {
  const [e, n] = offsetKm(coords, origin);
  const scale = size / 2 / extentKm;
  return { x: size / 2 + e * scale, y: size / 2 - n * scale, km: Math.hypot(e, n) };
}

/** Bit position along the planned TD, clamped 0..1 (null without a depth). */
export function depthProgress(depth, td) {
  if (depth == null || !td) return null;
  return Math.max(0, Math.min(1, depth / td));
}

/** Compact number for KPI cards: 1234 -> "1,234". */
export const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
