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

        // Sakura palette — CSS vars auto-flip in dark mode, opacity support
        'sakura-bg': 'rgb(var(--sakura-bg) / <alpha-value>)',
        'sakura-light': 'rgb(var(--sakura-light) / <alpha-value>)',
        'sakura-cream': 'rgb(var(--sakura-cream) / <alpha-value>)',
        'sakura-surface': 'rgb(var(--sakura-surface) / <alpha-value>)',
        'sakura-border': 'rgb(var(--sakura-border) / <alpha-value>)',
        'sakura-accent': 'rgb(var(--sakura-accent) / <alpha-value>)',
        'sakura-mid': 'rgb(var(--sakura-mid) / <alpha-value>)',
        'sakura-deep': 'rgb(var(--sakura-deep) / <alpha-value>)',
        'sakura-dark': 'rgb(var(--sakura-dark) / <alpha-value>)',
        'sakura-gold': 'rgb(var(--sakura-gold) / <alpha-value>)',
        'sakura-gold-light': 'rgb(var(--sakura-gold-light) / <alpha-value>)',
        'sakura-muted': 'rgb(var(--sakura-muted) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
