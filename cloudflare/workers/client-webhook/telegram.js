/**
 * Telegram Bot API utility for Cloudflare Workers
 */
/**
 * Safely parse JSON response from Telegram API
 */
async function safeJsonResponse(response) {
  try {
    return await response.json();
  } catch (e) {
    const text = await response.text().catch(() => '');
    console.error('[Telegram API] Failed to parse JSON response:', text);
    return { ok: false, error: 'Invalid JSON response' };
  }
}


/**
 * Send message via Telegram Bot API
 */
export async function sendTelegramMessage(token, chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parseMode || 'HTML',
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }

  return safeJsonResponse(response);
}

/**
 * Send message with inline keyboard
 */
export async function sendTelegramMessageWithKeyboard(token, chatId, text, keyboard, options = {}) {
  return sendTelegramMessage(token, chatId, text, {
    ...options,
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}

/**
 * Answer callback query
 */
export async function answerCallbackQuery(token, callbackQueryId, options = {}) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  
  const payload = {
    callback_query_id: callbackQueryId,
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return safeJsonResponse(response);
}

/**
 * Edit message text
 */
export async function editMessageText(token, chatId, messageId, text, options = {}) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: options.parseMode || 'HTML',
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return safeJsonResponse(response);
}

/**
 * Set webhook URL
 */
export async function setWebhook(token, webhookUrl, secretToken = null) {
  const url = `https://api.telegram.org/bot${token}/setWebhook`;
  
  const payload = {
    url: webhookUrl,
  };
  
  if (secretToken) {
    payload.secret_token = secretToken;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return safeJsonResponse(response);
}

/**
 * Delete webhook
 */
export async function deleteWebhook(token) {
  const url = `https://api.telegram.org/bot${token}/deleteWebhook`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ drop_pending_updates: true }),
  });

  return safeJsonResponse(response);
}

/**
 * Get webhook info
 */
export async function getWebhookInfo(token) {
  const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;
  
  const response = await fetch(url);
  return safeJsonResponse(response);
}

/**
 * Set chat menu button to open Web App
 * When user taps menu button in chat header, opens the app directly
 * @param {string} token - Bot token
 * @param {number|string|null} chatId - Chat ID, or null/undefined to set default for all users
 */
export async function setChatMenuButton(token, chatId, webAppUrl, buttonText = 'Открыть приложение') {
  const url = `https://api.telegram.org/bot${token}/setChatMenuButton`;
  const payload = {
    menu_button: {
      type: 'web_app',
      text: buttonText,
      web_app: { url: webAppUrl },
    },
  };
  if (chatId != null) payload.chat_id = chatId;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return safeJsonResponse(response);
}
