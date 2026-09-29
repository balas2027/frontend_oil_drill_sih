import { describe, it, expect, beforeEach } from 'vitest';
import { clean } from '../api/wells';
import { apiErrorMessage } from '../api/client';
import { canReview, isAdmin } from '../store/authStore';
import { useMapStore, MAX_CORRELATION_WELLS, EMPTY_FILTERS } from '../store/mapStore';
import { MAP_MODES, DEM_SOURCE } from '../components/map/mapModes';
import { EVENT_DENSITY_STOPS } from '../components/map/eventStyles';

describe('api helpers', () => {
  it('drops empty filter params but keeps zero/false', () => {
    expect(clean({ a: '', b: null, c: undefined, d: 0, e: false, f: 'x' })).toEqual({
      d: 0,
      e: false,
      f: 'x',
    });
  });

  it('reads the API error envelope, then detail, then fallback', () => {
    expect(
      apiErrorMessage({ response: { data: { error: { message: 'nope' }, detail: 'x' } } })
    ).toBe('nope');
    expect(apiErrorMessage({ response: { data: { detail: 'only detail' } } })).toBe('only detail');
    expect(apiErrorMessage({ response: { data: { detail: [{ msg: 'list' }] } } }, 'fallback')).toBe(
      'fallback'
    );
    expect(apiErrorMessage(new Error('network'), 'fallback')).toBe('fallback');
  });
});

describe('role helpers mirror backend RBAC', () => {
  it('lets reviewer/admin review and only admin administer', () => {
    expect(canReview({ role: 'reviewer' })).toBe(true);
    expect(canReview({ role: 'admin' })).toBe(true);
    expect(canReview({ role: 'engineer' })).toBe(false);
    expect(canReview(null)).toBe(false);
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'reviewer' })).toBe(false);
  });
});

describe('map store', () => {
  beforeEach(() => {
    useMapStore.setState({
      correlationWellIds: [],
      filters: { ...EMPTY_FILTERS },
      selectedWellId: 'X',
    });
  });

  it('caps the correlation queue and toggles membership', () => {
    const { toggleCorrelationWell } = useMapStore.getState();
    for (let i = 0; i < MAX_CORRELATION_WELLS + 2; i += 1) toggleCorrelationWell(`W${i}`);
    expect(useMapStore.getState().correlationWellIds).toHaveLength(MAX_CORRELATION_WELLS);
    toggleCorrelationWell('W0');
    expect(useMapStore.getState().correlationWellIds).not.toContain('W0');
  });

  it('clears the selection when the active well changes', () => {
    useMapStore.getState().setActiveWell({ well_id: 'A' });
    expect(useMapStore.getState().activeWellId).toBe('A');
    expect(useMapStore.getState().selectedWellId).toBeNull();
  });

  it('sets and resets filters', () => {
    useMapStore.getState().setFilter('status', 'completed');
    expect(useMapStore.getState().filters.status).toBe('completed');
    useMapStore.getState().resetFilters();
    expect(useMapStore.getState().filters).toEqual(EMPTY_FILTERS);
  });
});

describe('map modes (Section 8B)', () => {
  it('provides the Phase 2 modes plus the Subsurface 3D view', () => {
    expect(Object.keys(MAP_MODES)).toEqual([
      'street',
      'satellite',
      'terrain',
      'terrain3d',
      'globe',
      'heatmap',
      'subsurface',
    ]);
  });

  it('3D terrain uses a DEM whose encoding matches the tile source', () => {
    expect(MAP_MODES.terrain3d.terrain.exaggeration).toBeGreaterThan(1);
    expect(DEM_SOURCE.tiles[0]).toContain('terrarium');
    expect(DEM_SOURCE.encoding).toBe('terrarium');
  });

  it('globe mode uses the globe projection and every mode has a style', () => {
    expect(MAP_MODES.globe.projection).toBe('globe');
    Object.values(MAP_MODES).forEach((m) => expect(m.style || m.view).toBeTruthy());
  });

  it('event density stops ascend', () => {
    const mins = EVENT_DENSITY_STOPS.map((s) => s.min);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });
});
