/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0d10', 900: '#101318', 800: '#161a21', 700: '#1d222b', 600: '#272d38', 500: '#363e4c' },
        fog: { 100: '#e8ecf2', 300: '#aab3c2', 500: '#6f7a8d' },
        cyan: { dive: '#22d3ee' },
        violet: { dive: '#a78bfa' },
        mint: { dive: '#4ade80' },
        amber: { dive: '#fbbf24' },
        rose: { dive: '#fb7185' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.35), 0 0 24px -6px rgba(34,211,238,0.35)',
      },
    },
  },
  plugins: [],
}
