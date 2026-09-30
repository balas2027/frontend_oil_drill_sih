import { create } from 'zustand';

const FIELD_KEY = 'nwis_field_mode';
const THEME_KEY = 'nwis_theme';
const SYNC_KEY = 'nwis_last_sync';
const SIDEBAR_KEY = 'nwis_sidebar_open';
const SYNC_THROTTLE_MS = 5000;

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function applyFieldMode(on) {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('field-mode', on);
}

function initialTheme() {
  const stored = read(THEME_KEY, null);
  if (stored === 'light' || stored === 'dark') return stored;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme; // native inputs, scrollbars
}

/** UI preferences and connectivity (Section 9 field mode, Section 11 offline banner). */
export const useUiStore = create((set) => {
  const fieldMode = read(FIELD_KEY, false);
  const sidebarOpen = read(SIDEBAR_KEY, true);
  applyFieldMode(fieldMode);
  const theme = initialTheme();
  applyTheme(theme);
  return {
    theme,
    toggleTheme: () =>
      set((s) => {
        const next = s.theme === 'dark' ? 'light' : 'dark';
        write(THEME_KEY, next);
        applyTheme(next);
        return { theme: next };
      }),

    fieldMode,
    toggleFieldMode: () =>
      set((s) => {
        write(FIELD_KEY, !s.fieldMode);
        applyFieldMode(!s.fieldMode);
        return { fieldMode: !s.fieldMode };
      }),

    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    setOnline: (online) => set({ online }),

    // Time of the last successful API response (ISO string)
    lastSync: read(SYNC_KEY, null),
    markSynced: () =>
      set((s) => {
        const now = new Date();
        if (s.lastSync && now - new Date(s.lastSync) < SYNC_THROTTLE_MS) return s;
        write(SYNC_KEY, now.toISOString());
        return { lastSync: now.toISOString() };
      }),

    sidebarOpen,
    setSidebarOpen: (open) =>
      set(() => {
        write(SIDEBAR_KEY, open);
        return { sidebarOpen: open };
      }),
    toggleSidebar: () =>
      set((s) => {
        const next = !s.sidebarOpen;
        write(SIDEBAR_KEY, next);
        return { sidebarOpen: next };
      }),

    mobileNavOpen: false,
    setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  };
});

/** "HH:MM" today, otherwise "DD Mon HH:MM" (en-IN). */
export function formatSyncTime(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${time}`;
}
