/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oil: {
          dark: '#0A0F1D',
          card: '#131B2E',
          accent: '#00E5FF',
          gold: '#FFB800',
          orange: '#FF5722',
        }
      }
    },
  },
  plugins: [],
}
