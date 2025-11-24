/**
 * Vercel Edge Function для переопределения заголовков
 * Решение проблемы X-Frame-Options для Telegram Web App
 * 
 * Для Vercel Edge Functions middleware должен быть в корне проекта
 */

export default function middleware(request) {
  // Проксируем запрос и переопределяем заголовки
  return fetch(request).then(response => {
    // Создаём новый Response с переопределёнными заголовками
    const newHeaders = new Headers(response.headers)
    
    // Удаляем X-Frame-Options (не устанавливаем заголовок)
    newHeaders.delete('X-Frame-Options')
    
    // Разрешаем встраивание в iframe для всех доменов
    newHeaders.set('Content-Security-Policy', 'frame-ancestors *')
    
    // Дополнительные заголовки для кэширования
    newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    newHeaders.set('Pragma', 'no-cache')
    newHeaders.set('Expires', '0')
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    })
  })
}

// Конфигурация для Vercel Edge Functions
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
}

