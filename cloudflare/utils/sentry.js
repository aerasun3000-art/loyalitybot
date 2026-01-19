/**
 * Sentry integration for Cloudflare Workers
 * Sends errors and performance metrics to Sentry
 */

/**
 * Send error to Sentry
 * @param {Error} error - Error object
 * @param {Object} context - Additional context (request, update, etc.)
 * @param {string} dsn - Sentry DSN
 * @param {string} environment - Environment (production, staging, etc.)
 */
export async function sendToSentry(error, context = {}, dsn, environment = 'production') {
  if (!dsn) {
    return; // Sentry не настроен
  }

  try {
    // Парсим DSN: https://xxx@o123456.ingest.sentry.io/789
    const dsnMatch = dsn.match(/https:\/\/(.+?)@(.+?)\/(.+)/);
    if (!dsnMatch) {
      console.error('[Sentry] Invalid DSN format');
      return;
    }

    const [, key, host, projectId] = dsnMatch;
    const sentryUrl = `https://${host}/api/${projectId}/store/`;

    // Формируем событие для Sentry
    const event = {
      message: error.message || 'Unknown error',
      level: 'error',
      platform: 'javascript',
      environment,
      release: `loyaltybot@${context.release || '1.0.0'}`,
      timestamp: Math.floor(Date.now() / 1000),
      exception: {
        values: [{
          type: error.name || 'Error',
          value: error.message || 'Unknown error',
          stacktrace: error.stack ? {
            frames: parseStack(error.stack)
          } : null,
        }],
      },
      contexts: {
        runtime: {
          name: 'cloudflare-worker',
          version: 'v8',
        },
      },
      tags: {
        worker: context.worker || 'unknown',
        bot_type: context.botType || 'unknown',
      },
      extra: {
        ...context,
        user_agent: context.userAgent,
        url: context.url,
        method: context.method,
      },
      request: context.request ? {
        url: context.request.url,
        method: context.request.method,
        headers: sanitizeHeaders(context.request.headers),
        data: context.requestData,
      } : null,
    };

    // Удаляем stacktrace если нет
    if (!event.exception.values[0].stacktrace) {
      delete event.exception.values[0].stacktrace;
    }

    // Отправляем в Sentry
    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=loyaltybot-worker/1.0`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[Sentry] Failed to send error: ${response.status} ${response.statusText}`);
    } else {
      console.log('[Sentry] Error sent successfully');
    }
  } catch (sentryError) {
    // Не падаем, если Sentry недоступен
    console.error('[Sentry] Failed to send error to Sentry:', sentryError);
  }
}

/**
 * Track performance metric
 * @param {string} transactionName - Name of transaction
 * @param {number} duration - Duration in milliseconds
 * @param {Object} context - Additional context
 * @param {string} dsn - Sentry DSN
 * @param {string} environment - Environment
 */
export async function trackPerformance(transactionName, duration, context = {}, dsn, environment = 'production') {
  if (!dsn) {
    return;
  }

  // Отправляем только если производительность плохая (>1s) или по sample rate
  const sampleRate = context.sampleRate || 0.1; // 10% по умолчанию
  if (duration < 1000 && Math.random() > sampleRate) {
    return; // Не отправляем быстрые запросы
  }

  try {
    const dsnMatch = dsn.match(/https:\/\/(.+?)@(.+?)\/(.+)/);
    if (!dsnMatch) {
      return;
    }

    const [, key, host, projectId] = dsnMatch;
    const sentryUrl = `https://${host}/api/${projectId}/store/`;

    const event = {
      message: `Performance: ${transactionName}`,
      level: duration > 2000 ? 'warning' : 'info',
      platform: 'javascript',
      environment,
      timestamp: Math.floor(Date.now() / 1000),
      contexts: {
        trace: {
          op: 'http.server',
          status: 'ok',
          data: {
            duration: duration,
            transaction: transactionName,
          },
        },
      },
      tags: {
        worker: context.worker || 'unknown',
        transaction: transactionName,
      },
      extra: {
        duration_ms: duration,
        ...context,
      },
    };

    await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=loyaltybot-worker/1.0`,
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    // Игнорируем ошибки отправки метрик
  }
}

/**
 * Parse stack trace into Sentry format
 */
function parseStack(stack) {
  if (!stack) return [];
  
  const lines = stack.split('\n').slice(1); // Пропускаем первую строку с ошибкой
  return lines
    .map(line => {
      const match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/) || 
                    line.match(/at (.+?):(\d+):(\d+)/);
      if (match) {
        return {
          function: match[1] || '?',
          filename: match[2] || match[1] || '?',
          lineno: parseInt(match[3] || match[2] || 0),
          colno: parseInt(match[4] || match[3] || 0),
        };
      }
      return null;
    })
    .filter(Boolean)
    .reverse(); // Sentry хочет в обратном порядке
}

/**
 * Sanitize headers (remove sensitive data)
 */
function sanitizeHeaders(headers) {
  const sensitive = ['authorization', 'cookie', 'x-api-key', 'x-telegram-bot-api-secret-token'];
  const sanitized = {};
  
  for (const [key, value] of headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (sensitive.includes(lowerKey)) {
      sanitized[key] = '[Filtered]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Create Sentry context from request
 */
export function createSentryContext(request, workerName, botType, update = null) {
  return {
    worker: workerName,
    botType,
    url: request.url,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    request: {
      url: request.url,
      method: request.method,
      headers: request.headers,
    },
    update: update ? {
      update_id: update.update_id,
      message: update.message ? {
        message_id: update.message.message_id,
        chat_id: update.message.chat?.id,
        text: update.message.text?.substring(0, 100), // Первые 100 символов
      } : null,
      callback_query: update.callback_query ? {
        data: update.callback_query.data?.substring(0, 100),
        chat_id: update.callback_query.message?.chat?.id,
      } : null,
    } : null,
  };
}
