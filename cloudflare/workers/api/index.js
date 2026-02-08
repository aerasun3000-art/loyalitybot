/**
 * REST API - Cloudflare Worker
 * Handles API requests for transactions, balance, and other operations
 */

import { supabaseRequest } from './supabase.js';
import { logError } from './common.js';

/**
 * Generate unique referral code (6 chars), check uniqueness in DB
 */
async function generateReferralCode(env, chatId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const base = `${chatId}_${Date.now()}_${attempt}_${Math.random()}`;
    const enc = new TextEncoder().encode(base);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 6)
      .toUpperCase();
    try {
      const existing = await supabaseRequest(env, `users?referral_code=eq.${encodeURIComponent(hex)}&select=chat_id`);
      if (!existing || existing.length === 0) return hex;
    } catch (_) {
      return hex;
    }
  }
  return 'REF' + String(chatId).slice(-6).replace(/-/g, '').toUpperCase();
}

/**
 * Get or create referral code for user (for web app link)
 */
async function getOrCreateReferralCode(env, chatId) {
  try {
    const userRows = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(chatId)}&select=referral_code`);
    if (userRows && userRows.length > 0 && userRows[0].referral_code) {
      return userRows[0].referral_code;
    }
    const code = await generateReferralCode(env, chatId);
    await fetch(`${env.SUPABASE_URL}/rest/v1/users?chat_id=eq.${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referral_code: code }),
    });
    return code;
  } catch (error) {
    logError('getOrCreateReferralCode', error, { chatId });
    return null;
  }
}

/**
 * Get client balance
 */
async function getClientBalance(env, clientChatId) {
  try {
    const result = await supabaseRequest(env, `users?chat_id=eq.${encodeURIComponent(clientChatId)}&select=balance`);
    if (result && result.length > 0) {
      return result[0].balance || 0;
    }
    return 0;
  } catch (error) {
    logError('getClientBalance', error, { clientChatId });
    return 0;
  }
}

/**
 * Calculate accrual points for partner
 */
async function calculateAccrualPoints(env, partnerChatId, rawAmount) {
  try {
    // Get partner info
    const partner = await supabaseRequest(env, `partners?chat_id=eq.${encodeURIComponent(partnerChatId)}&select=cashback_rate,default_cashback_percent`);
    
    let cashbackRate = 0.05; // Default 5%
    
    if (partner && partner.length > 0) {
      cashbackRate = partner[0].cashback_rate || partner[0].default_cashback_percent || 0.05;
    }
    
    // Convert to points (cashback_rate is percentage, e.g., 0.05 = 5%)
    const points = Math.floor(rawAmount * cashbackRate);
    return points;
  } catch (error) {
    logError('calculateAccrualPoints', error, { partnerChatId, rawAmount });
    // Default to 5% on error
    return Math.floor(rawAmount * 0.05);
  }
}

/**
 * Execute transaction
 */
async function executeTransaction(env, clientChatId, partnerChatId, txnType, rawAmount) {
  try {
    const currentBalance = await getClientBalance(env, clientChatId);
    
    let transactionPoints = 0;
    let newBalance = currentBalance;
    let operationType = '';
    let description = '';
    
    if (txnType === 'accrual') {
      // Calculate points for accrual
      transactionPoints = await calculateAccrualPoints(env, partnerChatId, rawAmount);
      newBalance = currentBalance + transactionPoints;
      operationType = 'accrual';
      description = `Начисление ${transactionPoints} бонусов за чек ${rawAmount} руб. (Партнер: ${partnerChatId})`;
    } else if (txnType === 'spend') {
      // Spend points
      transactionPoints = Math.floor(rawAmount);
      if (transactionPoints > currentBalance) {
        return {
          success: false,
          error: 'Недостаточно бонусов для списания.',
          new_balance: currentBalance,
        };
      }
      newBalance = currentBalance - transactionPoints;
      operationType = 'redemption';
      description = `Списание ${transactionPoints} бонусов (Партнер: ${partnerChatId})`;
    } else {
      return {
        success: false,
        error: 'Неверный тип транзакции. Используйте "accrual" или "spend".',
        new_balance: currentBalance,
      };
    }
    
    // Update user balance
    const config = {
      url: env.SUPABASE_URL,
      key: env.SUPABASE_KEY,
    };
    const updateUrl = `${config.url}/rest/v1/users?chat_id=eq.${encodeURIComponent(clientChatId)}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ balance: newBalance }),
    });
    
    // Record transaction
    const transactionData = {
      client_chat_id: String(clientChatId),
      partner_chat_id: String(partnerChatId),
      total_amount: txnType === 'accrual' ? rawAmount : 0,
      earned_points: txnType === 'accrual' ? transactionPoints : 0,
      spent_points: txnType === 'spend' ? transactionPoints : 0,
      operation_type: operationType,
      description: description,
      date_time: new Date().toISOString(),
    };
    
    await supabaseRequest(env, 'transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
    
    return {
      success: true,
      new_balance: newBalance,
      points: transactionPoints,
    };
  } catch (error) {
    logError('executeTransaction', error, { clientChatId, partnerChatId, txnType, rawAmount });
    return {
      success: false,
      error: `Внутренняя ошибка: ${error.message}`,
      new_balance: 0,
    };
  }
}

/**
 * Redeem points for promotion
 */
async function redeemPromotion(env, clientChatId, promotionId, pointsToSpend) {
  try {
    // Get promotion
    const promotions = await supabaseRequest(env, `promotions?id=eq.${encodeURIComponent(promotionId)}&select=*`);
    
    if (!promotions || promotions.length === 0) {
      return {
        success: false,
        error: 'Акция не найдена.',
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    const promotion = promotions[0];
    
    // Check if promotion is active
    if (!promotion.is_active) {
      return {
        success: false,
        error: 'Акция неактивна.',
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    // Check dates
    const today = new Date().toISOString().split('T')[0];
    if (promotion.start_date && today < promotion.start_date) {
      return {
        success: false,
        error: 'Акция еще не началась.',
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    if (promotion.end_date && today > promotion.end_date) {
      return {
        success: false,
        error: 'Акция уже закончилась.',
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    // Check if promotion supports points payment
    const maxPointsPayment = promotion.max_points_payment || 0;
    if (maxPointsPayment <= 0) {
      return {
        success: false,
        error: 'Эта акция не поддерживает оплату баллами.',
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    // Get points to dollar rate (default 1 point = 1 dollar)
    const pointsRate = parseFloat(promotion.points_to_dollar_rate || 1.0);
    
    // Convert points to USD
    const pointsValueUsd = pointsToSpend * pointsRate;
    
    // Check if points value exceeds max payment
    if (pointsValueUsd > maxPointsPayment) {
      return {
        success: false,
        error: `Максимальная оплата баллами: $${maxPointsPayment.toFixed(2)}. Вы пытаетесь оплатить $${pointsValueUsd.toFixed(2)}.`,
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    // Get partner_chat_id
    const partnerChatId = promotion.partner_chat_id;
    if (!partnerChatId) {
      return {
        success: false,
        error: 'Акция не привязана к партнеру.',
        current_balance: 0,
        points_to_spend: 0,
      };
    }
    
    // Check client balance
    const currentBalance = await getClientBalance(env, clientChatId);
    if (currentBalance < pointsToSpend) {
      return {
        success: false,
        error: `Недостаточно баллов. Требуется: ${pointsToSpend}, доступно: ${currentBalance}`,
        current_balance: currentBalance,
        points_to_spend: 0,
      };
    }
    
    // Get service price
    const servicePrice = parseFloat(promotion.service_price || 0);
    
    // Generate QR data
    // Format: PROMOTION:promotion_id:client_chat_id:points_to_spend:points_value_usd
    const qrData = `PROMOTION:${promotionId}:${clientChatId}:${pointsToSpend}:${pointsValueUsd.toFixed(2)}`;
    
    // Return success (points are NOT deducted - master deducts when scanning QR)
    return {
      success: true,
      current_balance: currentBalance,
      points_to_spend: pointsToSpend,
      points_value_usd: pointsValueUsd,
      service_price: servicePrice,
      cash_payment: servicePrice - pointsValueUsd, // How much to pay in cash
      promotion: {
        id: promotion.id,
        title: promotion.title,
        description: promotion.description,
        partner_chat_id: partnerChatId,
      },
      qr_data: qrData,
    };
  } catch (error) {
    logError('redeemPromotion', error, { clientChatId, promotionId, pointsToSpend });
    return {
      success: false,
      error: `Ошибка при подготовке обмена баллов: ${error.message}`,
      current_balance: 0,
      points_to_spend: 0,
    };
  }
}

/**
 * Translate text using OpenAI
 */
async function translateText(env, text, targetLang, sourceLang) {
  try {
    if (!env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key не настроен',
      };
    }
    
    // Language names mapping
    const langNames = {
      'ru': 'русский',
      'en': 'английский',
      'es': 'испанский',
      'fr': 'французский',
      'de': 'немецкий',
      'it': 'итальянский',
      'pt': 'португальский',
      'zh': 'китайский',
      'ja': 'японский',
      'ko': 'корейский',
    };
    
    const sourceName = langNames[sourceLang] || sourceLang;
    const targetName = langNames[targetLang] || targetLang;
    
    // Translation prompt
    const translationPrompt = `Ты профессиональный переводчик. Переведи следующий текст с ${sourceName} на ${targetName}.

Правила перевода:
1. Сохраняй смысл и тон оригинала
2. Используй естественный язык целевого языка
3. Сохраняй форматирование (переносы строк, пунктуацию)
4. Не добавляй дополнительных комментариев или объяснений
5. Если текст содержит плейсхолдеры вида {variable}, сохрани их без изменений

Текст для перевода:
${text}

Переведи только текст, без дополнительных комментариев:`;
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Ты профессиональный переводчик. Твоя задача - точно переводить текст, сохраняя смысл и стиль оригинала.',
          },
          {
            role: 'user',
            content: translationPrompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      logError('translateText', new Error(`OpenAI API error: ${response.status}`), { error });
      return {
        success: false,
        error: 'Не удалось выполнить перевод. Попробуйте позже.',
      };
    }
    
    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[translateText] Unexpected OpenAI response:', JSON.stringify(data));
      return { success: false, error: 'Unexpected response from translation service' };
    }
    let translated = data.choices[0].message.content.trim();
    
    // Remove possible quotes
    if (translated.startsWith('"') && translated.endsWith('"')) {
      translated = translated.slice(1, -1);
    }
    if (translated.startsWith("'") && translated.endsWith("'")) {
      translated = translated.slice(1, -1);
    }
    
    return {
      success: true,
      translated_text: translated,
      original_text: text,
      source_lang: sourceLang,
      target_lang: targetLang,
    };
  } catch (error) {
    logError('translateText', error, { text: text.substring(0, 50), targetLang, sourceLang });
    return {
      success: false,
      error: `Ошибка при переводе: ${error.message}`,
    };
  }
}

/**
 * Send QR code to partner via Telegram
 */
async function sendQrToPartner(env, qrImage, clientChatId, partnerChatId, partnerUsername, serviceTitle) {
  try {
    if (!env.TOKEN_PARTNER) {
      return {
        success: false,
        error: 'Telegram бот не настроен',
      };
    }
    
    // Determine partner chat_id
    let finalPartnerChatId = partnerChatId;
    
    // If username is provided, find chat_id by username
    if (!finalPartnerChatId && partnerUsername) {
      const partners = await supabaseRequest(env, `partners?username=eq.${encodeURIComponent(partnerUsername)}&select=chat_id`);
      if (partners && partners.length > 0) {
        finalPartnerChatId = partners[0].chat_id;
      } else {
        return {
          success: false,
          error: `Партнёр с username ${partnerUsername} не найден в базе данных`,
        };
      }
    }
    
    if (!finalPartnerChatId) {
      return {
        success: false,
        error: 'Не указан chat_id или username партнёра',
      };
    }
    
    // Read image as ArrayBuffer
    const imageBytes = await qrImage.arrayBuffer();
    
    // Create form data for Telegram
    const formData = new FormData();
    const blob = new Blob([imageBytes], { type: 'image/png' });
    formData.append('photo', blob, 'qr-code.png');
    formData.append('chat_id', String(finalPartnerChatId));
    
    let caption = `📱 **QR-код от клиента**\n\nКлиент ID: \`${clientChatId}\`\n`;
    if (serviceTitle) {
      caption += `Услуга: ${serviceTitle}\n`;
    }
    caption += `\nСканируйте QR-код для начисления баллов клиенту.\nИли используйте команду: \`➕ Начислить баллы\``;
    
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
    
    // Send photo via Telegram API
    const telegramUrl = `https://api.telegram.org/bot${env.TOKEN_PARTNER}/sendPhoto`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      body: formData,
    });
    
    if (!telegramResponse.ok) {
      const error = await telegramResponse.text();
      logError('sendQrToPartner', new Error(`Telegram API error: ${telegramResponse.status}`), { error });
      return {
        success: false,
        error: `Ошибка отправки QR-кода: ${telegramResponse.status}`,
      };
    }
    
    return {
      success: true,
    };
  } catch (error) {
    logError('sendQrToPartner', error, { clientChatId, partnerChatId, partnerUsername });
    return {
      success: false,
      error: `Ошибка отправки QR-кода: ${error.message}`,
    };
  }
}

/**
 * Handle Sentry webhook
 */
async function handleSentryWebhook(env, data) {
  try {
    // Format Sentry alert
    const event = data.event || {};
    const issue = data.issue || {};
    
    const title = event.title || issue.title || 'Unknown Error';
    const culprit = event.culprit || 'Unknown location';
    const level = (event.level || 'error').toUpperCase();
    const environment = event.environment || 'unknown';
    const release = event.release || 'unknown';
    const issueUrl = data.url || issue.permalink || '';
    
    const emojiMap = {
      'FATAL': '🔥',
      'ERROR': '❌',
      'WARNING': '⚠️',
      'INFO': 'ℹ️',
    };
    const emoji = emojiMap[level] || '🚨';
    
    let message = `${emoji} <b>SENTRY ALERT</b>\n\n`;
    message += `<b>${level}:</b> ${title}\n\n`;
    if (culprit) {
      message += `📍 <b>Location:</b> ${culprit}\n`;
    }
    if (environment) {
      message += `🌍 <b>Environment:</b> ${environment}\n`;
    }
    if (release) {
      message += `📦 <b>Release:</b> ${release}\n`;
    }
    if (data.count) {
      message += `🔢 <b>Events:</b> ${data.count}\n`;
    }
    if (issueUrl) {
      message += `\n🔗 <a href="${issueUrl}">View in Sentry</a>`;
    }
    
    // Send to Telegram admins
    if (env.ADMIN_CHAT_ID && env.ADMIN_BOT_TOKEN) {
      const adminIds = env.ADMIN_CHAT_ID.split(',').map(id => id.trim());
      for (const adminId of adminIds) {
        try {
          await fetch(`https://api.telegram.org/bot${env.ADMIN_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: adminId,
              text: message,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
          });
        } catch (error) {
          logError('handleSentryWebhook.sendMessage', error, { adminId });
        }
      }
    }
    
    return {
      status: 'ok',
      message: 'Alert sent to Telegram',
    };
  } catch (error) {
    logError('handleSentryWebhook', error, {});
    return {
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Get district availability map
 */
async function getDistrictAvailability(env, city) {
  try {
    const districts = [
      'Manhattan Downtown',
      'Manhattan Midtown',
      'Manhattan Upper East',
      'Manhattan Upper West',
      'Brooklyn Downtown',
      'Brooklyn North',
      'Brooklyn South + S.I.',
      'Queens West + Bronx South',
      'Queens East',
      'Brooklyn Central',
    ];
    
    const services = [
      'nail_care',
      'brow_design',
      'hair_salon',
      'hair_removal',
      'facial_aesthetics',
      'lash_services',
      'massage_therapy',
      'makeup_pmu',
      'body_wellness',
      'nutrition_coaching',
      'mindfulness_coaching',
      'image_consulting',
    ];
    
    // Get occupied positions from partners table
    const partners = await supabaseRequest(env, `partners?city=eq.${encodeURIComponent(city)}&select=district,business_type,status,chat_id,name`);
    
    // Build occupied map
    const occupied = {};
    if (partners) {
      for (const partner of partners) {
        const district = partner.district;
        const businessType = partner.business_type;
        
        // Check that both fields are filled and not 'All'
        if (district && 
            businessType && 
            district !== 'All' && 
            district.trim() !== '' && 
            businessType.trim() !== '') {
          const key = `${district}_${businessType}`;
          occupied[key] = {
            status: partner.status || 'Pending',
          };
        }
      }
    }
    
    // Build availability map
    const availability = {};
    for (const district of districts) {
      availability[district] = {};
      for (const service of services) {
        const key = `${district}_${service}`;
        if (occupied[key]) {
          const partnerStatus = occupied[key].status;
          if (partnerStatus === 'Approved') {
            availability[district][service] = 'taken';
          } else if (partnerStatus === 'Pending' || partnerStatus === 'Rejected') {
            availability[district][service] = 'pending';
          } else {
            availability[district][service] = 'available';
          }
        } else {
          availability[district][service] = 'available';
        }
      }
    }
    
    return availability;
  } catch (error) {
    logError('getDistrictAvailability', error, { city });
    return {};
  }
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Health check
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok' });
      }
      
      // Get client balance: GET /clients/:client_chat_id/balance
      const balanceMatch = path.match(/^\/clients\/([^/]+)\/balance$/);
      if (balanceMatch && request.method === 'GET') {
        const clientChatId = balanceMatch[1];
        const balance = await getClientBalance(env, clientChatId);
        return jsonResponse({
          client_chat_id: clientChatId,
          balance: balance,
        });
      }
      
      // Create transaction: POST /transactions
      if (path === '/transactions' && request.method === 'POST') {
        const body = await request.json();
        
        const { client_chat_id, partner_chat_id, txn_type, amount } = body;
        
        // Validation
        if (!client_chat_id || !partner_chat_id || !txn_type || !amount) {
          return jsonResponse({
            success: false,
            error: 'Отсутствуют обязательные поля: client_chat_id, partner_chat_id, txn_type, amount',
          }, 400);
        }
        
        if (txn_type !== 'accrual' && txn_type !== 'spend') {
          return jsonResponse({
            success: false,
            error: 'Неверный тип транзакции. Используйте "accrual" или "spend".',
          }, 400);
        }
        
        if (amount <= 0) {
          return jsonResponse({
            success: false,
            error: 'Сумма должна быть больше 0',
          }, 400);
        }
        
        const result = await executeTransaction(
          env,
          client_chat_id,
          partner_chat_id,
          txn_type,
          amount
        );
        
        if (!result.success) {
          return jsonResponse(result, 400);
        }
        
        return jsonResponse(result);
      }
      
      // Redeem promotion: POST /api/redeem-promotion
      if (path === '/api/redeem-promotion' && request.method === 'POST') {
        const body = await request.json();
        
        const { client_chat_id, promotion_id, points_to_spend } = body;
        
        // Validation
        if (!client_chat_id || !promotion_id || !points_to_spend) {
          return jsonResponse({
            success: false,
            error: 'Отсутствуют обязательные поля: client_chat_id, promotion_id, points_to_spend',
          }, 400);
        }
        
        if (points_to_spend <= 0) {
          return jsonResponse({
            success: false,
            error: 'Количество баллов должно быть больше 0',
          }, 400);
        }
        
        const result = await redeemPromotion(
          env,
          client_chat_id,
          promotion_id,
          points_to_spend
        );
        
        if (!result.success) {
          return jsonResponse(result, 400);
        }
        
        return jsonResponse(result);
      }
      
      // Translate text: POST /api/translate
      if (path === '/api/translate' && request.method === 'POST') {
        const body = await request.json();
        
        const { text, target_lang = 'en', source_lang = 'ru' } = body;
        
        // Validation
        if (!text || !text.trim()) {
          return jsonResponse({
            success: false,
            error: 'Текст для перевода не может быть пустым',
          }, 400);
        }
        
        // If languages are the same, return original
        if (source_lang === target_lang) {
          return jsonResponse({
            success: true,
            translated_text: text,
            original_text: text,
            source_lang: source_lang,
            target_lang: target_lang,
          });
        }
        
        const result = await translateText(env, text, target_lang, source_lang);
        
        if (!result.success) {
          return jsonResponse(result, 400);
        }
        
        return jsonResponse(result);
      }
      
      // Send QR to partner: POST /send-qr-to-partner
      if (path === '/send-qr-to-partner' && request.method === 'POST') {
        try {
          const contentType = request.headers.get('content-type') || '';
          
          if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('application/json')) {
            return jsonResponse({
              success: false,
              error: 'Content-Type должен быть multipart/form-data',
            }, 400);
          }
          
          const formData = await request.formData();
          const qrImage = formData.get('qr_image') || formData.get('qrImage');
          const clientChatId = formData.get('client_chat_id') || formData.get('clientChatId');
          const partnerChatId = formData.get('partner_chat_id') || formData.get('partnerChatId');
          const partnerUsername = formData.get('partner_username') || formData.get('partnerUsername');
          const serviceTitle = formData.get('service_title') || formData.get('serviceTitle') || '';
          const serviceId = formData.get('service_id') || formData.get('serviceId') || '';
          
          if (!qrImage || !clientChatId) {
            return jsonResponse({
              success: false,
              error: 'Отсутствуют обязательные поля: qr_image, client_chat_id',
            }, 400);
          }
          
          const result = await sendQrToPartner(
            env,
            qrImage,
            clientChatId,
            partnerChatId,
            partnerUsername,
            serviceTitle
          );
          
          if (!result.success) {
            return jsonResponse(result, 400);
          }
          
          return jsonResponse(result);
        } catch (error) {
          logError('send-qr-to-partner handler', error, {});
          return jsonResponse({
            success: false,
            error: `Ошибка обработки запроса: ${error.message}`,
          }, 500);
        }
      }
      
      // Sentry webhook: POST /api/sentry-webhook
      if (path === '/api/sentry-webhook' && request.method === 'POST') {
        const body = await request.json();
        const result = await handleSentryWebhook(env, body);
        return jsonResponse(result);
      }
      
      // District availability: GET /api/district-availability
      if (path === '/api/district-availability' && request.method === 'GET') {
        const urlParams = new URLSearchParams(url.search);
        const city = urlParams.get('city') || 'New York';
        const result = await getDistrictAvailability(env, city);
        return jsonResponse(result);
      }
      
      // Get or create referral code: GET /api/referral-code/:chat_id
      const referralCodeMatch = path.match(/^\/api\/referral-code\/([^/]+)$/);
      if (referralCodeMatch && request.method === 'GET') {
        const chatId = referralCodeMatch[1];
        const code = await getOrCreateReferralCode(env, chatId);
        if (!code) {
          return jsonResponse({ error: 'Не удалось получить или создать реферальный код' }, 400);
        }
        return jsonResponse({ referral_code: code });
      }
      
      // 404 for unknown routes
      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      logError('API request', error, { path, method: request.method });
      return jsonResponse({
        error: 'Internal server error',
        message: error.message,
      }, 500);
    }
  },
};
