/**
 * Partner Bot Webhook - Cloudflare Worker
 * Handles webhook requests from Telegram for partner bot
 */

import { routeUpdate } from './partner.js';
import { 
  validateTelegramWebhook, 
  parseTelegramUpdate, 
  successResponse, 
  errorResponse,
  logError,
} from './common.js';
import { trackPerformance } from './sentry.js';

/**
 * Main webhook handler
 */
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    let update = null;

    console.log('[Worker] Request received:', {
      method: request.method,
      url: request.url,
    });
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      console.log('[Worker] Handling OPTIONS request');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token',
        },
      });
    }

    // Register webhook: GET /setup-webhook?key=<WEBHOOK_SECRET_TOKEN>
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/setup-webhook') {
      const key = url.searchParams.get('key');
      if (!env.WEBHOOK_SECRET_TOKEN || key !== env.WEBHOOK_SECRET_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      const webhookUrl = `${url.origin}/`;
      const res = await fetch(`https://api.telegram.org/bot${env.TOKEN_PARTNER}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: env.WEBHOOK_SECRET_TOKEN,
          allowed_updates: ['message', 'callback_query', 'edited_message'],
        }),
      });
      const result = await res.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      console.log('[Worker] Invalid method:', request.method);
      return errorResponse('Method not allowed', 405);
    }

    try {
      console.log('[Worker] Processing POST request');
      
      // Validate webhook secret token (if configured)
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      if (secretToken) {
        console.log('[Worker] Validating webhook secret token');
        if (!validateTelegramWebhook(request, secretToken)) {
          console.error('[Worker] Invalid secret token');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Worker] Secret token validated');
      } else {
        console.log('[Worker] No secret token configured, skipping validation');
      }

      // Parse Telegram update
      console.log('[Worker] Parsing Telegram update');
      update = await parseTelegramUpdate(request);
      console.log('[Worker] Update parsed:', {
        hasCallback: !!update.callback_query,
        hasMessage: !!update.message,
        callbackData: update.callback_query?.data,
        messageText: update.message?.text,
      });
      
      // Route update to appropriate handler
      console.log('[Worker] Routing update');
      const result = await routeUpdate(env, update);
      console.log('[Worker] Update processed successfully:', result);
      
      // Track performance
      const duration = Date.now() - startTime;
      if (env.SENTRY_DSN) {
        trackPerformance('webhook.partner', duration, {
          worker: 'partner-webhook',
          update_id: update.update_id,
        }, env.SENTRY_DSN, env.SENTRY_ENVIRONMENT || 'production').catch(() => {});
      }
      
      // Return success response
      return successResponse(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('[Worker] ERROR:', error);
      console.error('[Worker] Error stack:', error.stack);
      
      // Log error with full context
      await logError('Webhook processing', error, {
        url: request.url,
        method: request.method,
        duration_ms: duration,
        update_id: update?.update_id,
      }, request, env, update);
      
      // Track failed request performance
      if (env.SENTRY_DSN) {
        trackPerformance('webhook.partner.error', duration, {
          worker: 'partner-webhook',
          error: error.message,
          update_id: update?.update_id,
        }, env.SENTRY_DSN, env.SENTRY_ENVIRONMENT || 'production').catch(() => {});
      }
      
      // Still return 200 to Telegram to prevent retries
      return successResponse({ error: error.message });
    }
  },
};
