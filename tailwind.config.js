/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aerospace: {
          900: '#000000', // Pure black
          800: '#0a0a0a', // Off-black
          700: '#111111', // Card backgrounds
          600: '#1a1a1a', // Borders
          500: '#222222',
          400: '#555555', // Muted text
          300: '#888888',
          200: '#bbbbbb',
          100: '#eeeeee',
          lightBg: '#ffffff',
          lightPanel: '#f9f9f9',
          lightBorder: '#e0e0e0',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e8c96a',
          pale: '#f5e6b0',
          dark: '#9a7930',
          muted: '#7a5e24',
        },
        hud: {
          amber: '#c9a84c',
          cyan: '#c9a84c',   // mapped to gold
          cyanDark: '#9a7930',
          blue: '#c9a84c',   // mapped to gold
          amber_real: '#c9a84c',
          crimson: '#ef476f',
          green: '#06d6a0',
          purple: '#9d4edd',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'hud-glow': '0 0 20px rgba(201, 168, 76, 0.35)',
        'gold-glow': '0 0 30px rgba(201, 168, 76, 0.5)',
        'alert-glow': '0 0 15px rgba(239, 71, 111, 0.3)',
        'panel': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'light-panel': '0 4px 20px 0 rgba(0, 0, 0, 0.08)',
      }
    },
  },
  plugins: [],
}
