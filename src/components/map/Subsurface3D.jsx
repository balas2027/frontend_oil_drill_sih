import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import DeckGL from '@deck.gl/react';
import { OrbitView, COORDINATE_SYSTEM, LinearInterpolator } from '@deck.gl/core';
import {
  BitmapLayer,
  LineLayer,
  PathLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
  TextLayer,
} from '@deck.gl/layers';
import { Delaunay } from 'd3-delaunay';
import { Box, Eye, Layers as LayersIcon, X, Crosshair } from 'lucide-react';
import { wellsApi } from '../../api/wells';
import { correlationApi } from '../../api/correlation';
import { pathBetween } from '../correlation/correlationUtils';
import { apiErrorMessage } from '../../api/client';
import { EVENT_TYPE_COLORS, formatEventType, formatStatusWord } from './eventStyles';
import { FORMATION_COLORS } from './formationStyles';

/*
 * Subsurface 3D view (Development Guide Section 8B-D) - deck.gl OrbitView, free
 * and open source, no API key. Local frame: x = east (m), y = north (m),
 * z = -TVD x vertical exaggeration (depth goes down). Ground imagery: Esri
 * World Imagery export (free, attribution required).
 */

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const ACTIVE = [201, 162, 39];
const OFFSET = [29, 79, 184];
const SELECTED = [198, 45, 59];
const HOTSPOT = [232, 135, 30];
const MAX_CORRELATED = 8; // backend correlation limit
const MAX_HOTSPOT_LABELS = 3;

const ORBIT_VIEW = new OrbitView({ id: 'subsurface', orbitAxis: 'Z', fovy: 45 });
const VIEW_TRANSITION = new LinearInterpolator(['target', 'zoom', 'rotationX', 'rotationOrbit']);

const PRESETS = {
  perspective: { rotationX: 28, rotationOrbit: -35 },
  side: { rotationX: 2, rotationOrbit: 0 },
  top: { rotationX: 89, rotationOrbit: 0 },
};

function esriImageUrl([w, s, e, n]) {
  const aspect = (n - s) / (e - w || 1);
  const width = 2048;
  const height = Math.max(256, Math.min(2048, Math.round(width * aspect)));
  return (
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export' +
    `?bbox=${w},${s},${e},${n}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpg&f=image`
  );
}

/** Triangulated formation-top surface through the wells' top points (>= 3 wells). */
function formationSurfaces(scene, ex) {
  const byFm = {};
  for (const w of scene.wells) {
    for (const t of w.tops) (byFm[t.formation] ||= []).push(t.pos);
  }
  const polys = [];
  for (const [fm, pts] of Object.entries(byFm)) {
    const color = FORMATION_COLORS[fm] || [148, 163, 184];
    const z = (p) => -p[2] * ex;
    if (pts.length >= 3) {
      const del = Delaunay.from(
        pts,
        (p) => p[0],
        (p) => p[1]
      );
      const tri = del.triangles;
      for (let i = 0; i < tri.length; i += 3) {
        const [a, b, c] = [pts[tri[i]], pts[tri[i + 1]], pts[tri[i + 2]]];
        polys.push({ formation: fm, color, polygon: [a, b, c].map((p) => [p[0], p[1], z(p)]) });
      }
    }
    // Always show a small horizon disc at each well so single wells read clearly
    for (const p of pts) {
      const r = 180;
      const ring = Array.from({ length: 16 }, (_, k) => {
        const ang = (k / 16) * Math.PI * 2;
        return [p[0] + r * Math.cos(ang), p[1] + r * Math.sin(ang), z(p)];
      });
      polys.push({ formation: fm, color, polygon: ring, disc: true });
    }
  }
  return polys;
}

function initialView(scene, ex, size) {
  const [x0, y0, x1, y1] = scene.bbox_xy;
  const extent = Math.max(x1 - x0, y1 - y0, scene.max_tvd * ex, 1000);
  const px = Math.max(300, Math.min(size.width, size.height));
  return {
    target: [(x0 + x1) / 2, (y0 + y1) / 2, (-scene.max_tvd * ex) / 2],
    zoom: Math.log2(px / extent) - 0.1,
    minZoom: -12,
    maxZoom: 4,
    ...PRESETS.perspective,
  };
}

export default function Subsurface3D({ activeWell, nearbyWells, selectedWellId, onSelectWell }) {
  const { t } = useTranslation();
  const wrapRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ex, setEx] = useState(1.5);
  const [show, setShow] = useState({
    formations: true,
    events: true,
    hotspots: true,
    ground: true,
    labels: true,
  });
  const [hotspots, setHotspots] = useState([]);
  const [groundOpacity, setGroundOpacity] = useState(0.5);
  const [viewState, setViewState] = useState(null);
  const [picked, setPicked] = useState(null);

  const ids = useMemo(
    () =>
      activeWell
        ? [activeWell.well_id, ...nearbyWells.map((r) => r.well.well_id)].slice(0, 40)
        : [],
    [activeWell, nearbyWells]
  );
  const idKey = ids.join(',');

  useEffect(() => {
    if (!ids.length) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    wellsApi
      .getSubsurface(ids, activeWell.well_id)
      .then((res) => {
        if (cancelled) return;
        setScene(res.data);
        const el = wrapRef.current;
        setViewState(
          initialView(res.data, ex, {
            width: el?.clientWidth || 800,
            height: el?.clientHeight || 600,
          })
        );
      })
      .catch(
        (err) =>
          !cancelled && setError(apiErrorMessage(err, i18n.t('sub.load_error')))
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the set of wells changes; exaggeration is applied client-side
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Look-ahead zones: depth-correlation hotspots (Phase 5) on the active well's MD
  useEffect(() => {
    setHotspots([]);
    if (ids.length < 2) return undefined;
    let cancelled = false;
    correlationApi
      .get({ wellIds: ids.slice(0, MAX_CORRELATED), align: 'formation', reference: ids[0] })
      .then((res) => !cancelled && setHotspots(res.data.hotspots))
      .catch((err) => console.error('Failed to load correlation hotspots:', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Ground imagery: preload it ourselves (CORS-enabled) and hand deck.gl the image
  const [groundImage, setGroundImage] = useState(null);
  const [groundError, setGroundError] = useState(false);
  const bboxKey = scene?.bbox_lonlat?.join(',');
  useEffect(() => {
    if (!scene) return undefined;
    let cancelled = false;
    setGroundImage(null);
    setGroundError(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => !cancelled && setGroundImage(img);
    img.onerror = () => !cancelled && setGroundError(true);
    img.src = esriImageUrl(scene.bbox_lonlat);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey]);

  const applyPreset = (key) =>
    setViewState((v) => ({
      ...v,
      ...PRESETS[key],
      transitionDuration: 800,
      transitionInterpolator: VIEW_TRANSITION,
    }));

  const focusWell = (w) => {
    const end = w.path[w.path.length - 1];
    setViewState((v) => ({
      ...v,
      target: [(w.head[0] + end[0]) / 2, (w.head[1] + end[1]) / 2, (-end[2] * ex) / 2],
      transitionDuration: 900,
      transitionInterpolator: VIEW_TRANSITION,
    }));
  };

  const layers = useMemo(() => {
    if (!scene) return [];
    const zf = (tvd) => -tvd * ex;
    const [x0, y0, x1, y1] = scene.bbox_xy;
    const out = [];

    // 1 km reference grid on the surface
    const grid = [];
    const step = 1000;
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step)
      grid.push({ s: [x, y0, 0], t: [x, y1, 0] });
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step)
      grid.push({ s: [x0, y, 0], t: [x1, y, 0] });
    out.push(
      new LineLayer({
        id: 'surface-grid',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: grid,
        getSourcePosition: (d) => d.s,
        getTargetPosition: (d) => d.t,
        getColor: [255, 255, 255, show.ground ? 60 : 110],
        getWidth: 1,
      })
    );

    // Depth scale at the south-west corner
    const ticks = [];
    for (let d = 0; d <= scene.max_tvd + 1; d += 500) ticks.push(d);
    out.push(
      new LineLayer({
        id: 'depth-axis',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: [
          { s: [x0, y0, 0], t: [x0, y0, zf(ticks[ticks.length - 1])] },
          ...ticks.map((d) => ({ s: [x0, y0, zf(d)], t: [x0 + 250, y0, zf(d)] })),
        ],
        getSourcePosition: (d) => d.s,
        getTargetPosition: (d) => d.t,
        getColor: [15, 23, 42, 200],
        getWidth: 1.5,
      }),
      new TextLayer({
        id: 'depth-labels',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: ticks,
        getPosition: (d) => [x0 - 120, y0, zf(d)],
        getText: (d) => `${d} m`,
        getSize: 11,
        getColor: [15, 23, 42, 230],
        getTextAnchor: 'end',
        getAlignmentBaseline: 'center',
        background: true,
        getBackgroundColor: [255, 255, 255, 200],
        backgroundPadding: [3, 1],
      })
    );

    if (show.formations) {
      out.push(
        new SolidPolygonLayer({
          id: 'formation-surfaces',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          data: formationSurfaces(scene, ex),
          _full3d: true,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => [...d.color, d.disc ? 150 : 70],
          pickable: true,
          // translucent surfaces must not hide the wells behind them
          parameters: { depthWriteEnabled: false },
        })
      );
    }

    // Rig mast above each wellhead + well paths below
    out.push(
      new LineLayer({
        id: 'rig-mast',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: scene.wells,
        getSourcePosition: (w) => [w.head[0], w.head[1], 0],
        getTargetPosition: (w) => [w.head[0], w.head[1], 160 * Math.max(1, ex)],
        getColor: (w) => (w.well_id === scene.origin.well_id ? ACTIVE : [71, 85, 105]),
        getWidth: 3,
      }),
      new PathLayer({
        id: 'well-paths',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: scene.wells,
        getPath: (w) => w.path.map((p) => [p[0], p[1], zf(p[2])]),
        getColor: (w) =>
          w.well_id === selectedWellId
            ? SELECTED
            : w.well_id === scene.origin.well_id
              ? ACTIVE
              : OFFSET,
        getWidth: (w) =>
          w.well_id === scene.origin.well_id || w.well_id === selectedWellId ? 6 : 4,
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        pickable: true,
        updateTriggers: { getColor: [selectedWellId], getWidth: [selectedWellId], getPath: [ex] },
      }),
      new ScatterplotLayer({
        id: 'td-markers',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: scene.wells,
        getPosition: (w) => {
          const e = w.path[w.path.length - 1];
          return [e[0], e[1], zf(e[2])];
        },
        getRadius: 4,
        radiusUnits: 'pixels',
        billboard: true,
        getFillColor: [15, 23, 42],
        updateTriggers: { getPosition: [ex] },
      })
    );

    const activePath = scene.wells.find((w) => w.well_id === scene.origin.well_id)?.path;
    if (show.hotspots && activePath && hotspots.length) {
      const zones = hotspots.map((h) => ({
        ...h,
        path: pathBetween(activePath, h.depth_from, h.depth_to).map((p) => [p[0], p[1], zf(p[2])]),
      }));
      out.push(
        new PathLayer({
          id: 'hotspot-zones',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          data: zones,
          getPath: (h) => h.path,
          getColor: (h) => [...HOTSPOT, h.id === picked?.data?.id ? 200 : 120],
          getWidth: 22,
          widthUnits: 'pixels',
          capRounded: true,
          pickable: true,
          parameters: { depthWriteEnabled: false },
          updateTriggers: { getColor: [picked?.data?.id] },
        }),
        new TextLayer({
          id: 'hotspot-labels',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          // Label only the strongest zones; the rest explain themselves on hover
          data: [...zones]
            .sort((a, b) => b.n_wells - a.n_wells || b.max_severity - a.max_severity)
            .slice(0, MAX_HOTSPOT_LABELS),
          getPosition: (h) => h.path[0],
          getText: (h) => `${h.n_wells} offsets: ${h.dominant_type.replace(/_/g, ' ')}`,
          getSize: 11,
          getColor: [120, 53, 15, 255],
          background: true,
          getBackgroundColor: [255, 247, 237, 230],
          backgroundPadding: [4, 2],
          getTextAnchor: 'start',
          getAlignmentBaseline: 'center',
          getPixelOffset: [18, 0],
        })
      );
    }

    if (show.events) {
      const evs = scene.wells.flatMap((w) =>
        w.events.map((e) => ({ ...e, well_id: w.well_id, well_name: w.name }))
      );
      out.push(
        new ScatterplotLayer({
          id: 'events',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          data: evs,
          getPosition: (e) => [e.pos[0], e.pos[1], zf(e.pos[2])],
          getRadius: (e) => 4 + (e.severity || 3) * 1.6,
          radiusUnits: 'pixels',
          billboard: true,
          stroked: true,
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 1.5,
          getFillColor: (e) => [...hex(EVENT_TYPE_COLORS[e.type] || '#94A3B8'), 235],
          pickable: true,
          updateTriggers: { getPosition: [ex] },
        })
      );
    }

    if (show.labels) {
      out.push(
        new TextLayer({
          id: 'well-labels',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          data: scene.wells,
          getPosition: (w) => [w.head[0], w.head[1], 200 * Math.max(1, ex)],
          getText: (w) => w.name.replace('Upper Assam ', ''),
          getSize: 12,
          getColor: (w) => (w.well_id === scene.origin.well_id ? [10, 42, 102] : [15, 23, 42]),
          background: true,
          getBackgroundColor: (w) =>
            w.well_id === scene.origin.well_id ? [251, 243, 214, 235] : [255, 255, 255, 220],
          backgroundPadding: [4, 2],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'bottom',
          updateTriggers: { getPosition: [ex] },
        })
      );
    }

    // Ground imagery last and without depth writes, so the translucent surface
    // never hides the wells and events underneath it
    if (show.ground && groundImage) {
      out.push(
        new BitmapLayer({
          id: 'ground',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          image: groundImage,
          bounds: [x0, y0, x1, y1],
          opacity: groundOpacity,
          parameters: { depthWriteEnabled: false },
        })
      );
    }
    return out;
  }, [scene, ex, show, groundOpacity, groundImage, selectedWellId, hotspots, picked]);

  const onClick = ({ object, layer }) => {
    if (!object || !layer) return;
    if (layer.id === 'well-paths') {
      if (object.well_id !== scene.origin.well_id) onSelectWell?.(object.well_id);
      setPicked({ kind: 'well', data: object });
    } else if (layer.id === 'events') {
      setPicked({ kind: 'event', data: object });
    } else if (layer.id === 'hotspot-zones') {
      setPicked({ kind: 'hotspot', data: object });
    }
  };

  const getTooltip = ({ object, layer }) => {
    if (!object || !layer) return null;
    const style = {
      fontSize: '11px',
      padding: '6px 8px',
      background: '#0A2A66',
      color: 'white',
      borderRadius: '6px',
    };
    if (layer.id === 'well-paths') {
      const end = object.path[object.path.length - 1];
      return {
        text: t('sub.tip_well', {
          name: object.name,
          type: formatStatusWord(object.trajectory_type),
          md: object.total_depth_md,
          tvd: Math.round(end[2]),
        }),
        style,
      };
    }
    if (layer.id === 'events') {
      return {
        text: t('sub.tip_event', {
          type: formatEventType(object.type),
          well: object.well_name,
          from: object.depth_from_md,
          to: object.depth_to_md,
          formation: object.formation || '',
          severity: object.severity,
        }),
        style,
      };
    }
    if (layer.id === 'formation-surfaces')
      return { text: t('sub.tip_top', { formation: object.formation }), style };
    if (layer.id === 'hotspot-zones') {
      return {
        text: `${t('sub.tip_hotspot', { from: object.depth_from, to: object.depth_to })}\n${object.summary}`,
        style,
      };
    }
    return null;
  };

  const counts = useMemo(() => {
    if (!scene) return {};
    const c = {};
    scene.wells.forEach((w) => w.events.forEach((e) => (c[e.type] = (c[e.type] || 0) + 1)));
    return c;
  }, [scene]);

  return (
    <div ref={wrapRef} className="absolute inset-0 bg-gradient-to-b from-[#dbe7f7] to-[#8a7a5c]">
      {viewState && scene && (
        <DeckGL
          views={ORBIT_VIEW}
          viewState={viewState}
          onViewStateChange={({ viewState: v }) => setViewState(v)}
          controller={{ dragPan: true, dragRotate: true, scrollZoom: true, inertia: true }}
          layers={layers}
          onClick={onClick}
          getTooltip={getTooltip}
          getCursor={({ isHovering, isDragging }) =>
            isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
          }
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-royal-900 animate-pulse">
          {t('sub.building')}
        </div>
      )}
      {error && (
        <p className="absolute top-16 left-3 right-3 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </p>
      )}

      {scene && (
        <>
          {/* Controls */}
          <details
            open
            className="absolute top-16 left-3 z-10 w-60 bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm text-[11px] group"
          >
            <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-1.5 font-bold text-royal-900 text-xs px-3 py-2">
              <span className="flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-royal-700" aria-hidden="true" /> {t('map.modes.subsurface')}
              </span>
              <span className="text-[10px] font-normal text-ink-600 group-open:hidden">
                {t('sub.show_controls')}
              </span>
              <span className="text-[10px] font-normal text-ink-600 hidden group-open:inline">
                {t('sub.hide')}
              </span>
            </summary>
            <div className="px-3 pb-3 space-y-2.5">
              <label className="block">
                <span className="flex justify-between text-ink-600">
                  <span>{t('sub.exaggeration')}</span>
                  <b className="text-royal-900 tabular-nums">{ex.toFixed(1)}×</b>
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={ex}
                  onChange={(e) => setEx(Number(e.target.value))}
                  className="w-full accent-royal-700"
                  aria-label={t('sub.exaggeration')}
                />
              </label>
              <div>
                <span className="flex items-center gap-1 text-ink-600 mb-1">
                  <Eye className="w-3 h-3" aria-hidden="true" /> {t('sub.view')}
                </span>
                <div className="flex gap-1">
                  {Object.keys(PRESETS).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyPreset(k)}
                      className="flex-1 px-1.5 py-1 rounded border border-line hover:bg-royal-100 text-[10px] font-medium"
                    >
                      {t(`sub.presets.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="flex items-center gap-1 text-ink-600 mb-1">
                  <LayersIcon className="w-3 h-3" aria-hidden="true" /> {t('sub.show')}
                </span>
                {['formations', 'events', 'hotspots', 'ground', 'labels'].map((k) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={show[k]}
                      onChange={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
                      className="accent-royal-700"
                    />
                    {t(`sub.layers.${k}`)}
                  </label>
                ))}
                {show.ground && (
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={groundOpacity}
                    onChange={(e) => setGroundOpacity(Number(e.target.value))}
                    className="w-full accent-royal-700 mt-1"
                    aria-label={t('sub.ground_opacity')}
                  />
                )}
              </div>
              <div>
                <span className="flex items-center gap-1 text-ink-600 mb-1">
                  <Crosshair className="w-3 h-3" aria-hidden="true" /> {t('sub.fly_to')}
                </span>
                <select
                  onChange={(e) => {
                    const w = scene.wells.find((x) => x.well_id === e.target.value);
                    if (w) focusWell(w);
                  }}
                  defaultValue=""
                  className="w-full text-[11px] border border-line rounded px-1.5 py-1 bg-white"
                >
                  <option value="" disabled>
                    {t('sub.select')}
                  </option>
                  {scene.wells.map((w) => (
                    <option key={w.well_id} value={w.well_id}>
                      {w.name} ({formatStatusWord(w.trajectory_type)})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-ink-600 leading-snug">
                {t('sub.help')}
              </p>
              {show.ground && groundError && (
                <p className="text-[10px] text-[#6B5310]">
                  {t('sub.ground_unavailable')}
                </p>
              )}
            </div>
          </details>

          {/* Legend */}
          <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm p-2.5 text-[10px] space-y-1.5 max-w-[240px]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span
                  className="w-4 h-1 rounded"
                  style={{ background: 'rgb(201,162,39)' }}
                  aria-hidden="true"
                />{' '}
                {t('sub.legend.active')}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-4 h-1 rounded"
                  style={{ background: 'rgb(29,79,184)' }}
                  aria-hidden="true"
                />{' '}
                {t('sub.legend.offset')}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-4 h-1 rounded"
                  style={{ background: 'rgb(198,45,59)' }}
                  aria-hidden="true"
                />{' '}
                {t('sub.legend.selected')}
              </span>
            </div>
            {show.hotspots && hotspots.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span
                  className="w-4 h-2.5 rounded"
                  style={{ background: 'rgba(232,135,30,0.55)' }}
                  aria-hidden="true"
                />
                {t('sub.legend.lookahead')}
              </div>
            )}
            {show.formations && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {scene.formations.map((f) => (
                  <span key={f} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{
                        background: `rgb(${(FORMATION_COLORS[f] || [148, 163, 184]).join(',')})`,
                      }}
                      aria-hidden="true"
                    />
                    {f}
                  </span>
                ))}
              </div>
            )}
            {show.events && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-1 border-t border-line">
                {Object.entries(counts).map(([et, n]) => (
                  <span key={et} className="flex items-center gap-1 capitalize">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white"
                      style={{ background: EVENT_TYPE_COLORS[et] }}
                      aria-hidden="true"
                    />
                    {formatEventType(et)} ({n})
                  </span>
                ))}
              </div>
            )}
            <p className="text-ink-600">
              {t('sub.legend.footer', { x: ex.toFixed(1), n: scene.wells.length })}
            </p>
          </div>

          {picked && (
            <div className="absolute top-16 right-3 z-10 w-64 bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-royal-900 capitalize">
                  {picked.kind === 'event'
                    ? formatEventType(picked.data.type)
                    : picked.kind === 'hotspot'
                      ? t('sub.hotspot')
                      : picked.data.name}
                </h4>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  aria-label={t('sub.close')}
                  className="p-0.5 hover:bg-royal-100 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {picked.kind === 'hotspot' ? (
                <div className="mt-1 space-y-1 text-ink-900">
                  <p className="text-ink-600 tabular-nums">
                    {t('sub.hotspot_on_active', { from: picked.data.depth_from, to: picked.data.depth_to })}
                    {picked.data.reference_formation && ` · ${picked.data.reference_formation}`}
                  </p>
                  <p>{picked.data.summary}.</p>
                  {picked.data.wells.map((w) => (
                    <p key={w.well_id} className="text-ink-600 tabular-nums">
                      {w.well_id}: {w.md_from}–{w.md_to} {t('units.m_md')}
                    </p>
                  ))}
                  {picked.data.mitigations.length > 0 && (
                    <p>
                      <span className="text-ink-600">{t('sub.done_before')}:</span>{' '}
                      {picked.data.mitigations.map((m) => m.text).join('; ')}
                    </p>
                  )}
                  <p className="text-[10px] text-ink-600">
                    {t('sub.hotspot_note')}
                  </p>
                </div>
              ) : picked.kind === 'event' ? (
                <div className="mt-1 space-y-1 text-ink-900">
                  <p className="text-ink-600 tabular-nums">
                    {picked.data.well_name} · {picked.data.depth_from_md}–{picked.data.depth_to_md}{' '}
                    {t('units.m_md')} · {Math.round(picked.data.pos[2])} {t('units.m_tvd')}
                  </p>
                  <p>
                    {t('sub.formation')}: {picked.data.formation || '—'} ·{' '}
                    {t('severity.short', { value: picked.data.severity })}
                  </p>
                  {picked.data.mitigation && (
                    <p>
                      <span className="text-ink-600">{t('map.drawer.mitigation')}:</span>{' '}
                      {picked.data.mitigation}
                    </p>
                  )}
                  {picked.data.has_source && (
                    <p className="text-emerald-700">{t('sub.source_linked')}</p>
                  )}
                </div>
              ) : (
                <div className="mt-1 space-y-1 text-ink-600 tabular-nums">
                  <p className="capitalize">
                    {formatStatusWord(picked.data.trajectory_type)} · {formatStatusWord(picked.data.status)}
                  </p>
                  <p>
                    TD {picked.data.total_depth_md} {t('units.m_md')} ·{' '}
                    {Math.round(picked.data.path[picked.data.path.length - 1][2])} {t('units.m_tvd')}
                  </p>
                  <p>
                    {t('sub.well_counts', { events: picked.data.events.length, tops: picked.data.tops.length })}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-1 right-2 z-10 text-[9px] text-white/90 drop-shadow">
            {t('sub.attribution')}
          </div>
        </>
      )}
    </div>
  );
}
