/**
 * Client Bot Webhook - Cloudflare Worker
 * Handles webhook requests from Telegram for client bot
 */

import { routeUpdate } from './client.js';
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

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
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
      const res = await fetch(`https://api.telegram.org/bot${env.TOKEN_CLIENT}/setWebhook`, {
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
      return errorResponse('Method not allowed', 405);
    }

    try {
      // Validate webhook secret token
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      if (secretToken) {
        const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (receivedToken !== secretToken) {
          console.error('[Webhook] Invalid or missing secret token');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated');
      }

      // Parse Telegram update
      update = await parseTelegramUpdate(request);
      
      // Route update to appropriate handler
      const result = await routeUpdate(env, update);
      
      // Track performance
      const duration = Date.now() - startTime;
      if (env.SENTRY_DSN) {
        trackPerformance('webhook.client', duration, {
          worker: 'client-webhook',
          update_id: update.update_id,
        }, env.SENTRY_DSN, env.SENTRY_ENVIRONMENT || 'production').catch(() => {});
      }
      
      // Return success response
      return successResponse(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error with full context
      await logError('Webhook processing', error, {
        url: request.url,
        method: request.method,
        duration_ms: duration,
        update_id: update?.update_id,
      }, request, env, update);
      
      // Track failed request performance
      if (env.SENTRY_DSN) {
        trackPerformance('webhook.client.error', duration, {
          worker: 'client-webhook',
          error: error.message,
          update_id: update?.update_id,
        }, env.SENTRY_DSN, env.SENTRY_ENVIRONMENT || 'production').catch(() => {});
      }
      
      // Still return 200 to Telegram to prevent retries
      return successResponse({ error: error.message });
    }
  },
};
