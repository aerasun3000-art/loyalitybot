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
      // Validate webhook secret token (if configured)
      const secretToken = env.WEBHOOK_SECRET_TOKEN;
      if (secretToken && !validateTelegramWebhook(request, secretToken)) {
        logError('Webhook validation', new Error('Invalid secret token'), {});
        return errorResponse('Unauthorized', 401);
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
