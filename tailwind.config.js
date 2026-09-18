/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        benebloc: {
          primary: '#0d9488',
          'primary-content': '#ffffff',
          secondary: '#0891b2',
          'secondary-content': '#ffffff',
          accent: '#f59e0b',
          'accent-content': '#000000',
          neutral: '#1e293b',
          'neutral-content': '#f8fafc',
          'base-100': '#ffffff',
          'base-200': '#f1f5f9',
          'base-300': '#e2e8f0',
          'base-content': '#1e293b',
          info: '#0ea5e9',
          success: '#16a34a',
          warning: '#eab308',
          error: '#dc2626',
        },
      },
    ],
    darkTheme: false,
  },
}
