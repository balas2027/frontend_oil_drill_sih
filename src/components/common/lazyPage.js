import { lazy } from 'react';

const RELOAD_KEY = 'nwis_chunk_reload';

/**
 * React.lazy that survives stale chunks: when the dev server re-bundles
 * dependencies (or a new build is deployed) an open tab can fail to fetch a
 * page module. Reload the page once to pick up the new version.
 */
export function lazyPage(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* storage unavailable */
      }
      return mod;
    } catch (err) {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
        if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        reloaded = true;
      }
      if (!reloaded) {
        window.location.reload();
        return new Promise(() => {}); // keep suspense while the page reloads
      }
      throw err;
    }
  });
}
