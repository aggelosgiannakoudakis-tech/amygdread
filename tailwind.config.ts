import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { bone: '#e9e4dc', blood: '#b3121f' },
    fontFamily: { display: ['"Cormorant Garamond"', 'Georgia', 'serif'], mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'] },
  } },
  plugins: [],
} satisfies Config
