/**
 * Telegram Bot API utility for Cloudflare Workers
 */
/**
 * Safely parse JSON response from Telegram API
 */
async function safeJsonResponse(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { ok: true };
    }
    return JSON.parse(text);
  } catch (e) {
    console.error('[Telegram API] Failed to parse response:', e.message);
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
    parse_mode: options.parseMode || 'Markdown',
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
    parse_mode: options.parseMode || 'Markdown',
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
 * @param {string} token - Bot token
 * @param {string} chatId - Chat ID
 * @param {number} messageId - Message ID to edit
 * @param {string} text - New text
 * @param {Array|Object} keyboardOrOptions - Inline keyboard array OR options object
 * @param {Object} options - Options (if keyboard provided as 5th arg)
 */
export async function editMessageText(token, chatId, messageId, text, keyboardOrOptions = {}, options = {}) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  
  // Determine if 5th argument is keyboard array or options object
  let keyboard = null;
  let finalOptions = options;
  
  if (Array.isArray(keyboardOrOptions)) {
    keyboard = keyboardOrOptions;
  } else if (typeof keyboardOrOptions === 'object' && keyboardOrOptions !== null) {
    // Check if it looks like an options object (has parseMode or other known keys)
    // or if it's empty, treat as options
    if (!keyboardOrOptions.text && !keyboardOrOptions.callback_data) {
      finalOptions = { ...keyboardOrOptions, ...options };
    } else {
      // It might be a single-row keyboard passed as object array element
      keyboard = keyboardOrOptions;
    }
  }
  
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: finalOptions.parseMode || 'Markdown',
  };
  
  // Add reply_markup if keyboard provided
  if (keyboard && Array.isArray(keyboard) && keyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: keyboard,
    };
  }
  
  // Add any other options (but not parseMode again, and not arrays that look like keyboards)
  for (const [key, value] of Object.entries(finalOptions)) {
    if (key !== 'parseMode' && key !== 'parse_mode' && !payload[key]) {
      payload[key] = value;
    }
  }

  console.log('[editMessageText] Payload:', JSON.stringify(payload));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await safeJsonResponse(response);
  if (!result.ok) {
    console.error('[editMessageText] Error:', JSON.stringify(result));
  }
  return result;
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
