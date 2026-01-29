/**
 * Cloudflare Worker: Exchange Rates Cron
 * 
 * Обновляет курсы валют раз в день из внешнего API
 * Поддерживаемые валюты: USD, VND, RUB, KZT
 */

const SUPPORTED_CURRENCIES = ['VND', 'RUB', 'KZT'];

/**
 * Получает курсы валют из API
 * Использует бесплатный API exchangerate-api.com
 */
async function fetchExchangeRates(env) {
  // Основной API (бесплатный, 1500 запросов/месяц)
  const apiUrl = 'https://api.exchangerate-api.com/v4/latest/USD';
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('Invalid API response: missing rates');
    }
    
    // Извлекаем нужные курсы
    const rates = {};
    for (const currency of SUPPORTED_CURRENCIES) {
      if (data.rates[currency]) {
        rates[currency] = data.rates[currency];
      }
    }
    
    console.log('[ExchangeRates] Fetched rates:', rates);
    return rates;
    
  } catch (error) {
    console.error('[ExchangeRates] Error fetching rates:', error);
    
    // Fallback: пробуем альтернативный API
    return await fetchExchangeRatesFallback(env);
  }
}

/**
 * Альтернативный источник курсов (fallback)
 */
async function fetchExchangeRatesFallback(env) {
  // Используем frankfurter.app (бесплатный, без лимитов)
  const apiUrl = 'https://api.frankfurter.app/latest?from=USD&to=VND,RUB,KZT';
  
  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Fallback API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('Invalid fallback API response');
    }
    
    console.log('[ExchangeRates] Fallback rates:', data.rates);
    return data.rates;
    
  } catch (error) {
    console.error('[ExchangeRates] Fallback also failed:', error);
    
    // Если оба API недоступны, возвращаем дефолтные курсы
    return {
      VND: 25000,
      RUB: 100,
      KZT: 520,
    };
  }
}

/**
 * Обновляет курсы в Supabase
 */
async function updateRatesInSupabase(env, rates) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
  }
  
  const results = [];
  const now = new Date().toISOString();
  
  for (const [currency, rate] of Object.entries(rates)) {
    try {
      // Используем upsert с ON CONFLICT
      const response = await fetch(`${supabaseUrl}/rest/v1/currency_exchange_rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          from_currency: 'USD',
          to_currency: currency,
          rate: rate,
          source: 'api_cron',
          effective_from: now,
          updated_at: now,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ExchangeRates] Error updating ${currency}:`, errorText);
        results.push({ currency, success: false, error: errorText });
      } else {
        console.log(`[ExchangeRates] Updated USD→${currency}: ${rate}`);
        results.push({ currency, success: true, rate });
      }
      
    } catch (error) {
      console.error(`[ExchangeRates] Error updating ${currency}:`, error);
      results.push({ currency, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Главный обработчик scheduled event (cron)
 */
async function handleScheduled(event, env, ctx) {
  console.log('[ExchangeRates] Cron triggered at:', new Date().toISOString());
  
  try {
    // 1. Получаем курсы
    const rates = await fetchExchangeRates(env);
    
    if (Object.keys(rates).length === 0) {
      console.error('[ExchangeRates] No rates fetched');
      return;
    }
    
    // 2. Обновляем в БД
    const results = await updateRatesInSupabase(env, rates);
    
    // 3. Логируем результат
    const successCount = results.filter(r => r.success).length;
    console.log(`[ExchangeRates] Updated ${successCount}/${SUPPORTED_CURRENCIES.length} currencies`);
    
    // Опционально: отправить уведомление в Telegram (если настроено)
    if (env.ADMIN_CHAT_ID && env.ADMIN_BOT_TOKEN) {
      const message = `💱 Курсы валют обновлены\n\n` +
        results.map(r => 
          r.success 
            ? `✅ USD→${r.currency}: ${r.rate}` 
            : `❌ ${r.currency}: ${r.error}`
        ).join('\n');
      
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, env.ADMIN_CHAT_ID, message);
    }
    
  } catch (error) {
    console.error('[ExchangeRates] Cron job failed:', error);
  }
}

/**
 * HTTP обработчик для ручного запуска
 */
async function handleRequest(request, env) {
  // Защита: только POST с секретным токеном
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  const authHeader = request.headers.get('Authorization');
  const expectedToken = env.CRON_SECRET_TOKEN;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  console.log('[ExchangeRates] Manual trigger via HTTP');
  
  try {
    const rates = await fetchExchangeRates(env);
    const results = await updateRatesInSupabase(env, rates);
    
    return new Response(JSON.stringify({
      success: true,
      rates,
      results,
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Отправляет сообщение в Telegram (опционально)
 */
async function sendTelegramMessage(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('[ExchangeRates] Failed to send Telegram notification:', error);
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env, ctx));
  },
  
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
