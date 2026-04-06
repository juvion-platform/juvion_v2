/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Old Juvion brand palette ──────────────────
        navy: {
          DEFAULT: '#0F2744',
          dark: '#1A365D',
          light: '#2D4A6F',
        },
        primary: {
          50:  '#F0F4FF',
          100: '#DBEAFE',
          200: '#BAD4F2',
          300: '#7BAED4',
          400: '#4A8DC0',
          500: '#2B6CB0',  // blue-brand from old Juvion
          600: '#2563A0',
          700: '#1E4F82',
          800: '#1A365D',  // navy-dark
          900: '#0F2744',  // navy
        },
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
        // ── App background ───────────────────────────
        'bg-app': '#F0F4F8',
      },
    },
  },
  plugins: [],
};
