import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * PWA (Section 2 / 11): installable, app shell precached, and the last-fetched
 * read-only API data (wells, events, nearby, lessons, risk ...) served from cache
 * when the rig link drops. Writes are never cached. Service worker is built for
 * production only (`npm run build && npm run preview`).
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'eRTMAC-NWIS - Nearby Wells Intelligence System',
    short_name: 'NWIS',
    description: 'Offset-well memory and look-ahead drilling risk alerts (decision support).',
    lang: 'en',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F7FE',
    theme_color: '#0A2A66',
    icons: [
      { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // maplibre / pdf.js chunks
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        // Read-only API data; the API may live on another origin (VITE_API_URL)
        urlPattern: ({ url, request }) =>
          request.method === 'GET' &&
          url.pathname.includes('/api/v1/') &&
          !/\/api\/v1\/(auth|ws|simulate|live)\b/.test(url.pathname) &&
          !/\.pdf$|\/file$/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'nwis-api',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 3600 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ url }) =>
          url.origin === 'https://fonts.googleapis.com' ||
          url.origin === 'https://fonts.gstatic.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'nwis-fonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
  devOptions: { enabled: false },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), pwa],
  // Pre-bundle heavy, lazily imported libraries at server start. Otherwise Vite
  // discovers them on first navigation and re-optimizes mid-session, which breaks
  // open tabs with "Failed to fetch dynamically imported module".
  optimizeDeps: {
    include: [
      'maplibre-gl',
      '@turf/turf',
      'pdfjs-dist',
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/react',
      'd3-delaunay',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true, // /api/v1/ws/* when VITE_API_URL points at the dev server
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.js'],
  },
});
