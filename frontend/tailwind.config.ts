import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-bg':     '#080c14',
        'dark-card':   '#0d1421',
        'dark-card2':  '#111827',
        'dark-border': '#1a2744',
        'dark-hover':  '#152033',
        cyan:  {
          300: '#5fffd6',
          400: '#33ffcc',
          500: '#00d4aa',
          600: '#00aa88',
          700: '#007a64',
          dim: 'rgba(0,212,170,0.10)',
        },
        gold:  {
          300: '#fcd16a',
          400: '#f6b856',
          500: '#f0a030',
          600: '#c88528',
          dim: 'rgba(240,160,48,0.10)',
        },
        danger: { 500: '#ff4d6a', dim: 'rgba(255,77,106,0.10)' },
        success: { 500: '#00e2a0', dim: 'rgba(0,226,160,0.10)' },
        muted: '#6b8aa8',
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        xl2:  '16px',
      },
      boxShadow: {
        card:          '0 4px 24px -4px rgba(0,0,0,0.5)',
        'card-glow':   '0 0 0 1px rgba(0,212,170,0.15), 0 8px 32px -4px rgba(0,212,170,0.08)',
        'card-hover':  '0 0 0 1px rgba(0,212,170,0.25), 0 12px 40px -4px rgba(0,212,170,0.12)',
        glow:          '0 0 20px 2px rgba(0,212,170,0.25)',
        'glow-sm':     '0 0 10px 1px rgba(0,212,170,0.15)',
        'glow-gold':   '0 0 20px 2px rgba(240,160,48,0.25)',
        'glow-danger': '0 0 10px 1px rgba(255,77,106,0.15)',
      },
      animation: {
        'fade-in':    'fadeIn 0.35s ease-out forwards',
        'slide-up':   'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        shimmer:      'shimmer 1.8s infinite linear',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        float:        'float 7s ease-in-out infinite',
        ping:         'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '0.5' },
          '50%':     { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        ping: {
          '75%,100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

export default config