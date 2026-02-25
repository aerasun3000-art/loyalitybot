# 🎨 Sarafano.io Frontend

Telegram Mini App для системы лояльности партнёров и клиентов.

![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![Telegram](https://img.shields.io/badge/Telegram-WebApp-blue)

---

## 🌟 Возможности

### Для клиентов:
- 💰 **Баланс баллов** - отслеживание накопленных баллов
- 🎉 **Акции** - просмотр активных акций от партнёров
- 🎯 **Услуги** - обмен баллов на услуги
- 📊 **История** - история всех транзакций
- 👤 **Профиль** - статистика и настройки

### Технические фишки:
- 🌐 **Двуязычность** - русский и английский
- 🌙 **Тёмная тема** - автоматически из Telegram
- 📱 **Адаптивный дизайн** - работает на всех устройствах
- ⚡ **Быстрая загрузка** - оптимизированная сборка
- 🔐 **Безопасность** - через Telegram авторизацию

---

## 🛠️ Технологии

- **React 18** - UI библиотека
- **Vite** - сборщик и dev сервер
- **React Router** - навигация
- **Zustand** - state management
- **Telegram UI Kit** - нативные компоненты
- **Supabase** - база данных
- **Tailwind CSS** - стилизация

---

## 📁 Структура проекта

```
frontend/
├── src/
│   ├── components/        # Переиспользуемые компоненты
│   │   ├── Navigation.jsx
│   │   ├── Loader.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   └── ThemeSwitcher.jsx
│   ├── pages/             # Страницы приложения
│   │   ├── Home.jsx       # Главная
│   │   ├── Promotions.jsx # Акции
│   │   ├── Services.jsx   # Услуги
│   │   ├── History.jsx    # История
│   │   └── Profile.jsx    # Профиль
│   ├── services/          # API и сервисы
│   │   └── supabase.js    # Supabase клиент
│   ├── store/             # State management
│   │   ├── languageStore.js
│   │   └── themeStore.js
│   ├── utils/             # Утилиты
│   │   ├── telegram.js    # Telegram Web App API
│   │   └── i18n.js        # Многоязычность
│   ├── styles/
│   │   └── index.css      # Глобальные стили
│   ├── App.jsx            # Главный компонент
│   └── main.jsx           # Точка входа
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── SETUP.md              # 📖 Инструкция по запуску
└── DEPLOY.md             # 🚀 Инструкция по деплою
```

---

## 🚀 Быстрый старт

### 1. Установка

```bash
cd frontend
npm install
```

### 2. Запуск

```bash
npm run dev
```

Откроется на `http://localhost:3000`

### 3. Деплой

См. инструкции в [DEPLOY.md](./DEPLOY.md)

📖 **Подробные инструкции:**
- [SETUP.md](./SETUP.md) - Запуск локально
- [DEPLOY.md](./DEPLOY.md) - Инструкция по деплою

---

## 🎨 Дизайн

Дизайн основан на референсе из Figma:
- Оранжевый градиент в шапке
- Карточки с тенями
- Нативный стиль Telegram
- Плавные анимации

---

## 🌐 Многоязычность

Встроенная поддержка языков без дополнительных библиотек:

```javascript
import { t } from './utils/i18n'
import useLanguageStore from './store/languageStore'

function MyComponent() {
  const { language } = useLanguageStore()
  
  return <h1>{t('home_greeting', language)}</h1>
}
```

Языки: 🇷🇺 Русский | 🇬🇧 English

---

## 🔗 API Методы

### Supabase (`src/services/supabase.js`)

```javascript
// Получить баланс клиента
const balance = await getClientBalance(chatId)

// Получить транзакции
const transactions = await getClientTransactions(chatId)

// Получить акции
const promotions = await getActivePromotions()

// Получить услуги
const services = await getApprovedServices()

// Обменять баллы на услугу
const result = await redeemService(chatId, serviceId)
// result: { success: bool, new_balance: int, points_spent: int, service: object, error?: string }
```

### Обмен баллов (`src/services/supabase.js`)

```javascript
// Обменять баллы на услугу
const result = await redeemService(chatId, serviceId)

if (result.success) {
  console.log(`Обменено ${result.points_spent} баллов`)
  console.log(`Новый баланс: ${result.new_balance}`)
} else {
  console.error('Ошибка:', result.error)
}
```

**Как это работает:**
1. Клиент выбирает услугу на странице `/services`
2. Нажимает кнопку "💸 Обменять X баллов"
3. Система проверяет баланс и списывает баллы
4. Создается транзакция типа `redemption` в БД
5. Баланс обновляется в реальном времени

📖 **Подробное руководство:** См. `POINTS_REDEMPTION_GUIDE.md` в корне проекта

### Telegram Web App (`src/utils/telegram.js`)

```javascript
import { 
  getChatId, 
  showMainButton, 
  hapticFeedback,
  showAlert 
} from './utils/telegram'

// Получить ID пользователя
const chatId = getChatId()

// Показать главную кнопку
showMainButton('Готово', () => {
  console.log('Clicked!')
})

// Вибрация
hapticFeedback('success')
```

---

## 📊 State Management

Используется **Zustand** для простого и быстрого управления состоянием:

```javascript
// Язык
const { language, setLanguage } = useLanguageStore()

// Тема
const { theme, toggleTheme } = useThemeStore()
```

---

## 🧪 Тестирование

```bash
# Линтинг
npm run lint

# Сборка (проверка на ошибки)
npm run build
```

---

## 📱 Интеграция с Telegram

### В боте добавьте кнопку:

```python
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

markup = InlineKeyboardMarkup()
webapp = InlineKeyboardButton(
    "🚀 Открыть приложение",
    web_app=WebAppInfo(url="https://your-frontend-domain.com")
)
markup.add(webapp)

bot.send_message(chat_id, "Добро пожаловать!", reply_markup=markup)
```

---

## 🐛 Известные проблемы

- [ ] TODO: Добавить уведомления внутри приложения
- [ ] TODO: Форма регистрации для новых клиентов

---

## 📈 Будущие улучшения

- [ ] PWA (установка как приложение)
- [ ] Push уведомления
- [ ] Больше языков (УЗ, КЗ)
- [ ] Анимации и микровзаимодействия
- [ ] QR-код сканер для быстрых операций

---

## 🤝 Связь с Backend

Backend на Python (Telegram боты) находится в корне проекта:
- `bot.py` - Партнёрский бот
- `client_handler.py` - Клиентский бот
- `admin_bot.py` - Админский бот
- `supabase_manager.py` - Работа с БД

---

## 📝 Лицензия

Проект для внутреннего использования.

---

## 👨‍💻 Автор

Создано для системы лояльности партнёров.

**Вопросы?** Смотрите [SETUP.md](./SETUP.md) или [DEPLOY.md](./DEPLOY.md)

---

**Сделано с ❤️ и React**
