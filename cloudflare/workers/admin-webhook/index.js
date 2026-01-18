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

/**
 * Main webhook handler
 */
export default {
  async fetch(request, env, ctx) {
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
          logError('Webhook validation', new Error('Invalid secret token'), {});
          return errorResponse('Unauthorized', 401);
        }
        console.log('[Webhook] Secret token validated successfully');
      } else {
        console.log('[Webhook] Secret token validation skipped (not configured or not sent by Telegram)');
      }

      // Parse Telegram update
      const update = await parseTelegramUpdate(request);
      
      // Route update to appropriate handler
      const result = await routeUpdate(env, update);
      
      // Return success response
      return successResponse(result);
      
    } catch (error) {
      logError('Webhook processing', error, {
        url: request.url,
        method: request.method,
      });
      
      // Still return 200 to Telegram to prevent retries
      // Log error to Sentry or monitoring service
      return successResponse({ error: error.message });
    }
  },
};
