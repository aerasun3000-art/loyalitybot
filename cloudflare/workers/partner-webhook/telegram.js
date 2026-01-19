/**
 * Telegram Bot API utility for Cloudflare Workers
 */

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

  try {
    console.log('[sendTelegramMessage] Sending message:', { chatId, textLength: text.length, parseMode: payload.parse_mode });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendTelegramMessage] Telegram API error:', { status: response.status, error: errorText, chatId });
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[sendTelegramMessage] Message sent successfully:', { chatId, messageId: result.result?.message_id });
    return result;
  } catch (error) {
    console.error('[sendTelegramMessage] Exception:', error);
    throw error;
  }
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
 * Send message with reply keyboard (standard keyboard)
 */
export async function sendTelegramMessageWithReplyKeyboard(token, chatId, text, keyboard, options = {}) {
  return sendTelegramMessage(token, chatId, text, {
    ...options,
    reply_markup: {
      keyboard: keyboard.map(row => row.map(btn => ({ text: btn.text }))),
      resize_keyboard: options.resize_keyboard || false,
      one_time_keyboard: options.one_time_keyboard || false,
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

  return response.json();
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

  return response.json();
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

  return response.json();
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

  return response.json();
}

/**
 * Get webhook info
 */
export async function getWebhookInfo(token) {
  const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;
  
  const response = await fetch(url);
  return response.json();
}
