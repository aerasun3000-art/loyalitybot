/**
 * Sentry initialization for frontend error tracking
 */
import * as Sentry from "@sentry/react";

export function initSentry() {
  // Проверяем наличие DSN в environment variables
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!sentryDsn) {
    // Тихая проверка - не выводим предупреждение в консоль
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    
    // Окружение (production, staging, development)
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
    
    // Версия релиза
    release: `loyaltybot-frontend@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    
    // Трассировка производительности
    integrations: [
      // Replay сессий для отладки (упрощённая версия без BrowserTracing)
      new Sentry.Replay({
        // Только для ошибок
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Сэмплирование транзакций (10% = 0.1)
    tracesSampleRate: 0.1,
    
    // Сэмплирование replay сессий
    // Записывать 10% всех сессий
    replaysSessionSampleRate: 0.1,
    // Записывать 100% сессий с ошибками
    replaysOnErrorSampleRate: 1.0,
    
    // Отправлять личные данные пользователя (для отладки)
    sendDefaultPii: true,
    
    // Фильтрация ошибок
    beforeSend(event, hint) {
      // Игнорировать некритичные ошибки
      if (event.level === 'warning' || event.level === 'info') {
        return null;
      }
      
      // Игнорировать ошибки от расширений браузера
      if (event.exception) {
        const exceptionValue = event.exception.values && event.exception.values[0];
        if (exceptionValue && exceptionValue.value) {
          // Игнорировать ошибки от chrome extensions
          if (exceptionValue.value.includes('chrome-extension://')) {
            return null;
          }
        }
      }
      
      return event;
    },
    
    // Игнорировать определённые URL (например, localhost)
    ignoreErrors: [
      // Игнорировать ошибки от Telegram WebApp SDK (они не критичные)
      'Telegram',
      // Игнорировать ошибки сети
      'NetworkError',
      'Failed to fetch',
    ],
  });

  console.log('✅ Sentry инициализирован для фронтенда');
}

/**
 * Установка пользовательского контекста
 */
export function setSentryUser(userId, username, email) {
  Sentry.setUser({
    id: userId,
    username: username,
    email: email,
  });
}

/**
 * Очистка пользовательского контекста
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Добавление breadcrumb (хлебных крошек) для отслеживания действий
 */
export function addSentryBreadcrumb(message, category = 'user-action', level = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Ручная отправка ошибки в Sentry
 */
export function captureError(error, context = {}) {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

/**
 * Отправка сообщения в Sentry
 */
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level);
}


