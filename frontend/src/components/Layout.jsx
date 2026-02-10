import React from 'react'

/**
 * Базовый layout для Telegram Mini App.
 * - Учитывает верхнюю панель Telegram (safe-area + небольшой отступ).
 * - Оставляет место под нижнюю навигацию (Navigation с высотой ~64px).
 *
 * Использование:
 * <Layout>
 *   {/* страница/контент *\/}
 * </Layout>
 */
const Layout = ({ children }) => {
  return (
    <div
      className="
        min-h-screen
        bg-tg-bg
        text-tg-text
        pt-[calc(env(safe-area-inset-top)+12px)]
        pb-[calc(env(safe-area-inset-bottom)+64px)]
      "
    >
      {children}
    </div>
  )
}

export default Layout

