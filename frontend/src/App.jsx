import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppRoot } from '@telegram-apps/telegram-ui'
import { getTelegramWebApp, getChatId, getColorScheme } from './utils/telegram'

// Pages
import Home from './pages/Home'
import Promotions from './pages/Promotions'
import PromotionDetail from './pages/PromotionDetail'
import Services from './pages/Services'
import AllCategories from './pages/AllCategories'
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
import PartnerIncomePresentation from './pages/PartnerIncomePresentation'
import BeautyPartnerPresentation from './pages/BeautyPartnerPresentation'
import AvailabilityMap from './pages/AvailabilityMap'
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
  '/partner/income-presentation',
  '/partner/beauty-presentation',
  '/partner/analytics',
  '/admin/analytics',
  '/partner/apply',
  '/availability-map',
  '/privacy',
  '/terms',
  '/test'
]

// Компонент для условного отображения навигации
function AppContent() {
  const location = useLocation()
  const chatId = getChatId()
  
  // Проверяем, является ли текущий маршрут публичным
  const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route))
  
  // Для приватных маршрутов требуем авторизацию
  // if (!isPublicRoute && !chatId) {
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
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Основной контент */}
      <main className={isPublicRoute ? "flex-1" : "flex-1 pb-16"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/promotions/:id" element={<PromotionDetail />} />
          <Route path="/services" element={<Services />} />
          <Route path="/categories" element={<AllCategories />} />
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
          <Route path="/partner/income-presentation" element={<PartnerIncomePresentation />} />
          <Route path="/partner/beauty-presentation" element={<BeautyPartnerPresentation />} />
          <Route path="/availability-map" element={<AvailabilityMap />} />
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
  const tg = getTelegramWebApp()
  const colorScheme = getColorScheme()
  const initialized = useRef(false)

  useEffect(() => {
    // Инициализация выполняется только один раз
    if (initialized.current) {
      return
    }
    
    initialized.current = true
    
    // Инициализация Telegram Web App
    if (tg) {
      tg.ready()
      tg.expand()
      
      // Проверяем версию API перед вызовом неподдерживаемых функций
      const version = tg.version || '6.0'
      const majorVersion = parseInt(version.split('.')[0])
      
      // Эти функции поддерживаются только в версиях < 6.0
      if (majorVersion < 6) {
        try {
          // Показываем подтверждение перед закрытием
          if (tg.enableClosingConfirmation && typeof tg.enableClosingConfirmation === 'function') {
            tg.enableClosingConfirmation()
          }
          // Отключаем вертикальные свайпы
          if (tg.disableVerticalSwipes && typeof tg.disableVerticalSwipes === 'function') {
            tg.disableVerticalSwipes()
          }
        } catch (error) {
          // Игнорируем ошибки для неподдерживаемых функций
        }
      }
      
      // Устанавливаем цветовую схему
      document.documentElement.className = colorScheme || 'light'
    } else {
      document.documentElement.className = colorScheme || 'light'
    }
  }, []) // Пустой массив зависимостей - выполняется только один раз

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

