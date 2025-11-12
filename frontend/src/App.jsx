import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import About from './pages/About'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import Analytics from './pages/Analytics'
import PartnerAnalytics from './pages/PartnerAnalytics'
import AdminAnalytics from './pages/AdminAnalytics'
import OnePagerPartner from './pages/OnePagerPartner'
import OnePagerClient from './pages/OnePagerClient'
import OnePagerInvestor from './pages/OnePagerInvestor'
import TestPage from './pages/TestPage'
import Activity from './pages/Activity'
import Community from './pages/Community'
import Message from './pages/Message'
import PalettePreview from './pages/PalettePreview'

// Components
import Navigation from './components/Navigation'
import ErrorBoundary from './components/ErrorBoundary'

// Публичные маршруты, которые не требуют Telegram авторизации
const PUBLIC_ROUTES = [
  '/onepager/partner',
  '/onepager/client',
  '/onepager/investor',
  '/partner/analytics',
  '/admin/analytics',
  '/partner/apply',
  '/privacy',
  '/terms',
  '/test'
]

// Компонент для условного отображения навигации
function AppContent() {
  const location = useLocation()
  console.log('AppContent: location =', location.pathname)
  
  const chatId = getChatId()
  console.log('AppContent: chatId =', chatId)
  
  // Проверяем, является ли текущий маршрут публичным
  const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route))
  console.log('AppContent: isPublicRoute =', isPublicRoute, 'for path', location.pathname)
  
  // Для приватных маршрутов требуем авторизацию
  // if (!isPublicRoute && !chatId) {
  //   console.log('AppContent: Showing auth error - private route without chatId')
  //   return (
  //     <div className="flex items-center justify-center min-h-screen p-4">
  //       <div className="text-center">
  //         <h1 className="text-2xl font-bold mb-4">⚠️ Ошибка</h1>
  //         <p className="text-gray-600 dark:text-gray-400">
  //           Пожалуйста, откройте приложение через Telegram бота
  //         </p>
  //       </div>
  //     </div>
  //   )
  // }

  console.log('AppContent: Rendering main content')
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Основной контент */}
      <main className={isPublicRoute ? "flex-1" : "flex-1 pb-16"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/services" element={<Services />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/community" element={<Community />} />
          <Route path="/message" element={<Message />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/partner/apply" element={<PartnerApply />} />
          <Route path="/analytics" element={<Analytics />} />
          {/* Публичные роуты для юридических документов */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* Публичные роуты для дашбордов и одностраничников */}
          <Route path="/partner/analytics" element={<PartnerAnalytics />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/onepager/partner" element={<OnePagerPartner />} />
          <Route path="/onepager/client" element={<OnePagerClient />} />
          <Route path="/onepager/investor" element={<OnePagerInvestor />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/palette" element={<PalettePreview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Нижняя навигация - только для приватных страниц */}
      {!isPublicRoute && <Navigation />}
    </div>
  )
}

function App() {
  console.log('App: Starting...')
  const tg = getTelegramWebApp()
  const colorScheme = getColorScheme()
  console.log('App: tg =', tg, 'colorScheme =', colorScheme)

  useEffect(() => {
    console.log('App: useEffect triggered')
    // Инициализация Telegram Web App
    if (tg) {
      console.log('App: Initializing Telegram WebApp')
      tg.ready()
      tg.expand()
      
      // Устанавливаем цветовую схему
      document.documentElement.className = colorScheme
    } else {
      console.log('App: No Telegram WebApp, using default theme')
      document.documentElement.className = colorScheme || 'light'
    }
  }, [tg, colorScheme])

  return (
    <ErrorBoundary>
      <AppRoot appearance={colorScheme}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppRoot>
    </ErrorBoundary>
  )
}

export default App

