/**
 * Admin Bot Webhook - Cloudflare Worker
 * Handles webhook requests from Telegram for admin bot
 */

import { routeUpdate } from './admin.js';
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

    // Only accept POST requests
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    try {
      // Validate webhook secret token (optional - only if configured and sent by Telegram)
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      const receivedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      
      // Only validate if both secret token is configured AND Telegram sends it
      // If Telegram doesn't send the token header, we skip validation
      if (secretToken && receivedToken) {
        if (receivedToken !== secretToken) {
          console.error('[Webhook] Invalid secret token');
          await logError('Webhook validation', new Error('Invalid secret token'), {
            url: request.url,
            method: request.method,
          }, request, env);
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated successfully');
      } else {
        console.log('[Webhook] Secret token validation skipped (not configured or not sent by Telegram)');
      }

      // Parse Telegram update
      update = await parseTelegramUpdate(request);
      
      // Route update to appropriate handler
      const result = await routeUpdate(env, update);
      
      // Track performance
      const duration = Date.now() - startTime;
      if (env.SENTRY_DSN) {
        trackPerformance('webhook.admin', duration, {
          worker: 'admin-webhook',
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
        trackPerformance('webhook.admin.error', duration, {
          worker: 'admin-webhook',
          error: error.message,
          update_id: update?.update_id,
        }, env.SENTRY_DSN, env.SENTRY_ENVIRONMENT || 'production').catch(() => {});
      }
      
      // Still return 200 to Telegram to prevent retries
      return successResponse({ error: error.message });
    }
  },
};
