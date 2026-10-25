/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Editorial serif for dramatic headers
        serif: ['"Playfair Display"', 'serif'],
        // Clean sans-serif for UI and body text
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        editorial: {
          black: '#121212',
          white: '#F9F9F7',
          gray: '#8C8C8C',
          accent: '#D4AF37'
        }
      }
    },
  },
  plugins: [],
}
