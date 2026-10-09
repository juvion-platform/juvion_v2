/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Institution-themed ramps ──────────────────
        //
        // These resolve at runtime from CSS custom properties defined in
        // src/index.css and overwritten by lib/apply-ramp.ts when a college has
        // set an accent. The properties hold space-separated sRGB channel
        // triplets ("43 108 176"), NOT hex — a plain `var()` cannot carry an
        // alpha channel, so `bg-primary-500/20` would silently break, and the
        // portal uses opacity modifiers ~900 times.
        navy: {
          DEFAULT: 'rgb(var(--c-navy) / <alpha-value>)',
          dark: 'rgb(var(--c-navy-dark) / <alpha-value>)',
          light: 'rgb(var(--c-navy-light) / <alpha-value>)',
        },
        primary: {
          50:  'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: 'rgb(var(--c-primary-300) / <alpha-value>)',
          400: 'rgb(var(--c-primary-400) / <alpha-value>)',
          500: 'rgb(var(--c-primary-500) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)',
          800: 'rgb(var(--c-primary-800) / <alpha-value>)',
          900: 'rgb(var(--c-primary-900) / <alpha-value>)',
        },
        // The sidebar's active state. Teal at rest; an accent tint when themed.
        chrome: {
          soft: 'rgb(var(--c-chrome-soft) / <alpha-value>)',
          wash: 'rgb(var(--c-chrome-wash) / <alpha-value>)',
        },
        // ── Static semantic ramps — never themed ──────
        teal: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#38B2AC',  // old Juvion teal
          600: '#2C9A94',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        accent: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#6C3BE4',  // old Juvion purple accent
          600: '#5B21B6',
          700: '#4C1D95',
          800: '#3B0764',
          900: '#2E1065',
        },
        orange: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF6B35',  // old Juvion orange
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // ── App background (a neutral surface — not themed) ──
        'bg-app': '#F0F4F8',
      },
    },
  },
  plugins: [],
};
