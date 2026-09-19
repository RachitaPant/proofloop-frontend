/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-sora)', 'sans-serif'],
      },
      colors: {
        // Deep navy — brand anchor, primary text
        navy: {
          50: '#f4f6fb',
          100: '#e7ebf5',
          200: '#c8d2e6',
          300: '#9aabcc',
          400: '#647aab',
          500: '#445a8c',
          600: '#324670',
          700: '#28375a',
          800: '#1c2740',
          900: '#0f1626',
          950: '#080c16',
        },
        // Electric blue — primary actions
        brand: {
          50: '#eef4ff',
          100: '#dbe7ff',
          200: '#b8ceff',
          300: '#89adff',
          400: '#5786ff',
          500: '#3763f4',
          600: '#2547d6',
          700: '#1f39ab',
          800: '#1e3287',
          900: '#1c2d6a',
        },
        // Indigo / violet — secondary accents
        accent: {
          50: '#f2f0ff',
          100: '#e5e0ff',
          200: '#cbc2ff',
          300: '#ab9aff',
          400: '#8b70ff',
          500: '#7048f0',
          600: '#5d33d6',
          700: '#4b28ac',
          800: '#3d2389',
          900: '#301c6b',
        },
        // Semantic status colors — one mapping, used everywhere
        success: {
          50: '#eefbf4',
          100: '#d6f5e3',
          200: '#aeead0',
          300: '#7ad9b3',
          400: '#45c090',
          500: '#22a674',
          600: '#16855c',
          700: '#136a4c',
          800: '#12543e',
          900: '#104534',
        },
        warning: {
          50: '#fff9ec',
          100: '#ffefc9',
          200: '#ffdd8f',
          300: '#ffc555',
          400: '#ffab2a',
          500: '#f78c0e',
          600: '#d76907',
          700: '#b24a09',
          800: '#91390f',
          900: '#772f10',
        },
        danger: {
          50: '#fef2f2',
          100: '#fde2e1',
          200: '#fbcac8',
          300: '#f7a3a0',
          400: '#f0716c',
          500: '#e34842',
          600: '#cc2f29',
          700: '#ab2521',
          800: '#8d2220',
          900: '#75211f',
        },
        // Cool neutral surfaces
        surface: {
          0: '#ffffff',
          50: '#f8f9fc',
          100: '#f1f3f9',
          200: '#e4e8f1',
          300: '#d1d7e6',
        },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(15, 22, 38, 0.04)',
        sm: '0 1px 3px 0 rgba(15, 22, 38, 0.06), 0 1px 2px -1px rgba(15, 22, 38, 0.06)',
        DEFAULT: '0 2px 8px -2px rgba(15, 22, 38, 0.08), 0 1px 2px -1px rgba(15, 22, 38, 0.06)',
        md: '0 6px 16px -4px rgba(15, 22, 38, 0.10), 0 2px 6px -2px rgba(15, 22, 38, 0.06)',
        lg: '0 16px 32px -8px rgba(15, 22, 38, 0.14), 0 4px 10px -4px rgba(15, 22, 38, 0.08)',
        focus: '0 0 0 3px rgba(55, 99, 244, 0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'scale-in': 'scale-in 0.14s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
}
