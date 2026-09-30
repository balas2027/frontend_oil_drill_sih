import { create } from 'zustand';
import { MAP_MODES, DEFAULT_MODE } from '../components/map/mapModes';

const MODE_KEY = 'nwis_map_mode';
const CORRELATION_KEY = 'nwis_correlation_wells';
export const MAX_CORRELATION_WELLS = 5;

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable - keep in-memory only */
  }
}

const storedMode = readStored(MODE_KEY, DEFAULT_MODE);

export const EMPTY_FILTERS = {
  formation: '',
  status: '',
  eventType: '',
  trajectoryType: '',
  spudFrom: '',
  spudTo: '',
};

export const useMapStore = create((set) => ({
  // Active well
  activeWellId: null,
  activeWell: null,
  setActiveWell: (well) =>
    set({ activeWell: well, activeWellId: well?.well_id || null, selectedWellId: null }),

  // Radius control (km)
  radiusKm: 10,
  setRadiusKm: (km) => set({ radiusKm: km }),

  // Selection / hover shared by the list and the map (list-map sync)
  selectedWellId: null,
  setSelectedWellId: (id) => set({ selectedWellId: id }),
  hoveredWellId: null,
  setHoveredWellId: (id) => set({ hoveredWellId: id }),

  // Nearby results
  nearbyWells: [],
  nearbyWarnings: [],
  nearbyLatencyMs: null,
  setNearbyResult: ({ wells, warnings, latencyMs }) =>
    set({ nearbyWells: wells, nearbyWarnings: warnings, nearbyLatencyMs: latencyMs }),
  nearbyLoading: false,
  setNearbyLoading: (v) => set({ nearbyLoading: v }),
  nearbyError: null,
  setNearbyError: (e) => set({ nearbyError: e }),

  // Map mode (persisted)
  mapMode: MAP_MODES[storedMode] ? storedMode : DEFAULT_MODE,
  setMapMode: (mode) => {
    writeStored(MODE_KEY, mode);
    set({ mapMode: mode });
  },

  // Layer toggles
  layers: {
    labels: true,
    allWells: true,
    clusters: true,
    radius: true,
    rings: false,
    arcs: true,
    trajectories: true,
    hexbins: false,
    boundaries: true,
    contours: false,
    hillshade: true,
  },
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),

  // Filters
  filters: { ...EMPTY_FILTERS },
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...EMPTY_FILTERS } }),

  // Wells queued for the correlation view (Phase 5), persisted
  correlationWellIds: readStored(CORRELATION_KEY, []),
  toggleCorrelationWell: (id) =>
    set((s) => {
      const has = s.correlationWellIds.includes(id);
      if (!has && s.correlationWellIds.length >= MAX_CORRELATION_WELLS) return s;
      const next = has
        ? s.correlationWellIds.filter((w) => w !== id)
        : [...s.correlationWellIds, id];
      writeStored(CORRELATION_KEY, next);
      return { correlationWellIds: next };
    }),
  setCorrelationWells: (ids) => {
    const next = [...new Set(ids)].slice(0, MAX_CORRELATION_WELLS);
    writeStored(CORRELATION_KEY, next);
    set({ correlationWellIds: next });
  },
}));
