# Frontend Sentry Integration

## ✅ Что сделано

Интеграция Sentry в React фронтенд для отслеживания ошибок JavaScript.

---

## 📦 Установка

### 1. Установите зависимости

```bash
cd frontend
npm install
```

Это установит `@sentry/react@^7.99.0` который уже добавлен в `package.json`.

### 2. Настройте environment variables

Создайте файл `frontend/.env`:

```env
VITE_SENTRY_DSN=YOUR_SENTRY_DSN_HERE
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

### 3. Запустите фронтенд

```bash
npm run dev
```

---

## 🔍 Возможности

### 1. Автоматическое отслеживание ошибок
- Все необработанные исключения JavaScript
- Promise rejections
- Ошибки React компонентов

### 2. Performance Monitoring
- Трассировка навигации (React Router)
- Измерение времени загрузки компонентов
- API запросы

### 3. Session Replay
- Запись сессий с ошибками
- Воспроизведение действий пользователя
- Помогает понять контекст ошибки

### 4. Breadcrumbs (хлебные крошки)
- Автоматическое отслеживание:
  - Клики пользователя
  - Навигация между страницами
  - Консольные сообщения
  - Fetch/XHR запросы

---

## 📝 Использование в коде

### Установка пользовательского контекста

```javascript
import { setSentryUser, clearSentryUser } from './sentry';

// После авторизации
setSentryUser(user.id, user.username, user.email);

// При выходе
clearSentryUser();
```

### Добавление breadcrumbs

```javascript
import { addSentryBreadcrumb } from './sentry';

// Отслеживание действия пользователя
addSentryBreadcrumb('User clicked balance button', 'user-action');

// Отслеживание бизнес-события
addSentryBreadcrumb('Transaction successful', 'transaction', 'info');
```

### Ручная отправка ошибок

```javascript
import { captureError, captureMessage } from './sentry';

try {
  // Ваш код
} catch (error) {
  captureError(error, {
    component: 'Balance',
    action: 'fetchBalance'
  });
}

// Отправка информационного сообщения
captureMessage('User reached 1000 bonus points!', 'info');
```

---

## 🎯 Примеры интеграции

### В React компонентах

```javascript
import { useEffect } from 'react';
import { addSentryBreadcrumb, captureError } from './sentry';

function Balance() {
  useEffect(() => {
    addSentryBreadcrumb('Balance page loaded');
    
    async function fetchBalance() {
      try {
        const response = await fetch('/api/balance');
        const data = await response.json();
        // ...
      } catch (error) {
        captureError(error, {
          component: 'Balance',
          action: 'fetchBalance'
        });
      }
    }
    
    fetchBalance();
  }, []);
  
  return <div>...</div>;
}
```

### С Zustand Store

```javascript
import create from 'zustand';
import { addSentryBreadcrumb, captureError } from './sentry';

const useStore = create((set) => ({
  balance: 0,
  
  fetchBalance: async () => {
    try {
      addSentryBreadcrumb('Fetching balance from API');
      const response = await fetch('/api/balance');
      const data = await response.json();
      set({ balance: data.balance });
      addSentryBreadcrumb(`Balance updated: ${data.balance}`);
    } catch (error) {
      captureError(error, { store: 'balance', action: 'fetch' });
    }
  }
}));
```

---

## 🚫 Фильтрация ошибок

Sentry настроен игнорировать:

1. **Ошибки от расширений браузера**
   - chrome-extension://
   
2. **Некритичные уровни**
   - warning
   - info

3. **Telegram SDK ошибки**
   - Telegram WebApp SDK errors

4. **Сетевые ошибки**
   - NetworkError
   - Failed to fetch

Настройте фильтры в `frontend/src/sentry.js` в функции `beforeSend`.

---

## 📊 Проверка работы

### 1. Создайте тестовую ошибку

Добавьте кнопку в компонент:

```javascript
<button onClick={() => {
  throw new Error('Test Sentry Error!');
}}>
  Test Sentry
</button>
```

### 2. Проверьте Sentry Dashboard

1. Откройте https://sentry.io/organizations/YOUR_ORG/projects/
2. Выберите ваш проект
3. Перейдите в Issues
4. Вы должны увидеть ошибку "Test Sentry Error!"

### 3. Проверьте Session Replay

1. В Sentry перейдите в Replays
2. Найдите сессию с ошибкой
3. Воспроизведите действия пользователя

---

## 🔧 Настройки производительности

### Sample Rates (в `frontend/src/sentry.js`):

```javascript
// Трассировка транзакций
tracesSampleRate: 0.1,  // 10% транзакций

// Replay сессий
replaysSessionSampleRate: 0.1,  // 10% всех сессий
replaysOnErrorSampleRate: 1.0,  // 100% сессий с ошибками
```

**Для продакшена рекомендуется:**
- `tracesSampleRate: 0.1` (10%)
- `replaysSessionSampleRate: 0.01` (1%)
- `replaysOnErrorSampleRate: 1.0` (100%)

---

## 🌐 Deploy

### Vercel

Добавьте environment variables в настройках проекта Vercel:

```
VITE_SENTRY_DSN=https://...
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

### Другие платформы

Убедитесь что переменные окружения `VITE_*` доступны во время build.

---

## 📚 Дополнительные ресурсы

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Source Maps](https://docs.sentry.io/platforms/javascript/sourcemaps/)

---

## 🐛 Troubleshooting

### Sentry не инициализируется

Проверьте:
1. `.env` файл создан и содержит `VITE_SENTRY_DSN`
2. Перезапустите dev server после изменения `.env`
3. Проверьте консоль браузера на наличие сообщения "✅ Sentry инициализирован для фронтенда"

### Ошибки не отправляются

Проверьте:
1. DSN корректный (скопирован из Sentry dashboard)
2. Проект в Sentry активен
3. Фильтр `beforeSend` не блокирует ошибки
4. Откройте Network tab и найдите запросы к `sentry.io`

### Source Maps не работают

Для продакшена нужно:
1. Включить source maps в `vite.config.js`
2. Загрузить source maps в Sentry через CLI
3. См. [Sentry Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)


