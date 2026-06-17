/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        /* Slightly larger text only — layout spacing unchanged */
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1.0625rem', { lineHeight: '1.625rem' }],
        lg: ['1.1875rem', { lineHeight: '1.75rem' }],
        xl: ['1.3125rem', { lineHeight: '1.875rem' }],
      },
      colors: {
        curi: {
          pink: '#FF6B9D',
          'pink-soft': '#F7A7B9',
          'pink-light': '#FFF0F4',
          blue: '#4DA8EE',
          yellow: '#FFD154',
          navy: '#1A2B48',
          'navy-card': '#243656',
          'navy-border': '#3D5A8C',
          green: '#00C896',
          purple: '#7B68EE',
        },
        theme: {
          bg: 'rgb(var(--theme-bg) / <alpha-value>)',
          surface: 'rgb(var(--theme-surface) / <alpha-value>)',
          card: 'rgb(var(--theme-card) / <alpha-value>)',
          text: 'rgb(var(--theme-text) / <alpha-value>)',
          muted: 'rgb(var(--theme-muted) / <alpha-value>)',
          faint: 'rgb(var(--theme-faint) / <alpha-value>)',
          border: 'rgb(var(--theme-border) / <alpha-value>)',
          subtle: 'rgb(var(--theme-subtle) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Quicksand', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        clay: '0 8px 32px -4px rgba(255, 107, 157, 0.18), 0 4px 12px -2px rgba(77, 168, 238, 0.12)',
        'clay-sm': '0 4px 16px -2px rgba(255, 107, 157, 0.15), 0 2px 6px -1px rgba(77, 168, 238, 0.1)',
        'clay-dark': '0 8px 32px -4px rgba(0, 0, 0, 0.35), 0 4px 12px -2px rgba(255, 107, 157, 0.08)',
      },
      backgroundImage: {
        'curi-gradient': 'linear-gradient(135deg, #FF6B9D 0%, #4DA8EE 50%, #FFD154 100%)',
        'curi-gradient-soft': 'linear-gradient(135deg, rgba(255,107,157,0.12) 0%, rgba(77,168,238,0.12) 50%, rgba(255,209,84,0.08) 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,107,157,0.08) 0%, rgba(77,168,238,0.08) 100%)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
}
