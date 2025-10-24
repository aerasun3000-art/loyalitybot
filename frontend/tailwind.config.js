/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'tg-bg': 'var(--tg-theme-bg-color)',
        'tg-text': 'var(--tg-theme-text-color)',
        'tg-hint': 'var(--tg-theme-hint-color)',
        'tg-link': 'var(--tg-theme-link-color)',
        'tg-button': 'var(--tg-theme-button-color)',
        'tg-button-text': 'var(--tg-theme-button-text-color)',
        'tg-secondary-bg': 'var(--tg-theme-secondary-bg-color)',
        // Женственная розовая палитра
        'primary-pink': '#FF69B4',
        'soft-pink': '#FFC0CB',
        'rose': '#FF1493',
        'lavender': '#E6B3E6',
        'purple-soft': '#DDA0DD',
        'peach': '#FFB6C1',
        'coral': '#FFA07A',
      },
    },
  },
  plugins: [],
}
