import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_MODES, DEM_SOURCE, LABEL_FONT } from './mapModes';
import { EVENT_DENSITY_STOPS } from './eventStyles';

const FIELD_CENTER = [95.3, 27.35];
const INDIA_CENTER = [82.8, 22.5];
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const SRC = {
  radius: 'nwis-radius',
  allWells: 'nwis-all-wells',
  nearby: 'nwis-nearby',
  active: 'nwis-active',
  heat: 'nwis-event-heat',
  trajectories: 'nwis-trajectories',
  demTerrain: 'nwis-dem-terrain',
  demHillshade: 'nwis-dem-hillshade',
};

const LYR = {
  hillshade: 'nwis-hillshade',
  heat: 'nwis-heat',
  radiusFill: 'nwis-radius-fill',
  radiusLine: 'nwis-radius-line',
  trajectories: 'nwis-trajectories-line',
  allWells: 'nwis-all-wells-circle',
  nearby: 'nwis-nearby-circle',
  highlight: 'nwis-nearby-highlight',
  active: 'nwis-active-circle',
  labels: 'nwis-labels',
};

const ringColorExpr = [
  'step',
  ['get', 'total_events'],
  ...EVENT_DENSITY_STOPS.flatMap((s, i) => (i === 0 ? [s.color] : [s.min, s.color])),
];

const point = (coords, properties) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: coords },
  properties,
});

function setData(map, id, data) {
  const src = map.getSource(id);
  if (src) src.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

function ensureLayer(map, layer, beforeId) {
  if (!map.getLayer(layer.id))
    map.addLayer(layer, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}

const visibility = (on) => (on ? 'visible' : 'none');

/** Terrain, hillshade, projection and sky for the current mode. */
function applyModeExtras(map, modeKey, layers) {
  const mode = MAP_MODES[modeKey];

  map.setProjection({ type: mode.projection || 'mercator' });

  if (mode.terrain || (mode.hillshade && layers.hillshade)) {
    if (!map.getSource(SRC.demTerrain)) map.addSource(SRC.demTerrain, DEM_SOURCE);
    // A separate DEM source for hillshade renders better than sharing one
    if (!map.getSource(SRC.demHillshade)) map.addSource(SRC.demHillshade, DEM_SOURCE);
  }

  if (mode.hillshade) {
    ensureLayer(map, {
      id: LYR.hillshade,
      type: 'hillshade',
      source: SRC.demHillshade,
      paint: { 'hillshade-shadow-color': '#0A2A66', 'hillshade-exaggeration': 0.35 },
    });
    map.setLayoutProperty(LYR.hillshade, 'visibility', visibility(layers.hillshade));
  }

  map.setTerrain(
    mode.terrain ? { source: SRC.demTerrain, exaggeration: mode.terrain.exaggeration } : null
  );

  if (mode.terrain || mode.projection === 'globe') {
    map.setSky({
      'sky-color': '#9CC0F5',
      'horizon-color': '#E6EEFB',
      'fog-color': '#F4F7FE',
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.4, 12, 0],
    });
  }
}

/** Add (or refresh) all NWIS sources/layers from the latest props. */
function syncData(map, p) {
  const activeId = p.activeWell?.well_id;
  const nearbyIds = new Set(p.nearbyWells.map((r) => r.well.well_id));

  setData(map, SRC.radius, p.layers.radius && p.radiusCircle ? p.radiusCircle : EMPTY_FC);
  setData(map, SRC.allWells, {
    type: 'FeatureCollection',
    features: p.allWells
      .filter((w) => w.location?.coordinates && w.well_id !== activeId && !nearbyIds.has(w.well_id))
      .map((w) =>
        point(w.location.coordinates, { well_id: w.well_id, name: w.name, status: w.status })
      ),
  });
  setData(map, SRC.nearby, {
    type: 'FeatureCollection',
    features: p.nearbyWells
      .filter((r) => r.well.location?.coordinates)
      .map((r) =>
        point(r.well.location.coordinates, {
          well_id: r.well.well_id,
          name: r.well.name,
          similarity: r.similarity,
          total_events: r.total_events,
        })
      ),
  });
  setData(
    map,
    SRC.active,
    p.activeWell?.location?.coordinates
      ? {
          type: 'FeatureCollection',
          features: [
            point(p.activeWell.location.coordinates, {
              well_id: activeId,
              name: p.activeWell.name,
            }),
          ],
        }
      : EMPTY_FC
  );

  setData(
    map,
    SRC.trajectories,
    p.layers.trajectories && p.trajectoriesData ? p.trajectoriesData : EMPTY_FC
  );

  const heatOn = MAP_MODES[p.mapMode]?.overlay === 'eventHeat';
  setData(map, SRC.heat, heatOn && p.heatmapData ? p.heatmapData : EMPTY_FC);

  ensureLayer(map, {
    id: LYR.heat,
    type: 'heatmap',
    source: SRC.heat,
    maxzoom: 15,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.2, 5, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 1.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 40, 13, 70],
      'heatmap-opacity': 0.8,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(59,111,216,0)',
        0.2,
        '#3B6FD8',
        0.45,
        '#1E8E5A',
        0.65,
        '#E0A100',
        0.85,
        '#E8871E',
        1,
        '#C62D3B',
      ],
    },
  });
  ensureLayer(map, {
    id: LYR.radiusFill,
    type: 'fill',
    source: SRC.radius,
    paint: { 'fill-color': '#1D4FB8', 'fill-opacity': 0.06 },
  });
  ensureLayer(map, {
    id: LYR.radiusLine,
    type: 'line',
    source: SRC.radius,
    paint: {
      'line-color': '#1D4FB8',
      'line-width': 2,
      'line-dasharray': [4, 2],
      'line-opacity': 0.6,
    },
  });
  ensureLayer(map, {
    id: LYR.trajectories,
    type: 'line',
    source: SRC.trajectories,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      // Plan-view well path from surveys; the active well is drawn in gold
      'line-color': ['case', ['==', ['get', 'well_id'], activeId || ''], '#C9A227', '#1D4FB8'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 14, 4],
      'line-opacity': 0.85,
    },
  });
  ensureLayer(map, {
    id: LYR.allWells,
    type: 'circle',
    source: SRC.allWells,
    paint: {
      'circle-radius': 4.5,
      'circle-color': '#94A3B8',
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 1.5,
      'circle-pitch-alignment': 'map',
    },
  });
  ensureLayer(map, {
    id: LYR.highlight,
    type: 'circle',
    source: SRC.nearby,
    filter: ['in', ['get', 'well_id'], ['literal', []]],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'similarity'], 0, 13, 1, 24],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#C9A227',
      'circle-stroke-width': 3,
      'circle-pitch-alignment': 'map',
    },
  });
  ensureLayer(map, {
    id: LYR.nearby,
    type: 'circle',
    source: SRC.nearby,
    paint: {
      // Size = similarity, ring colour = event density
      'circle-radius': ['interpolate', ['linear'], ['get', 'similarity'], 0, 6, 1, 16],
      'circle-color': '#123C8F',
      'circle-opacity': ['interpolate', ['linear'], ['get', 'similarity'], 0, 0.55, 1, 0.95],
      'circle-stroke-color': ringColorExpr,
      'circle-stroke-width': 3,
      'circle-pitch-alignment': 'map',
    },
  });
  ensureLayer(map, {
    id: LYR.active,
    type: 'circle',
    source: SRC.active,
    paint: {
      'circle-radius': 22,
      'circle-color': '#C9A227',
      'circle-opacity': 0.18,
      'circle-pitch-alignment': 'map',
    },
  });
  ensureLayer(map, {
    id: LYR.labels,
    type: 'symbol',
    source: SRC.nearby,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': LABEL_FONT,
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': '#0A2A66', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
  });

  const highlighted = [p.selectedWellId, p.hoveredWellId].filter(Boolean);
  map.setFilter(LYR.highlight, ['in', ['get', 'well_id'], ['literal', highlighted]]);
  map.setLayoutProperty(LYR.labels, 'visibility', visibility(p.layers.labels));
  map.setLayoutProperty(LYR.allWells, 'visibility', visibility(p.layers.allWells));
  if (map.getLayer(LYR.hillshade)) {
    map.setLayoutProperty(LYR.hillshade, 'visibility', visibility(p.layers.hillshade));
  }
}

function starElement(title) {
  const el = document.createElement('div');
  el.className = 'nwis-active-marker';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Active well ${title}`);
  el.title = `Active well: ${title}`;
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  return el;
}

/**
 * MapLibre map of wells around the active well.
 * Props are mirrored into a ref so style reloads (mode switches) can re-add
 * every NWIS source/layer from the latest state in the 'style.load' handler.
 */
export default function WellMap(props) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const propsRef = useRef(props);
  const markerRef = useRef(null);
  const popupRef = useRef(null);
  const modeRef = useRef(props.mapMode);
  propsRef.current = props;

  // Create the map once
  useEffect(() => {
    const initial = propsRef.current;
    const mode = MAP_MODES[initial.mapMode];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mode.style,
      center: initial.activeWell?.location?.coordinates || FIELD_CENTER,
      zoom: 10,
      pitch: mode.pitch || 0,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('style.load', () => {
      readyRef.current = true;
      const p = propsRef.current;
      applyModeExtras(map, modeRef.current, p.layers);
      syncData(map, p);
    });

    map.on('error', (e) => {
      // Tile/DEM fetch failures should not break the page
      if (e?.error) console.warn('[WellMap]', e.error.message || e.error);
    });

    const pickWell = (e) => e.features?.[0]?.properties?.well_id;

    map.on('click', LYR.nearby, (e) => {
      const id = pickWell(e);
      if (id) propsRef.current.onSelectWell?.(id);
    });

    map.on('click', LYR.allWells, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const { well_id: id, name, status } = f.properties;
      const el = document.createElement('div');
      el.className = 'text-xs space-y-1';
      el.innerHTML = `<div class="font-bold text-royal-900"></div>
        <div class="text-[10px] text-ink-600 capitalize"></div>
        <div class="text-[10px] text-ink-600">Outside radius / filters</div>`;
      el.children[0].textContent = name;
      el.children[1].textContent = `${id} • ${status}`;
      const btn = document.createElement('button');
      btn.className =
        'mt-1 w-full bg-royal-700 hover:bg-royal-900 text-white text-[10px] font-medium px-2 py-1 rounded';
      btn.textContent = 'Set as active well';
      btn.onclick = () => {
        popupRef.current?.remove();
        propsRef.current.onMakeActive?.(id);
      };
      el.appendChild(btn);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ offset: 8, closeButton: true })
        .setLngLat(f.geometry.coordinates)
        .setDOMContent(el)
        .addTo(map);
    });

    for (const layer of [LYR.nearby, LYR.allWells]) {
      map.on('mouseenter', layer, (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (layer === LYR.nearby) propsRef.current.onHoverWell?.(pickWell(e));
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
        if (layer === LYR.nearby) propsRef.current.onHoverWell?.(null);
      });
    }

    // Panels (e.g. the drawer) change the map's width without a window resize
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      readyRef.current = false;
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Mode switch: swap style; extras + data are re-applied on 'style.load'
  useEffect(() => {
    const map = mapRef.current;
    if (!map || modeRef.current === props.mapMode) return;
    const prevMode = modeRef.current;
    modeRef.current = props.mapMode;
    const mode = MAP_MODES[props.mapMode];

    readyRef.current = false;
    map.setStyle(mode.style, { diff: false });
    map.easeTo({
      pitch: mode.pitch || 0,
      bearing: mode.pitch ? map.getBearing() : 0,
      duration: 800,
    });

    // "Wow" opening for globe: zoom from India to the field
    if (mode.projection === 'globe' && prevMode !== 'globe') {
      const target = propsRef.current.activeWell?.location?.coordinates || FIELD_CENTER;
      map.jumpTo({ center: INDIA_CENTER, zoom: 3 });
      map.once('style.load', () =>
        map.flyTo({ center: target, zoom: 9.5, duration: 4500, essential: true })
      );
    }
  }, [props.mapMode]);

  // Data / toggle changes
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncData(map, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on specific props; others read via propsRef
  }, [
    props.allWells,
    props.nearbyWells,
    props.activeWell,
    props.radiusCircle,
    props.selectedWellId,
    props.hoveredWellId,
    props.heatmapData,
    props.trajectoriesData,
    props.layers,
    props.mapMode,
  ]);

  // Hillshade toggle may need DEM sources that were not added yet
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyModeExtras(map, props.mapMode, props.layers);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on specific props; others read via propsRef
  }, [props.layers.hillshade]);

  // Active well: gold star marker + fly to it
  useEffect(() => {
    const map = mapRef.current;
    const well = props.activeWell;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!map || !well?.location?.coordinates) return;
    markerRef.current = new maplibregl.Marker({ element: starElement(well.name) })
      .setLngLat(well.location.coordinates)
      .addTo(map);
    map.flyTo({
      center: well.location.coordinates,
      zoom: Math.max(map.getZoom(), 10),
      duration: 1200,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on specific props; others read via propsRef
  }, [props.activeWell?.well_id]);

  // Keep the selected offset well in view
  useEffect(() => {
    const map = mapRef.current;
    const sel = props.nearbyWells.find((r) => r.well.well_id === props.selectedWellId);
    const coords = sel?.well.location?.coordinates;
    if (!map || !coords) return;
    const px = map.project(coords);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    if (px.x < 40 || px.y < 40 || px.x > w - 40 || px.y > h - 40) {
      map.easeTo({ center: coords, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on specific props; others read via propsRef
  }, [props.selectedWellId]);

  // MapLibre forces `position: relative` on its container, so size it from a wrapper
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" aria-label="Well map" role="region" />
    </div>
  );
}
