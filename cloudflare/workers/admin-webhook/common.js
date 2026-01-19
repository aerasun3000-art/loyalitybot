/**
 * Common utility functions for Cloudflare Workers
 */

import { sendToSentry, createSentryContext } from './sentry.js';

/**
 * Validate Telegram webhook secret token
 */
export function validateTelegramWebhook(request, secretToken) {
  if (!secretToken) {
    return true; // No secret token configured
  }

  const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return receivedToken === secretToken;
}

/**
 * Parse Telegram update
 */
export async function parseTelegramUpdate(request) {
  try {
    const update = await request.json();
    return update;
  } catch (error) {
    throw new Error(`Invalid update format: ${error.message}`);
  }
}

/**
 * Extract chat_id from update
 */
export function getChatIdFromUpdate(update) {
  if (update.message) {
    return String(update.message.chat.id);
  }
  if (update.callback_query) {
    return String(update.callback_query.message.chat.id);
  }
  if (update.edited_message) {
    return String(update.edited_message.chat.id);
  }
  return null;
}

/**
 * Extract user_id from update
 */
export function getUserIdFromUpdate(update) {
  if (update.message) {
    return update.message.from?.id ? String(update.message.from.id) : null;
  }
  if (update.callback_query) {
    return update.callback_query.from?.id ? String(update.callback_query.from.id) : null;
  }
  return null;
}

/**
 * Extract text from update
 */
export function getTextFromUpdate(update) {
  if (update.message?.text) {
    return update.message.text;
  }
  if (update.callback_query?.data) {
    return update.callback_query.data;
  }
  return null;
}

/**
 * Create success response
 */
export function successResponse(data = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create error response
 */
export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Log error to console and Sentry
 * @param {string} context - Error context description
 * @param {Error} error - Error object
 * @param {Object} additionalInfo - Additional context information
 * @param {Request} request - Original request object (optional)
 * @param {Object} env - Environment variables (optional, for Sentry)
 * @param {Object} update - Telegram update (optional)
 */
export async function logError(context, error, additionalInfo = {}, request = null, env = null, update = null) {
  // Always log to console
  console.error(`[ERROR] ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo,
  });

  // Send to Sentry if configured
  if (env?.SENTRY_DSN) {
    const sentryContext = createSentryContext(
      request || { url: additionalInfo.url || '', method: additionalInfo.method || 'POST', headers: new Headers() },
      'admin-webhook',
      'admin',
      update || additionalInfo.update
    );

    // Add additional info to Sentry context
    sentryContext.release = env.APP_VERSION || '1.0.0';
    Object.assign(sentryContext, additionalInfo);

    // Send asynchronously (don't await to not block response)
    sendToSentry(
      error,
      sentryContext,
      env.SENTRY_DSN,
      env.SENTRY_ENVIRONMENT || 'production'
    ).catch(err => console.error('[Sentry] Failed to send error:', err));
  }
}
