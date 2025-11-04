import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Title, Text, Button, Avatar } from '@telegram-apps/telegram-ui'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices, getPublishedNews } from '../services/supabase'
import { getServiceIcon, defaultServiceIcons } from '../utils/serviceIcons'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import LoyaltyProgress from '../components/LoyaltyProgress'
import LocationSelector from '../components/LocationSelector'
import LanguageSwitcher from '../components/LanguageSwitcher'
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
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [userName, setUserName] = useState('')
  const [promotions, setPromotions] = useState([])
  const [services, setServices] = useState([])
  const [news, setNews] = useState([])
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(null)

  useEffect(() => {
    loadData()
  }, [chatId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Загружаем данные параллельно
      const [balanceData, promotionsData, servicesData, newsData] = await Promise.all([
        getClientBalance(chatId),
        getActivePromotions(),
        getApprovedServices(),
        getPublishedNews()
      ])
      
      setBalance(balanceData?.balance || 0)
      setUserName(balanceData?.name || user?.first_name || t('profile_guest'))
      setPromotions(promotionsData.slice(0, 5))
      setServices(servicesData.slice(0, 8))
      setNews(newsData.slice(0, 5))
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleServiceClick = (service) => {
    hapticFeedback('light')
    if (service && service.id) {
      // Если это реальная услуга с ID, открываем селектор локации
      setSelectedServiceCategory(service)
      setIsLocationSelectorOpen(true)
    } else {
      // Если это иконка по умолчанию, переходим на страницу всех услуг
      navigate('/services')
    }
  }

  const handleLocationSelect = (location) => {
    // Переходим на страницу услуг с фильтром по локации
    const params = new URLSearchParams()
    if (location.city) params.set('city', location.city)
    if (location.district) params.set('district', location.district)
    if (selectedServiceCategory?.id) params.set('id', selectedServiceCategory.id)
    
    navigate(`/services?${params.toString()}`)
  }

  const handlePromotionClick = (promoId) => {
    hapticFeedback('light')
    navigate(`/promotions?id=${promoId}`)
  }

  const handleNewsClick = (newsId) => {
    hapticFeedback('light')
    navigate(`/news/${newsId}`)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const options = { day: 'numeric', month: 'short' }
    const locale = language === 'ru' ? 'ru-RU' : 'en-US'
    return date.toLocaleDateString(locale, options)
  }

  // Skeleton вместо Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-luxury-charcoal via-luxury-navy to-gray-50">
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
    <div className="min-h-screen bg-gradient-to-b from-luxury-charcoal via-luxury-navy to-gray-50">
      {/* Шапка с приветствием */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            {t('home_greeting')} {userName}
          </h1>
          <LanguageSwitcher />
        </div>

        {/* Карточка с балансом и прогрессом */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100 transition-shadow hover:shadow-xl">
          <p className="text-luxury-gold font-semibold text-base mb-3">
            {t('home_balance_text')}
          </p>
          
          {/* Баланс */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-luxury-gold-light rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" fill="currentColor"/>
                </svg>
              </div>
              <span className="font-bold text-gray-800">{balance} {t('home_points')}</span>
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

      {/* Секция новостей */}
      <div className="bg-white rounded-t-[2rem] px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
            </svg>
            {t('news_latest')}
          </h2>
          {news.length > 0 && (
            <button
              onClick={() => navigate('/news')}
              className="text-luxury-gold font-semibold text-sm hover:text-luxury-gold-dark transition-colors"
            >
              {t('home_see_all')} →
            </button>
          )}
        </div>
        
        {/* Карусель новостей */}
        <div className="overflow-x-auto flex gap-3 pb-4 scrollbar-hide mb-6">
          {news.length > 0 ? (
            news.map((item, index) => {
              const gradients = [
                'from-luxury-charcoal to-luxury-navy',
                'from-luxury-navy to-luxury-slate',
                'from-luxury-slate to-luxury-charcoal',
                'from-luxury-deep to-luxury-navy',
                'from-luxury-charcoal to-luxury-slate'
              ]
              const gradient = gradients[index % gradients.length]

              return (
                <div
                  key={item.id}
                  onClick={() => handleNewsClick(item.id)}
                  className="flex-shrink-0 w-64 bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  {item.image_url ? (
                    <div className="h-24 relative overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span className="text-xs font-semibold text-gray-700">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                      <div className="absolute inset-0 bg-luxury-gold/5" />
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-luxury-gold-light">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
                      </svg>
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span className="text-xs font-semibold text-gray-700">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 line-clamp-2 min-h-[3rem]">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {item.preview_text || item.content.substring(0, 80) + '...'}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <>
              {/* Карточка 1: Добро пожаловать */}
              <div className="flex-shrink-0 w-64 bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/news')}>
                <div className="h-24 bg-gradient-to-br from-luxury-charcoal to-luxury-navy flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-luxury-gold/5" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-luxury-gold-light">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
                  </svg>
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
              <div className="flex-shrink-0 w-64 bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/promotions')}>
                <div className="h-24 bg-gradient-to-br from-luxury-navy to-luxury-slate flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-luxury-gold/5" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-luxury-gold-light">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                  </svg>
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
              <div className="flex-shrink-0 w-64 bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/profile')}>
                <div className="h-24 bg-gradient-to-br from-luxury-slate to-luxury-charcoal flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-luxury-gold/5" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-luxury-gold-light">
                    <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" fill="currentColor"/>
                  </svg>
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
            </>
          )}
        </div>

        {/* Секция Services */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {t('home_services')}
          </h2>
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1"
          >
            <span className="text-luxury-gold font-semibold hover:text-luxury-gold-dark transition-colors">
              {t('home_see_all')}
            </span>
            {services.length > 8 && (
              <span className="bg-luxury-gold text-luxury-charcoal text-xs px-2 py-0.5 rounded-lg ml-1 font-semibold">
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
                onClick={() => handleServiceClick(isService ? item : null)}
                className="flex flex-col items-center cursor-pointer"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mb-2 relative hover:bg-gray-200 transition-colors border border-gray-200">
                  <span className="text-3xl">
                    {serviceIcon}
                  </span>
                  {isService && index < 2 && (
                    <span className="absolute -top-1 -right-1 bg-luxury-gold text-luxury-charcoal text-[10px] px-1.5 py-0.5 rounded-lg font-semibold">
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
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" fill="currentColor"/>
              </svg>
              {t('promo_title')}
            </h2>
            <button
              onClick={() => navigate('/promotions')}
              className="text-luxury-gold font-semibold hover:text-luxury-gold-dark transition-colors"
            >
              {t('home_see_all')} →
            </button>
          </div>

          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide">
            {promotions.slice(0, 3).map((promo, index) => {
              // Градиенты для разнообразия
              const imageGradients = [
                'from-luxury-charcoal via-luxury-navy to-luxury-slate',
                'from-luxury-navy via-luxury-slate to-luxury-charcoal',
                'from-luxury-slate via-luxury-charcoal to-luxury-navy'
              ]
              const imageGradient = imageGradients[index % imageGradients.length]
              
              return (
                <div
                  key={promo.id}
                  onClick={() => handlePromotionClick(promo.id)}
                  className="flex-shrink-0 w-72 cursor-pointer group"
                >
                  <div className="bg-white rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300 border border-gray-200">
                    {/* Изображение */}
                    {promo.image_url ? (
                      // Реальное фото
                      <div className="h-40 relative overflow-hidden">
                        <img 
                          src={promo.image_url} 
                          alt={promo.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        
                        {/* Бэдж скидки (если есть) */}
                        {promo.required_points === 0 && (
                          <div className="absolute top-3 right-3 bg-luxury-gold text-luxury-charcoal px-3 py-1 rounded-lg text-xs font-bold shadow-lg">
                            FREE
                          </div>
                        )}
                      </div>
                    ) : (
                      // Placeholder с градиентом
                      <div className={`h-40 bg-gradient-to-br ${imageGradient} flex items-center justify-center relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="relative z-10 text-luxury-gold-light opacity-80">
                          <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" fill="currentColor"/>
                        </svg>
                        
                        {/* Бэдж скидки (если есть) */}
                        {promo.required_points === 0 && (
                          <div className="absolute top-3 right-3 bg-luxury-gold text-luxury-charcoal px-3 py-1 rounded-lg text-xs font-bold shadow-lg">
                            FREE
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Контент */}
                    <div className="p-4 bg-white">
                      <h3 className="font-bold text-gray-800 mb-1 line-clamp-2 min-h-[2.5rem]">
                        {promo.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {promo.partner?.company_name || promo.partner?.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-luxury-gold">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" fill="currentColor"/>
                          </svg>
                          <span className="text-xl font-bold">
                            {promo.required_points || 'Free'}
                          </span>
                        </div>
                        <button className="text-luxury-gold text-sm font-semibold hover:text-luxury-gold-dark transition-colors">
                          {t('promo_details')} →
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

      {/* Модальное окно выбора локации */}
      <LocationSelector
        isOpen={isLocationSelectorOpen}
        onClose={() => setIsLocationSelectorOpen(false)}
        onSelect={handleLocationSelect}
      />

      {/* Скрыть скроллбар */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

export default Home

