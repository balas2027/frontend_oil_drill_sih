import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import { Radar, Crosshair, GitCompareArrows } from 'lucide-react';
import { useMapStore, MAX_CORRELATION_WELLS } from '../store/mapStore';
import { wellsApi, nearbyApi, eventsApi } from '../api/wells';
import WellMap from '../components/map/WellMap';
import MapModeSwitcher from '../components/map/MapModeSwitcher';
import NearbyFilters from '../components/map/NearbyFilters';
import NearbyList from '../components/map/NearbyList';
import WellDrawer from '../components/map/WellDrawer';
import { MAP_MODES } from '../components/map/mapModes';
import { EVENT_DENSITY_STOPS, formatEventType } from '../components/map/eventStyles';

// deck.gl is only loaded when the Subsurface 3D mode is opened
const Subsurface3D = lazy(() => import('../components/map/Subsurface3D'));

const RADIUS_DEBOUNCE_MS = 300;

function MapLegend({ mapMode, eventType }) {
  const mode = MAP_MODES[mapMode];
  return (
    <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm p-2.5 text-[10px] text-ink-900 space-y-1.5 max-w-[220px]">
      <div className="flex items-center gap-2">
        <span className="nwis-active-marker !w-4 !h-4 !border" aria-hidden="true" />
        Active well
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-end gap-0.5" aria-hidden="true">
          <span className="w-2 h-2 rounded-full bg-royal-700" />
          <span className="w-3.5 h-3.5 rounded-full bg-royal-700" />
        </span>
        Offset well (size = similarity)
      </div>
      <div>
        <span className="block mb-0.5">Ring = recorded events</span>
        <div className="flex gap-2 flex-wrap">
          {EVENT_DENSITY_STOPS.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full border-2"
                style={{ borderColor: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white"
          aria-hidden="true"
        />
        Other wells (click to make active)
      </div>
      <div className="flex items-center gap-2">
        <span className="w-4 h-0.5 bg-royal-600 rounded" aria-hidden="true" />
        Well path (plan view, from surveys)
      </div>
      {mode.overlay === 'eventHeat' && (
        <div className="pt-1 border-t border-line">
          <span className="block mb-0.5">
            Event heatmap{eventType ? ` — ${formatEventType(eventType)}` : ' — all types'} (weighted
            by severity)
          </span>
          <div
            className="h-1.5 rounded-full"
            style={{ background: 'linear-gradient(90deg,#3B6FD8,#1E8E5A,#E0A100,#E8871E,#C62D3B)' }}
          />
          <div className="flex justify-between text-ink-600">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      )}
      {mode.terrain && (
        <div className="pt-1 border-t border-line font-semibold text-[#7A5F0F]">
          Vertical exaggeration {mode.terrain.exaggeration}× (floodplain terrain)
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  const {
    activeWellId,
    activeWell,
    setActiveWell,
    radiusKm,
    setRadiusKm,
    selectedWellId,
    setSelectedWellId,
    hoveredWellId,
    setHoveredWellId,
    nearbyWells,
    nearbyWarnings,
    nearbyLatencyMs,
    setNearbyResult,
    nearbyLoading,
    setNearbyLoading,
    nearbyError,
    setNearbyError,
    mapMode,
    setMapMode,
    layers,
    toggleLayer,
    filters,
    setFilter,
    resetFilters,
    correlationWellIds,
    toggleCorrelationWell,
  } = useMapStore();

  const [allWells, setAllWells] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [weights, setWeights] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [trajectoriesData, setTrajectoriesData] = useState(null);
  const requestSeq = useRef(0);

  // Wells + filter options on mount
  useEffect(() => {
    (async () => {
      try {
        const [wellsRes, optsRes] = await Promise.all([
          wellsApi.listWells({ limit: 100 }),
          wellsApi.getFilterOptions(),
        ]);
        const wells = wellsRes.data.wells;
        setAllWells(wells);
        setFilterOptions(optsRes.data);
        const current = activeWellId && wells.find((w) => w.well_id === activeWellId);
        if (!current) {
          const initial =
            wells.find((w) => w.status === 'drilling') ||
            wells.find((w) => w.status === 'completed') ||
            wells[0];
          if (initial) setActiveWell(initial);
        }
      } catch (err) {
        console.error('Failed to load wells:', err);
        setLoadError('Could not load wells. Check that the API is running.');
      } finally {
        setLoading(false);
      }
    })();
    // Mount only: keep the current active well if the user already chose one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nearby query - debounced; stale responses are ignored
  useEffect(() => {
    if (!activeWellId) return undefined;
    const timer = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setNearbyLoading(true);
      setNearbyError(null);
      const started = performance.now();
      try {
        const res = await nearbyApi.getNearbyWells({
          well_id: activeWellId,
          radius_km: radiusKm,
          formation: filters.formation,
          status: filters.status,
          event_type: filters.eventType,
          trajectory_type: filters.trajectoryType,
          spud_from: filters.spudFrom,
          spud_to: filters.spudTo,
          limit: 50,
        });
        if (seq !== requestSeq.current) return;
        setWeights(res.data.weights);
        setNearbyResult({
          wells: res.data.nearby_wells,
          warnings: res.data.warnings || [],
          latencyMs: Math.round(performance.now() - started),
        });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        console.error('Failed to fetch nearby wells:', err);
        setNearbyError(err.response?.data?.detail?.toString() || 'Nearby-wells query failed.');
        setNearbyResult({ wells: [], warnings: [], latencyMs: null });
      } finally {
        if (seq === requestSeq.current) setNearbyLoading(false);
      }
    }, RADIUS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [activeWellId, radiusKm, filters, setNearbyError, setNearbyLoading, setNearbyResult]);

  // Heatmap data only while the heatmap mode is on
  useEffect(() => {
    if (MAP_MODES[mapMode]?.overlay !== 'eventHeat') return;
    let cancelled = false;
    eventsApi
      .getEventsGeo({ type: filters.eventType, formation: filters.formation })
      .then((res) => !cancelled && setHeatmapData(res.data))
      .catch((err) => console.error('Failed to load event heatmap:', err));
    return () => {
      cancelled = true;
    };
  }, [mapMode, filters.eventType, filters.formation]);

  // Plan-view trajectories for the active + offset wells
  const trajectoryIds = useMemo(
    () => (activeWellId ? [activeWellId, ...nearbyWells.map((r) => r.well.well_id)] : []),
    [activeWellId, nearbyWells]
  );
  useEffect(() => {
    if (!layers.trajectories || trajectoryIds.length === 0) return undefined;
    let cancelled = false;
    wellsApi
      .getTrajectories(trajectoryIds)
      .then((res) => !cancelled && setTrajectoriesData(res.data))
      .catch((err) => console.error('Failed to load trajectories:', err));
    return () => {
      cancelled = true;
    };
  }, [layers.trajectories, trajectoryIds]);

  // Drop a selection that is no longer in the result set
  useEffect(() => {
    if (selectedWellId && !nearbyWells.some((r) => r.well.well_id === selectedWellId)) {
      setSelectedWellId(null);
    }
  }, [nearbyWells, selectedWellId, setSelectedWellId]);

  // Radius circle is computed client-side so it tracks the slider instantly
  const radiusCircle = useMemo(
    () =>
      activeWell?.location?.coordinates
        ? turf.circle(activeWell.location.coordinates, radiusKm, { units: 'kilometers', steps: 96 })
        : null,
    [activeWell, radiusKm]
  );

  const selectedResult = nearbyWells.find((r) => r.well.well_id === selectedWellId);

  const makeActive = (wellId) => {
    const well = allWells.find((w) => w.well_id === wellId);
    if (well) setActiveWell(well);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-royal-700">
        <div className="text-center space-y-2">
          <Radar className="w-12 h-12 mx-auto animate-pulse" aria-hidden="true" />
          <p className="text-sm font-medium">Loading well data…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
        {loadError}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-130px)] gap-4">
      {/* Left panel: active well, radius, filters, synced list */}
      <div className="lg:w-80 max-h-[60vh] lg:max-h-none flex flex-col bg-white rounded-xl border border-line shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-line bg-royal-50">
          <label
            htmlFor="active-well"
            className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1 block"
          >
            Active well
          </label>
          <select
            id="active-well"
            value={activeWellId || ''}
            onChange={(e) => makeActive(e.target.value)}
            className="w-full text-xs border border-line rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
          >
            {allWells.map((w) => (
              <option key={w.well_id} value={w.well_id}>
                {w.name} ({w.status})
              </option>
            ))}
          </select>
          {correlationWellIds.length > 0 && (
            <p className="mt-2 text-[10px] text-ink-600 flex items-center gap-1">
              <GitCompareArrows className="w-3 h-3 text-royal-700" aria-hidden="true" />
              {correlationWellIds.length}/{MAX_CORRELATION_WELLS} wells queued for correlation
              <Link
                to="/correlation"
                className="ml-auto text-royal-600 font-semibold hover:underline"
              >
                Open →
              </Link>
            </p>
          )}
        </div>

        <div className="p-4 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="radius"
              className="text-[10px] uppercase font-bold tracking-wider text-royal-700 flex items-center gap-1"
            >
              <Crosshair className="w-3 h-3" aria-hidden="true" /> Radius
            </label>
            <span className="text-xs font-bold text-royal-900 bg-royal-100 px-2 py-0.5 rounded tabular-nums">
              {radiusKm} km
            </span>
          </div>
          <input
            id="radius"
            type="range"
            min={1}
            max={50}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            aria-valuetext={`${radiusKm} kilometres`}
            className="w-full h-1.5 bg-royal-100 rounded-lg appearance-none cursor-pointer accent-royal-700"
          />
          <div className="flex justify-between text-[10px] text-ink-600 mt-1">
            {[1, 5, 10, 20, 50].map((km) => (
              <button
                key={km}
                onClick={() => setRadiusKm(km)}
                className={`px-1 rounded hover:text-royal-900 ${radiusKm === km ? 'font-bold text-royal-900' : ''}`}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>

        <NearbyFilters
          filters={filters}
          options={filterOptions}
          onChange={setFilter}
          onReset={resetFilters}
        />

        <NearbyList
          results={nearbyWells}
          loading={nearbyLoading}
          error={nearbyError}
          warnings={nearbyWarnings}
          latencyMs={nearbyLatencyMs}
          radiusKm={radiusKm}
          selectedWellId={selectedWellId}
          hoveredWellId={hoveredWellId}
          onSelect={(id) => setSelectedWellId(id === selectedWellId ? null : id)}
          onHover={setHoveredWellId}
        />
      </div>

      {/* Map */}
      <div className="flex-1 min-h-[420px] rounded-xl overflow-hidden border border-line shadow-sm relative bg-royal-100">
        {MAP_MODES[mapMode]?.view === 'subsurface' ? (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center text-sm text-royal-700 animate-pulse">
                Loading 3D view…
              </div>
            }
          >
            <Subsurface3D
              activeWell={activeWell}
              nearbyWells={nearbyWells}
              selectedWellId={selectedWellId}
              onSelectWell={setSelectedWellId}
            />
          </Suspense>
        ) : (
          <WellMap
            mapMode={mapMode}
            activeWell={activeWell}
            allWells={allWells}
            nearbyWells={nearbyWells}
            radiusCircle={radiusCircle}
            selectedWellId={selectedWellId}
            hoveredWellId={hoveredWellId}
            heatmapData={heatmapData}
            trajectoriesData={trajectoriesData}
            layers={layers}
            onSelectWell={setSelectedWellId}
            onHoverWell={setHoveredWellId}
            onMakeActive={makeActive}
          />
        )}
        <MapModeSwitcher
          mapMode={mapMode}
          onModeChange={setMapMode}
          layers={layers}
          onToggleLayer={toggleLayer}
        />
        {!MAP_MODES[mapMode]?.view && <MapLegend mapMode={mapMode} eventType={filters.eventType} />}
      </div>

      {/* Right drawer */}
      {selectedResult && (
        <WellDrawer
          result={selectedResult}
          weights={weights}
          onClose={() => setSelectedWellId(null)}
          onMakeActive={() => makeActive(selectedResult.well.well_id)}
          inCorrelation={correlationWellIds.includes(selectedResult.well.well_id)}
          correlationFull={correlationWellIds.length >= MAX_CORRELATION_WELLS}
          onToggleCorrelation={() => toggleCorrelationWell(selectedResult.well.well_id)}
        />
      )}
    </div>
  );
}
