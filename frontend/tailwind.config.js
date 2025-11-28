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
        // Роскошная палитра в стиле ювелирного магазина
        'jewelry': {
          // Розовые цвета (основная палитра)
          'pink-dark': '#8B008B',       // Темно-розовый (DarkMagenta)
          'pink-medium': '#C71585',     // Средне-розовый (MediumVioletRed)
          'pink-light': '#FFC0CB',      // Светло-розовый (Pink)
          'rose': '#FF69B4',           // Ярко-розовый (HotPink)
          'purple': '#800080',         // Фиолетовый (Purple)
          'lavender': '#E6E6FA',       // Лавандовый (Lavender)
          'white-soft': '#F8F8F8',     // Мягкий белый
          'gray-light': '#D3D3D3',     // Светло-серый
          'text-dark': '#333333',      // Темный текст
          // Золотые и коричневые цвета (для jewelry-стиля)
          'brown-dark': '#3D2817',      // Темно-коричневый
          'brown-light': '#8B7355',     // Светло-коричневый
          'burgundy': '#722F37',        // Бордовый
          'gold': '#D4AF37',            // Золотой
          'gold-dark': '#B8941F',       // Темно-золотой
          'gold-light': '#F4E4BC',      // Светло-золотой
          'cream': '#F5F5DC',           // Кремовый
          'gray-elegant': '#6B6B6B',   // Элегантный серый
        },
        // Vanilla Blush palette (option 4)
        'rose-surface': '#FCF7F2',
        'rose-border': '#F1C9DA',
        'rose-heading': '#6E104A',
        'rose-accent': '#D5408B',
        'rose-secondary': '#707070',

        // Emerald/Teal palette (reference-like)
        'emerald-deep': '#003E3E',
        'emerald': '#007F6E',
        'emerald-aqua': '#00D1BA',
        'emerald-heading': '#0B3A2E',
        'emerald-accent': '#19C29E',
        'emerald-border': '#BFE6DE',

        // Sakura palette from screenshot
        'sakura-surface': '#FADCD5',
        'sakura-border': '#765D67',
        'sakura-accent': '#6D3C52',
        'sakura-mid': '#4B2138',
        'sakura-deep': '#1B0C1A',
        'sakura-dark': '#2D222F',
        'sakura-light': '#FEF5F3',
        'sakura-cream': '#FFF8F5',
      },
    },
  },
  plugins: [],
}
