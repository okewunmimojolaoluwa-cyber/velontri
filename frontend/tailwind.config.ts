import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './middleware.ts'],
  theme: {
    extend: {
      colors: {
        /* shadcn/ui token bridge */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: {
          DEFAULT: 'hsl(var(--background))',
          2: 'hsl(var(--background-2))',
          3: 'hsl(var(--background-3))',
        },
        surface: 'hsl(var(--surface))',
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          2: 'hsl(var(--foreground-2))',
          3: 'hsl(var(--foreground-3))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          subtle: 'hsl(var(--primary-subtle))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        amber: {
          DEFAULT: 'hsl(var(--amber))',
          subtle: 'hsl(var(--amber-subtle))',
          foreground: 'hsl(var(--amber-foreground))',
        },
        emerald: {
          DEFAULT: 'hsl(var(--emerald))',
          subtle: 'hsl(var(--emerald-subtle))',
          foreground: 'hsl(var(--emerald-foreground))',
        },
      },

      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        xs:   ['0.75rem',  { lineHeight: '1.25rem' }],
        sm:   ['0.8125rem',{ lineHeight: '1.5rem' }],
        base: ['0.9375rem',{ lineHeight: '1.7rem' }],
        lg:   ['1.0625rem',{ lineHeight: '1.75rem' }],
        xl:   ['1.1875rem',{ lineHeight: '1.75rem' }],
        '2xl':['1.375rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em' }],
        '3xl':['1.75rem',  { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        '4xl':['2.25rem',  { lineHeight: '2.625rem', letterSpacing: '-0.025em' }],
        '5xl':['3rem',     { lineHeight: '3.375rem', letterSpacing: '-0.03em' }],
        '6xl':['3.75rem',  { lineHeight: '4.125rem', letterSpacing: '-0.035em' }],
        '7xl':['4.75rem',  { lineHeight: '5.125rem', letterSpacing: '-0.04em' }],
      },

      borderRadius: {
        sm:     'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg:     'var(--radius-lg)',
        xl:     'var(--radius-xl)',
        '2xl':  'var(--radius-2xl)',
        full:   '9999px',
      },

      boxShadow: {
        xs:  '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        sm:  '0 1px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        DEFAULT: '0 2px 8px 0 rgb(0 0 0 / 0.06), 0 1px 3px -1px rgb(0 0 0 / 0.04)',
        md:  '0 4px 16px 0 rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
        lg:  '0 8px 32px 0 rgb(0 0 0 / 0.09), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
        xl:  '0 16px 48px 0 rgb(0 0 0 / 0.1)',
        '2xl':'0 24px 64px 0 rgb(0 0 0 / 0.12)',
        none: 'none',
      },

      scale: {
        '102': '1.02',
        '103': '1.03',
        '108': '1.08',
      },

      transitionTimingFunction: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth':   'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });
    },
  ],
};

export default config;
