/**
 * RU API Proxy — проксирует запросы на основной loyalitybot-api.
 * Деплоить на отдельный аккаунт/регион без блокировок Cloudflare.
 */

export default {
  async fetch(request, env, ctx) {
    const targetBase = env.TARGET_API_URL
    if (!targetBase) {
      return new Response('TARGET_API_URL not configured', { status: 500 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400'
        }
      })
    }

    const url = new URL(request.url)
    const targetUrl = targetBase.replace(/\/$/, '') + url.pathname + url.search

    const headers = new Headers(request.headers)
    headers.set('X-Forwarded-From', 'ru-proxy')

    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body
    })

    const resHeaders = new Headers(res.headers)
    resHeaders.set('Access-Control-Allow-Origin', '*')

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders
    })
  }
}
