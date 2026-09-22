/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'alf-bg': '#0a0a0f',
        'alf-panel': '#14141c',
        'alf-border': '#2a2a3a',
        'alf-accent': '#7c5cff',
        'alf-text': '#e8e8f0',
        'alf-muted': '#6b6b80',
      },
    },
  },
  plugins: [],
}