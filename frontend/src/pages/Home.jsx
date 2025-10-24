import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Title, Text, Button, Avatar } from '@telegram-apps/telegram-ui'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices } from '../services/supabase'
import { getServiceIcon, defaultServiceIcons } from '../utils/serviceIcons'
import Loader from '../components/Loader'
import LoyaltyProgress from '../components/LoyaltyProgress'
import { 
  BalanceSkeleton, 
  CarouselCardSkeleton, 
  NewsCardSkeleton, 
  ServiceSkeleton 
} from '../components/SkeletonCard'

const Home = () => {
  const navigate = useNavigate()
  const user = getTelegramUser()
  const chatId = getChatId()
  
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [userName, setUserName] = useState('')
  const [promotions, setPromotions] = useState([])
  const [services, setServices] = useState([])
  const [language, setLanguage] = useState('ru')

  useEffect(() => {
    loadData()
  }, [chatId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Загружаем данные параллельно
      const [balanceData, promotionsData, servicesData] = await Promise.all([
        getClientBalance(chatId),
        getActivePromotions(),
        getApprovedServices()
      ])
      
      setBalance(balanceData?.balance || 0)
      setUserName(balanceData?.name || user?.first_name || 'Гость')
      setPromotions(promotionsData.slice(0, 5)) // Первые 5 акций
      setServices(servicesData.slice(0, 8)) // Первые 8 услуг
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleServiceClick = (serviceId) => {
    hapticFeedback('light')
    navigate(`/services?id=${serviceId}`)
  }

  const handlePromotionClick = (promoId) => {
    hapticFeedback('light')
    navigate(`/promotions?id=${promoId}`)
  }

  const toggleLanguage = () => {
    hapticFeedback('light')
    setLanguage(prev => prev === 'ru' ? 'en' : 'ru')
  }

  // Skeleton вместо Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-400 via-pink-300 to-white">
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-8 bg-white/50 rounded w-32 animate-pulse" />
            <div className="h-10 bg-white/50 rounded-full w-16 animate-pulse" />
          </div>
          <BalanceSkeleton />
        </div>

        <div className="px-4 mb-6">
          <div className="overflow-x-auto flex gap-4 pb-2">
            <CarouselCardSkeleton />
            <CarouselCardSkeleton />
          </div>
        </div>

        <div className="bg-white rounded-t-[2rem] px-4 pt-6 pb-24">
          <div className="h-8 bg-pink-100 rounded w-32 mb-4 animate-pulse" />
          <div className="overflow-x-auto flex gap-3 pb-4 mb-6">
            <NewsCardSkeleton />
            <NewsCardSkeleton />
            <NewsCardSkeleton />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <ServiceSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-400 via-pink-300 to-white">
      {/* Шапка с приветствием */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            Hi {userName}
          </h1>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-white rounded-full px-3 py-2 shadow-sm"
          >
            <span className="text-lg">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-gray-600"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Карточка с балансом и прогрессом */}
        <div className="bg-white rounded-3xl p-4 card-shadow hover:card-shadow-hover transition-all duration-300">
          <p className="text-pink-500 font-semibold text-base mb-3">
            {language === 'ru' 
              ? 'Используйте баллы для получения услуг и скидок!'
              : 'Use points to get services and discounts!'}
          </p>
          
          {/* Баланс */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                <span className="text-pink-500 text-lg">💰</span>
              </div>
              <span className="font-bold text-gray-800">{balance} баллов</span>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-gray-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 10L11 14L15 10" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Прогресс-бар статуса лояльности */}
          <LoyaltyProgress balance={balance} />
        </div>
      </div>

      {/* Карусель топовых акций */}
      {promotions.length > 0 && (
        <div className="px-4 mb-6">
          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide">
            {promotions.map((promo, index) => {
              // Массив градиентов для визуального разнообразия
              const gradients = [
                'from-pink-400 via-rose-400 to-pink-500',
                'from-purple-400 via-pink-400 to-rose-400',
                'from-rose-400 via-pink-500 to-purple-400',
                'from-pink-500 via-purple-400 to-pink-400'
              ]
              const gradient = gradients[index % gradients.length]
              
              // Массив иконок для визуального оформления
              const icons = ['🎁', '✨', '💖', '🌸', '💎', '🎉']
              const icon = icons[index % icons.length]
              
              return (
                <div
                  key={promo.id}
                  onClick={() => handlePromotionClick(promo.id)}
                  className="flex-shrink-0 w-[85vw] cursor-pointer transform hover:-translate-y-1 active:scale-98 transition-all duration-300"
                >
                  <div className={`bg-gradient-to-br ${gradient} rounded-3xl overflow-hidden card-shadow hover:card-shadow-hover`}>
                    {/* Изображение-placeholder */}
                    <div className="h-48 bg-white/10 backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                      <span className="text-9xl opacity-30 absolute">{icon}</span>
                      <div className="relative z-10 text-center">
                        <span className="text-7xl drop-shadow-lg">{icon}</span>
                      </div>
                    </div>
                    
                    {/* Контент */}
                    <div className="p-6">
                      <h3 className="text-white font-bold text-xl mb-2 line-clamp-2">
                        {promo.title}
                      </h3>
                      <p className="text-white/90 text-sm mb-4 line-clamp-2">
                        {promo.description?.substring(0, 100)}...
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold">
                          {promo.partner?.company_name || promo.partner?.name}
                        </span>
                        <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-semibold">
                          До {new Date(promo.end_date).toLocaleDateString('ru')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Индикаторы */}
          <div className="flex justify-center gap-2 mt-3">
            {promotions.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === 0 ? 'w-6 bg-pink-500' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Секция промо и новостей сообщества */}
      <div className="bg-white rounded-t-[2rem] px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {language === 'ru' ? '🌟 Новости' : '🌟 News'}
          </h2>
        </div>
        
        {/* Карусель новостей */}
        <div className="overflow-x-auto flex gap-3 pb-4 scrollbar-hide mb-6">
          {/* Карточка 1: Добро пожаловать */}
          <div className="flex-shrink-0 w-64 bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl overflow-hidden border border-pink-200 shadow-sm hover:shadow-md transform hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="h-24 bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-white/10" />
              <span className="text-6xl relative z-10 drop-shadow-lg">📢</span>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                Добро пожаловать!
              </h3>
              <p className="text-sm text-gray-600">
                Накапливайте баллы за каждую покупку у наших партнёров и обменивайте на услуги!
              </p>
            </div>
          </div>
          
          {/* Карточка 2: Акции месяца */}
          <div className="flex-shrink-0 w-64 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl overflow-hidden border border-purple-200 shadow-sm hover:shadow-md transform hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="h-24 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-white/10" />
              <span className="text-6xl relative z-10 drop-shadow-lg">🎉</span>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                Акции месяца
              </h3>
              <p className="text-sm text-gray-600">
                Специальные предложения от партнёров - скидки до 50%!
              </p>
            </div>
          </div>
          
          {/* Карточка 3: Реферальная программа */}
          <div className="flex-shrink-0 w-64 bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl overflow-hidden border border-rose-200 shadow-sm hover:shadow-md transform hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="h-24 bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-white/10" />
              <span className="text-6xl relative z-10 drop-shadow-lg">🎁</span>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                Реферальная программа
              </h3>
              <p className="text-sm text-gray-600">
                Приглашайте друзей и получайте бонусные баллы за каждого!
              </p>
            </div>
          </div>
        </div>

        {/* Секция Services */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {language === 'ru' ? 'Услуги' : 'Services'}
          </h2>
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1"
          >
            <span className="text-pink-500 font-semibold">
              {language === 'ru' ? 'Все' : 'See all'}
            </span>
            {services.length > 8 && (
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                NEW
              </span>
            )}
          </button>
        </div>

        {/* Сетка услуг 4x2 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(services.length > 0 ? services.slice(0, 8) : defaultServiceIcons.slice(0, 8)).map((item, index) => {
            const isService = services.length > 0
            const serviceIcon = isService ? getServiceIcon(item.title || item.name) : item.icon
            const serviceName = isService ? (item.title || item.name) : (language === 'ru' ? item.name : item.nameEn)
            const serviceId = isService ? item.id : null
            
            return (
              <div
                key={serviceId || index}
                onClick={() => isService && handleServiceClick(serviceId)}
                className={`flex flex-col items-center ${isService ? 'cursor-pointer' : ''}`}
              >
                <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center mb-2 relative hover:bg-pink-200 hover:scale-110 active:scale-95 transition-all duration-200">
                  <span className="text-3xl">
                    {serviceIcon}
                  </span>
                  {isService && index < 2 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-center text-gray-700 leading-tight">
                  {serviceName?.length > 15 
                    ? serviceName.substring(0, 15) + '...' 
                    : serviceName}
                </span>
              </div>
            )
          })}
        </div>

        {/* Секция Акции */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {language === 'ru' ? '🎁 Акции партнёров' : '🎁 Partner Deals'}
            </h2>
            <button
              onClick={() => navigate('/promotions')}
              className="text-pink-500 font-semibold"
            >
              {language === 'ru' ? 'Все акции →' : 'All deals →'}
            </button>
          </div>

          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide">
            {promotions.slice(0, 3).map((promo, index) => {
              // Градиенты для разнообразия
              const imageGradients = [
                'from-pink-300 via-pink-400 to-rose-400',
                'from-purple-300 via-pink-300 to-pink-400',
                'from-rose-300 via-pink-400 to-purple-300'
              ]
              const imageGradient = imageGradients[index % imageGradients.length]
              
              // Иконки
              const dealIcons = ['🎁', '✨', '💝', '🌟', '💖']
              const dealIcon = dealIcons[index % dealIcons.length]
              
              return (
                <div
                  key={promo.id}
                  onClick={() => handlePromotionClick(promo.id)}
                  className="flex-shrink-0 w-72 cursor-pointer group"
                >
                  <div className="bg-white rounded-2xl overflow-hidden card-shadow group-hover:card-shadow-hover transition-all duration-300 active:scale-98">
                    {/* Изображение-placeholder */}
                    <div className={`h-40 bg-gradient-to-br ${imageGradient} flex items-center justify-center relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <span className="text-8xl opacity-20 absolute">{dealIcon}</span>
                      <span className="text-6xl relative z-10 drop-shadow-lg">{dealIcon}</span>
                      
                      {/* Бэдж скидки (если есть) */}
                      {promo.required_points === 0 && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          FREE
                        </div>
                      )}
                    </div>
                    
                    {/* Контент */}
                    <div className="p-4 bg-white">
                      <h3 className="font-bold text-gray-800 mb-1 line-clamp-2 min-h-[2.5rem]">
                        {promo.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {promo.partner?.company_name || promo.partner?.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-pink-500">
                          <span className="text-2xl font-bold">🪙</span>
                          <span className="text-xl font-bold">
                            {promo.required_points || 'Free'}
                          </span>
                        </div>
                        <button className="text-pink-500 text-sm font-semibold">
                          Подробнее →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Скрыть скроллбар */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

export default Home

