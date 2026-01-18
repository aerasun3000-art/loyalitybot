/**
 * Common utility functions for Cloudflare Workers
 */

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
 * Log error to console
 */
export function logError(context, error, additionalInfo = {}) {
  console.error(`[ERROR] ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo,
  });
}
