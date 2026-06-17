import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class', // toggled by adding/removing `dark` on <html>
  theme: {
    extend: {
      colors: {
        // Essentials Egypt brand: a monochrome "ink" scale taken from the logo
        // (near-black canvas + white). Replaces the old teal so buttons, links
        // and accents across the app read as the premium black/white identity.
        brand: {
          DEFAULT: '#101418', // ink black
          fg: '#ffffff',
          50: '#f5f6f7',
          100: '#e7e9ec',
          200: '#cdd2d7',
          300: '#a6aeb6',
          400: '#76808a',
          500: '#586068',
          600: '#454c53',
          700: '#363b41',
          800: '#23272b',
          900: '#16191c',
          950: '#0a0c0e',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        glow: '0 0 60px -12px rgb(255 255 255 / 0.25)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.75' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'glow-pulse': 'glow-pulse 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
