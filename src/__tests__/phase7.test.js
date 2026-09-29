import { describe, it, expect } from 'vitest';
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';
import as from '../i18n/as.json';
import i18n, { LANGUAGES } from '../i18n';
import { resolveShortcut, SHORTCUTS } from '../hooks/useShortcuts';
import {
  depthProgress,
  fmtInt,
  offsetKm,
  projectToMap,
} from '../components/dashboard/dashboardUtils';
import { formatSyncTime } from '../store/uiStore';
import {
  detailText,
  fmtMetric,
  metricDelta,
  METRIC_LABELS,
  pct,
} from '../components/admin/adminUtils';

/** Flatten nested translation objects to dotted keys. */
function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  );
}

describe('i18n (EN / HI / AS)', () => {
  const base = keys(en);

  it.each([
    ['hi', hi],
    ['as', as],
  ])('%s covers every English key with a non-empty string', (_code, dict) => {
    const other = Object.fromEntries(keys(dict));
    const missing = base.filter(([k]) => !(k in other)).map(([k]) => k);
    expect(missing).toEqual([]);
    expect(Object.keys(other).filter((k) => !base.some(([b]) => b === k))).toEqual([]);
    for (const [k, v] of Object.entries(other))
      expect(typeof v === 'string' && v.trim(), k).toBeTruthy();
  });

  it('keeps interpolation placeholders in every language', () => {
    const placeholders = (s) => (s.match(/{{\s*\w+\s*}}/g) || []).sort();
    const hiMap = Object.fromEntries(keys(hi));
    const asMap = Object.fromEntries(keys(as));
    for (const [k, v] of base) {
      expect(placeholders(hiMap[k]), `hi ${k}`).toEqual(placeholders(v));
      expect(placeholders(asMap[k]), `as ${k}`).toEqual(placeholders(v));
    }
  });

  it('switches language and falls back to English', async () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi', 'as']);
    await i18n.changeLanguage('hi');
    expect(i18n.t('nav.dashboard')).toBe(hi.nav.dashboard);
    expect(i18n.t('dashboard.kpi.offsets_sub', { radius: 10 })).toContain('10');
    expect(localStorage.getItem('nwis_lang')).toBe('hi');
    await i18n.changeLanguage('as');
    expect(i18n.t('header.sign_out')).toBe(as.header.sign_out);
    await i18n.changeLanguage('en');
    expect(i18n.t('header.sign_out')).toBe('Sign Out');
  });
});

describe('keyboard shortcuts', () => {
  it('resolves single keys and g-chords', () => {
    expect(resolveShortcut(null, '/')).toEqual({ action: 'search', pending: null });
    expect(resolveShortcut(null, '?').action).toBe('help');
    expect(resolveShortcut(null, 'g')).toEqual({ action: null, pending: 'g' });
    expect(resolveShortcut('g', 'm').action).toBe('/map');
    expect(resolveShortcut('g', 'a').action).toBe('/alerts');
    expect(resolveShortcut('g', 'x')).toEqual({ action: null, pending: null });
    expect(resolveShortcut(null, 'm')).toEqual({ action: null, pending: null });
  });

  it('every shortcut has a translated label', () => {
    for (const s of SHORTCUTS) expect(i18n.t(s.labelKey)).not.toBe(s.labelKey);
  });
});

describe('dashboard helpers', () => {
  it('projects wells around the active well (north up, east right)', () => {
    const origin = [95.3, 27.35];
    const [e, n] = offsetKm([95.3, 27.44], origin);
    expect(e).toBeCloseTo(0);
    expect(n).toBeCloseTo(9.95, 1);
    const east = projectToMap([95.4, 27.35], origin, 200, 20);
    expect(east.x).toBeGreaterThan(100);
    expect(east.y).toBeCloseTo(100);
    expect(east.km).toBeCloseTo(9.88, 1);
    const north = projectToMap([95.3, 27.44], origin, 200, 20);
    expect(north.y).toBeLessThan(100);
  });

  it('clamps bit progress and formats numbers', () => {
    expect(depthProgress(1500, 3000)).toBe(0.5);
    expect(depthProgress(4000, 3000)).toBe(1);
    expect(depthProgress(null, 3000)).toBeNull();
    expect(fmtInt(1234567)).toBe('12,34,567');
    expect(fmtInt(null)).toBe('—');
  });
});

describe('offline + admin helpers', () => {
  it('formats the last sync time', () => {
    const now = new Date('2026-09-30T12:00:00');
    expect(formatSyncTime('2026-09-30T08:05:00', now)).toMatch(/08:05/);
    expect(formatSyncTime('2026-09-28T08:05:00', now)).toMatch(/Sep.*08:05|08:05/);
    expect(formatSyncTime(null)).toBeNull();
    expect(formatSyncTime('garbage')).toBeNull();
  });

  it('renders audit details and percentages', () => {
    expect(detailText({ fields: ['role', 'name'], useful: true })).toBe(
      'fields: role, name · useful: true'
    );
    expect(detailText(null)).toBe('');
    expect(pct(0.9167)).toBe('91.7%');
    expect(pct(null)).toBe('—');
  });
});

describe('learning loop helpers', () => {
  it('formats metrics and deltas between cycles', () => {
    expect(fmtMetric(0.9714)).toBe('0.971');
    expect(fmtMetric(null)).toBe('—');
    expect(metricDelta(0.95, 1)).toBe(-0.05);
    expect(metricDelta(0.9, null)).toBeNull();
    expect(METRIC_LABELS.extraction_f1_main).toMatch(/Extraction/);
  });
});
