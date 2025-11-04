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
        // Роскошная палитра - темные оттенки с золотыми акцентами
        'luxury': {
          'charcoal': '#1a1a1a',
          'slate': '#2d2d2d',
          'navy': '#1e293b',
          'deep': '#0f172a',
          'gold': '#d4af37',
          'gold-light': '#f4e4bc',
          'gold-dark': '#b8941f',
          'bronze': '#cd7f32',
          'platinum': '#e5e4e2',
          'ivory': '#f5f5f0',
        },
      },
    },
  },
  plugins: [],
}
