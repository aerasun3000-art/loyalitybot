import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppRoot } from '@telegram-apps/telegram-ui'
import { getTelegramWebApp, getChatId, getColorScheme } from './utils/telegram'

// Pages
import Home from './pages/Home'
import Promotions from './pages/Promotions'
import Services from './pages/Services'
import History from './pages/History'
import Profile from './pages/Profile'
import News from './pages/News'
import NewsDetail from './pages/NewsDetail'
import PartnerApply from './pages/PartnerApply'

// Components
import Navigation from './components/Navigation'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const tg = getTelegramWebApp()
  const chatId = getChatId()
  const colorScheme = getColorScheme()

  useEffect(() => {
    // Инициализация Telegram Web App
    if (tg) {
      tg.ready()
      tg.expand()
      
      // Устанавливаем цветовую схему
      document.documentElement.className = colorScheme
    }
  }, [tg, colorScheme])

  // Проверка авторизации через Telegram
  if (!chatId) {
    return (
      <AppRoot appearance={colorScheme}>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">⚠️ Ошибка</h1>
            <p className="text-gray-600">
              Пожалуйста, откройте приложение через Telegram бота
            </p>
          </div>
        </div>
      </AppRoot>
    )
  }

  return (
    <ErrorBoundary>
      <AppRoot appearance={colorScheme}>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen">
            {/* Основной контент */}
            <main className="flex-1 pb-16">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/services" element={<Services />} />
                <Route path="/news" element={<News />} />
                <Route path="/news/:id" element={<NewsDetail />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/partner/apply" element={<PartnerApply />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            {/* Нижняя навигация */}
            <Navigation />
          </div>
        </BrowserRouter>
      </AppRoot>
    </ErrorBoundary>
  )
}

export default App

