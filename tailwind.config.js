/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './src/**/*.{js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#35528C',
        }
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui'],
      }
      ,
      container: {
        center: true,
        padding: '1rem',
        screens: {
          DEFAULT: '1200px',
          sm: '100%',
          md: '100%',
          lg: '1200px',
          xl: '1200px',
          '2xl': '1200px',
        }
      }
    },
  },
  plugins: []
}
