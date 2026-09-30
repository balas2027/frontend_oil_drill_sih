/** @type {import('tailwindcss').Config} */
/*
 * Design tokens - "Institutional precision & high-density industrial modernism"
 * (DESIGN.md): navy institutional anchor, saffron for action/highlight, statutory
 * green for nominal state, ash neutrals, 1px structural borders, 4px corners and
 * no resting shadows.
 *
 * The legacy token names (royal / gold / ink / line) are kept and remapped, so every
 * existing screen adopts the new system without per-page rewrites.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Institutional navy scale (was "royal")
        royal: {
          50: '#F4F6F9', // app canvas (administrative paper tint)
          100: '#E6EBF1', // selected / hover tint
          500: '#4E5F7A', // muted navy (surface tint)
          600: '#1F3A5C', // links, focus
          700: '#0B1E36', // primary navy - buttons, active nav, table headers
          900: '#0F2942', // headings / hover on primary
        },
        // Tricolor saffron accent (was "gold")
        gold: {
          100: '#FFF3E0',
          500: '#E65100',
        },
        ink: {
          600: '#5A6872', // captions, unit labels
          900: '#16212D', // body text and metrics
        },
        line: '#D1D7DC',
        navy: { 900: '#0B1E36', 800: '#0F2942', 700: '#1F3A5C' },
        saffron: { 50: '#FFF3E0', 300: '#FFB74D', 400: '#FF9933', 600: '#E65100' },
        statutory: { 50: '#E8F5E9', 300: '#81C784', 600: '#138808', 800: '#1B5E20' },
        hazard: { 50: '#FFEBEE', 300: '#E57373', 700: '#B71C1C' },
        ash: { 50: '#F8F9FA', 100: '#ECEFF1', 200: '#E9ECEF', 300: '#E2E7EC', 400: '#CFD8DC' },
      },
      fontFamily: {
        // Body & tabular analytics: Noto Sans (Indic scripts); headings: Inter
        sans: [
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Bengali"',
          'Inter',
          'sans-serif',
        ],
        serif: ['Inter', '"Noto Sans Devanagari"', '"Noto Sans Bengali"', 'sans-serif'],
        display: ['Inter', '"Noto Sans Devanagari"', '"Noto Sans Bengali"', 'sans-serif'],
      },
      borderRadius: {
        // Conservative geometry: 4px base, never pill-soft on data surfaces
        md: '0.25rem',
        lg: '0.25rem',
        xl: '0.375rem',
        '2xl': '0.5rem',
      },
      boxShadow: {
        // Flat resting surfaces; one shallow utility shadow for flyouts/modals
        sm: 'none',
        DEFAULT: 'none',
        md: '0 4px 12px rgba(11, 30, 54, 0.12)',
        lg: '0 4px 12px rgba(11, 30, 54, 0.12)',
        xl: '0 4px 12px rgba(11, 30, 54, 0.12)',
      },
    },
  },
  plugins: [],
};
