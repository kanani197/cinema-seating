/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg: '#0a0a0f',
          surface: '#12121a',
          card: '#1a1a26',
          border: '#2a2a3e',
          accent: '#e8b84b',
          blue: '#3b82f6',
          green: '#22c55e',
          red: '#ef4444',
          purple: '#a855f7',
          gray: '#6b7280',
        }
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'seat-select': 'seatSelect 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(232, 184, 75, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(232, 184, 75, 0.8)' },
        },
        seatSelect: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        }
      }
    }
  },
  plugins: [],
};
