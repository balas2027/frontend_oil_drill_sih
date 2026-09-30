/**
 * MapLibre with a worker URL that works under Vite.
 *
 * maplibre-gl 6 loads its worker from `new URL('./maplibre-gl-worker.mjs', import.meta.url)`.
 * Vite pre-bundles maplibre-gl into node_modules/.vite/deps (and hashes it in production),
 * where that sibling file does not exist, so the worker fails to start and no vector tile
 * or GeoJSON source is ever parsed: white basemap, only DOM markers visible.
 * `?worker&url` makes Vite bundle the worker (with its shared chunk) and return its URL.
 */
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
export * from 'maplibre-gl';
