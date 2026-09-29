import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.js'],
  },
});
