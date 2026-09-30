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
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Every token is a CSS variable (RGB channels, see src/index.css) so the light and
      // dark themes swap values in one place and opacity modifiers (bg-royal-700/60) still work.
      colors: {
        royal: {
          50: 'rgb(var(--c-royal-50) / <alpha-value>)',
          100: 'rgb(var(--c-royal-100) / <alpha-value>)',
          500: 'rgb(var(--c-royal-500) / <alpha-value>)',
          600: 'rgb(var(--c-royal-600) / <alpha-value>)',
          700: 'rgb(var(--c-royal-700) / <alpha-value>)',
          900: 'rgb(var(--c-royal-900) / <alpha-value>)',
        },
        gold: {
          100: 'rgb(var(--c-gold-100) / <alpha-value>)',
          500: 'rgb(var(--c-gold-500) / <alpha-value>)',
        },
        ink: {
          600: 'rgb(var(--c-ink-600) / <alpha-value>)',
          900: 'rgb(var(--c-ink-900) / <alpha-value>)',
        },
        navy: {
          900: 'rgb(var(--c-navy-900) / <alpha-value>)',
          800: 'rgb(var(--c-navy-800) / <alpha-value>)',
          700: 'rgb(var(--c-navy-700) / <alpha-value>)',
        },
        saffron: {
          50: 'rgb(var(--c-saffron-50) / <alpha-value>)',
          300: 'rgb(var(--c-saffron-300) / <alpha-value>)',
          400: 'rgb(var(--c-saffron-400) / <alpha-value>)',
          600: 'rgb(var(--c-saffron-600) / <alpha-value>)',
        },
        statutory: {
          50: 'rgb(var(--c-statutory-50) / <alpha-value>)',
          300: 'rgb(var(--c-statutory-300) / <alpha-value>)',
          600: 'rgb(var(--c-statutory-600) / <alpha-value>)',
          800: 'rgb(var(--c-statutory-800) / <alpha-value>)',
        },
        hazard: {
          50: 'rgb(var(--c-hazard-50) / <alpha-value>)',
          300: 'rgb(var(--c-hazard-300) / <alpha-value>)',
          700: 'rgb(var(--c-hazard-700) / <alpha-value>)',
        },
        ash: {
          50: 'rgb(var(--c-ash-50) / <alpha-value>)',
          100: 'rgb(var(--c-ash-100) / <alpha-value>)',
          200: 'rgb(var(--c-ash-200) / <alpha-value>)',
          300: 'rgb(var(--c-ash-300) / <alpha-value>)',
          400: 'rgb(var(--c-ash-400) / <alpha-value>)',
        },
        line: 'rgb(var(--c-line) / <alpha-value>)',
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
