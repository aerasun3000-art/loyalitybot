/**
 * Проверяет tg_auth в URL при открытии "В браузере".
 * Вызывает API для верификации, сохраняет chat_id в sessionStorage.
 */
import { useState, useEffect } from 'react'
import { setStoredChatId, setStoredUserName, getTelegramWebApp } from '../utils/telegram'

const API_URL = import.meta.env.VITE_API_URL

export default function AuthBootstrap({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const run = async () => {
      const tg = getTelegramWebApp()
      if (tg?.initDataUnsafe?.user) {
        setReady(true)
        return
      }
      const params = new URLSearchParams(window.location.search)
      const tgAuth = params.get('tg_auth')
      if (!tgAuth) {
        setReady(true)
        return
      }
      if (!API_URL) {
        setError('VITE_API_URL не настроен')
        setReady(true)
        return
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/verify?tg_auth=${encodeURIComponent(tgAuth)}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Ошибка авторизации')
          setReady(true)
          return
        }
        if (data.chat_id) {
          setStoredChatId(data.chat_id)
          if (data.name) setStoredUserName(data.name)
          const url = new URL(window.location.href)
          url.searchParams.delete('tg_auth')
          window.history.replaceState({}, '', url.toString())
        }
      } catch (err) {
        setError(err.message || 'Ошибка сети')
      }
      setReady(true)
    }
    run()
  }, [])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sakura-cream dark:bg-sakura-dark">
        <div className="text-center p-6">
          <div className="animate-spin w-10 h-10 border-2 border-sakura-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sakura-text dark:text-sakura-text-dark">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sakura-cream dark:bg-sakura-dark p-4">
        <div className="text-center max-w-md">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <p className="text-sm text-sakura-text dark:text-sakura-text-dark">
            Откройте приложение через Telegram и нажмите «В браузере» для получения новой ссылки.
          </p>
        </div>
      </div>
    )
  }

  return children
}
