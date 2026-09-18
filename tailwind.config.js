/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Caveat', 'cursive'],
      },
      boxShadow: {
        soft: '0 10px 24px rgba(90, 27, 34, 0.12)',
      },
      colors: {
        brand: {
          pink: '#F27C71',
          mustard: '#EAB059',
          burgundy: '#5A1B22',
          slate: '#2D3142',
          mint: '#E6F2ED',
          blush: '#FAEDEB',
        },
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        fourmiliere: {
          primary: '#F27C71',
          'primary-content': '#ffffff',
          secondary: '#EAB059',
          'secondary-content': '#2D3142',
          accent: '#5A1B22',
          'accent-content': '#ffffff',
          neutral: '#2D3142',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#FAEDEB',
          'base-300': '#F4E7E4',
          'base-content': '#2D3142',
          info: '#DCEEF3',
          'info-content': '#2D3142',
          success: '#E6F2ED',
          'success-content': '#2D3142',
          warning: '#F9E8C8',
          'warning-content': '#2D3142',
          error: '#D85F5F',
          'error-content': '#ffffff',
        },
      },
    ],
    darkTheme: false,
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
}
