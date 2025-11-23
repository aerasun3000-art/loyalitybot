/**
 * Vercel Edge Function для переопределения заголовков
 * Решение проблемы X-Frame-Options для Telegram Web App
 */

export default function middleware(request) {
  // Создаём новый Response с переопределёнными заголовками
  const response = new Response(request.body, {
    status: 200,
    headers: {
      ...request.headers,
      // Удаляем X-Frame-Options (пустая строка удаляет заголовок)
      'X-Frame-Options': '',
      // Разрешаем встраивание в iframe для всех доменов
      'Content-Security-Policy': "frame-ancestors *",
      // Дополнительные заголовки для кэширования
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
  
  return response
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

