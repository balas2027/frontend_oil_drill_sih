/**
 * Map mode configuration (Development Guide Section 8B-F).
 * Each mode maps to a base style plus projection / terrain / overlay extras.
 * Subsurface 3D is delivered in Phase 5.
 */

const STREET_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export const LABEL_FONT = ['Noto Sans Regular'];

/** Raster DEM (Terrarium encoding - `encoding` MUST match the tile source). */
export const DEM_SOURCE = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Elevation: Mapzen Terrain Tiles (AWS Open Data)',
};

/**
 * @param {string} id
 * @param {string[]} tiles
 * @param {string} attribution
 * @param {number} [maxzoom]
 */
function rasterStyle(id, tiles, attribution, maxzoom = 19) {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: { [id]: { type: 'raster', tiles, tileSize: 256, attribution, maxzoom } },
    layers: [{ id, type: 'raster', source: id }],
  };
}

export const MAP_MODES = {
  street: {
    label: 'Street',
    style: STREET_STYLE,
    pitch: 0,
  },
  satellite: {
    label: 'Satellite',
    style: rasterStyle(
      'esri-imagery',
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      'Imagery © Esri, Maxar, Earthstar Geographics',
    ),
    pitch: 0,
  },
  terrain: {
    label: 'Terrain',
    style: rasterStyle(
      'opentopomap',
      ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      'Map © OpenTopoMap (CC-BY-SA), data © OpenStreetMap contributors',
      17,
    ),
    pitch: 0,
  },
  terrain3d: {
    label: '3D Terrain',
    style: STREET_STYLE,
    pitch: 65,
    // Upper Assam is mostly floodplain - exaggerate and say so on screen
    terrain: { exaggeration: 2.5 },
    hillshade: true,
    requiresWebGL2: true,
  },
  globe: {
    label: 'Globe',
    style: STREET_STYLE,
    pitch: 0,
    projection: 'globe',
    requiresWebGL2: true,
  },
  heatmap: {
    label: 'Event Heatmap',
    style: STREET_STYLE,
    pitch: 0,
    overlay: 'eventHeat',
  },
};

export const DEFAULT_MODE = 'street';

export function supportsWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
