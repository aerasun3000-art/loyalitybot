import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Title, Text, Button, Avatar } from '@telegram-apps/telegram-ui'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices, getPublishedNews, getClientPopularCategories, getGlobalPopularCategories } from '../services/supabase'
import { getServiceIcon, defaultServiceIcons, serviceCategories } from '../utils/serviceIcons'
// // import LuxuryIcon from '../components/LuxuryIcons'
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
  const [popularCategories, setPopularCategories] = useState([])

  useEffect(() => {
    loadData()
  }, [chatId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Загружаем данные параллельно
      const [balanceData, promotionsData, servicesData, newsData, popularCats] = await Promise.all([
        getClientBalance(chatId),
        getActivePromotions(),
        getApprovedServices(),
        getPublishedNews(),
        getClientPopularCategories(chatId).catch(() => null) // Получаем персональные категории
      ])
      
      setBalance(balanceData?.balance || 0)
      setUserName(balanceData?.name || user?.first_name || t('profile_guest'))
      setPromotions(promotionsData.slice(0, 5))
      setNews(newsData.slice(0, 5))
      
      // Если есть персональные категории, используем их, иначе глобальные
      let categories = popularCats
      if (!categories || categories.length === 0) {
        categories = await getGlobalPopularCategories()
      }
      setPopularCategories(categories || [])
      
      // Сортируем услуги по популярности категорий
      const sortedServices = sortServicesByPopularity(servicesData, categories)
      setServices(sortedServices.slice(0, 8))
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Функция для сортировки услуг по популярности категорий
  const sortServicesByPopularity = (servicesList, categoryOrder) => {
    if (!categoryOrder || categoryOrder.length === 0) {
      return servicesList
    }
    
    // Создаём индекс категорий для быстрого поиска
    const categoryIndex = {}
    categoryOrder.forEach((cat, index) => {
      categoryIndex[cat] = index
    })
    
    // Сортируем услуги: сначала по популярности категории, потом по дате создания
    return [...servicesList].sort((a, b) => {
      const aCategory = a.category || getServiceIcon(a.title) || 'default'
      const bCategory = b.category || getServiceIcon(b.title) || 'default'
      
      const aIndex = categoryIndex[aCategory] ?? 999
      const bIndex = categoryIndex[bCategory] ?? 999
      
      if (aIndex !== bIndex) {
        return aIndex - bIndex
      }
      
      // Если категория одинаковая, сортируем по дате (новые первыми)
      const aDate = new Date(a.created_at || 0)
      const bDate = new Date(b.created_at || 0)
      return bDate - aDate
    })
  }

  const handleServiceClick = (service) => {
    hapticFeedback('light')
    
    if (service && service.id) {
      setSelectedServiceCategory(service)
      setIsLocationSelectorOpen(true)
    } else {
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

  // Функция для получения дефолтных услуг, отсортированных по популярности
  const getDefaultServicesByPopularity = () => {
    if (popularCategories.length > 0) {
      // Сортируем defaultServiceIcons по популярности категорий
      const categoryIndex = {}
      popularCategories.forEach((cat, index) => {
        categoryIndex[cat] = index
      })
      
      return [...defaultServiceIcons]
        .sort((a, b) => {
          const aIndex = categoryIndex[a.icon] ?? 999
          const bIndex = categoryIndex[b.icon] ?? 999
          return aIndex - bIndex
        })
        .slice(0, 8)
    }
    
    // Если нет данных о популярности, используем стандартный порядок
    return defaultServiceIcons.slice(0, 8)
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
      <div className="min-h-screen bg-gradient-to-b from-jewelry-brown-dark via-jewelry-burgundy to-jewelry-cream">
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
    <div className="min-h-screen bg-gradient-to-b from-jewelry-brown-dark via-jewelry-burgundy to-jewelry-cream">
      {/* Шапка с приветствием */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            {t('home_greeting')} {userName}
          </h1>
          <LanguageSwitcher />
        </div>

        {/* Карточка с балансом и прогрессом */}
        <div className="bg-jewelry-cream rounded-xl p-4 shadow-xl border border-jewelry-gold/20 transition-shadow hover:shadow-2xl">
          <p className="text-jewelry-gold font-semibold text-base mb-3">
            {t('home_balance_text')}
          </p>
          
          {/* Баланс */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-jewelry-gold/20 rounded-lg flex items-center justify-center border border-jewelry-gold/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-bold text-jewelry-brown-dark">{balance} {t('home_points')}</span>
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
      <div className="bg-jewelry-cream rounded-t-[2rem] px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-jewelry-brown-dark flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t('news_latest')}
          </h2>
          {news.length > 0 && (
            <button
              onClick={() => navigate('/news')}
              className="text-jewelry-gold font-semibold text-sm hover:text-jewelry-gold-dark transition-colors"
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
                'from-jewelry-brown-dark to-jewelry-burgundy',
                'from-jewelry-burgundy to-jewelry-gold',
                'from-jewelry-gold to-jewelry-brown-dark',
                'from-jewelry-brown-light to-jewelry-burgundy',
                'from-jewelry-burgundy to-jewelry-brown-dark'
              ]
              const gradient = gradients[index % gradients.length]

              return (
                <div
                  key={item.id}
                  onClick={() => handleNewsClick(item.id)}
                  className="flex-shrink-0 w-64 bg-jewelry-cream rounded-xl overflow-hidden border border-jewelry-gold/30 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                >
                  {item.image_url ? (
                    <div className="h-24 relative overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-jewelry-cream/95 backdrop-blur-sm px-2 py-1 rounded-lg border border-jewelry-gold/20">
                        <span className="text-xs font-semibold text-jewelry-brown-dark">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                      <div className="absolute inset-0 bg-jewelry-gold/10" />
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <div className="absolute top-2 right-2 bg-jewelry-cream/95 backdrop-blur-sm px-2 py-1 rounded-lg border border-jewelry-gold/20">
                        <span className="text-xs font-semibold text-jewelry-brown-dark">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-jewelry-brown-dark mb-2 flex items-center gap-2 line-clamp-2 min-h-[3rem]">
                      {item.title}
                    </h3>
                    <p className="text-sm text-jewelry-gray-elegant line-clamp-2">
                      {item.preview_text || item.content.substring(0, 80) + '...'}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <>
              {/* Карточка 1: Добро пожаловать */}
              <div className="flex-shrink-0 w-64 bg-jewelry-cream rounded-xl overflow-hidden border border-jewelry-gold/30 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/news')}>
                <div className="h-24 bg-gradient-to-br from-jewelry-brown-dark to-jewelry-burgundy flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-jewelry-gold/10" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-jewelry-brown-dark mb-2 flex items-center gap-2">
                    Добро пожаловать!
                  </h3>
                  <p className="text-sm text-jewelry-gray-elegant">
                    Накапливайте баллы за каждую покупку у наших партнёров и обменивайте на услуги!
                  </p>
                </div>
              </div>
              
              {/* Карточка 2: Акции месяца */}
              <div className="flex-shrink-0 w-64 bg-jewelry-cream rounded-xl overflow-hidden border border-jewelry-gold/30 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/promotions')}>
                <div className="h-24 bg-gradient-to-br from-jewelry-burgundy to-jewelry-gold flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-jewelry-gold/10" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-jewelry-brown-dark mb-2 flex items-center gap-2">
                    Акции месяца
                  </h3>
                  <p className="text-sm text-jewelry-gray-elegant">
                    Специальные предложения от партнёров - скидки до 50%!
                  </p>
                </div>
              </div>
              
              {/* Карточка 3: Реферальная программа */}
              <div className="flex-shrink-0 w-64 bg-jewelry-cream rounded-xl overflow-hidden border border-jewelry-gold/30 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/profile')}>
                <div className="h-24 bg-gradient-to-br from-jewelry-gold to-jewelry-brown-dark flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-jewelry-gold/10" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                    <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="17" cy="11" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-jewelry-brown-dark mb-2 flex items-center gap-2">
                    Реферальная программа
                  </h3>
                  <p className="text-sm text-jewelry-gray-elegant">
                    Приглашайте друзей и получайте бонусные баллы за каждого!
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Секция Services */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-jewelry-brown-dark">
            {t('home_services')}
          </h2>
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1"
          >
            <span className="text-jewelry-gold font-semibold hover:text-jewelry-gold-dark transition-colors">
              {t('home_see_all')}
            </span>
            {services.length > 8 && (
              <span className="bg-jewelry-gold text-jewelry-cream text-xs px-2 py-0.5 rounded-lg ml-1 font-semibold border border-jewelry-gold-dark/30">
                NEW
              </span>
            )}
          </button>
        </div>

        {/* Сетка услуг 4x2 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(services.length > 0 ? services.slice(0, 8) : getDefaultServicesByPopularity()).map((item, index) => {
            const isService = services.length > 0
            
            // В оригинальном дизайне просто отображаем эмодзи для всех услуг
            let emojiToDisplay = '⭐' // по умолчанию

            if (isService) {
              // Услуга из базы данных - определяем эмодзи по названию или категории
              if (item.category && serviceCategories[item.category]) {
                emojiToDisplay = serviceCategories[item.category].emoji
              } else {
                const serviceTitle = item.title || ''
                const iconName = getServiceIcon(serviceTitle)
                if (iconName && serviceCategories[iconName]) {
                  emojiToDisplay = serviceCategories[iconName].emoji
                }
              }
            } else {
              // defaultServiceIcons - используем emoji из объекта
              emojiToDisplay = item.emoji || '⭐'
            }
            
            // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: убеждаемся что finalIcon - это валидная строка без эмодзи
            // const isValidIcon = typeof finalIcon === 'string' && 
            //                       finalIcon.length < 20 && 
            //                       finalIcon.length > 0 &&
            //                       !/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(finalIcon) &&
            //                       /^[a-z_]+$/i.test(finalIcon) // Только буквы и подчеркивания
            
            // const safeIcon = isValidIcon ? finalIcon : 'default'
            
            // Для отображения используем title для услуг, или name для defaultServiceIcons
            const displayName = isService ? item.title : (language === 'ru' ? item.name : item.nameEn)
            const serviceId = isService ? item.id : null
            
            return (
              <div
                key={serviceId || index}
                onClick={() => handleServiceClick(isService ? item : null)} // Revert to old onClick
                className="flex flex-col items-center cursor-pointer"
              >
                <div className="w-16 h-16 bg-jewelry-cream rounded-xl flex items-center justify-center mb-2 relative hover:bg-jewelry-gold/10 transition-colors border border-jewelry-gold/30 shadow-sm">
                  {/* В оригинальном дизайне просто отображаем эмодзи */}
                  <div 
                    className="flex items-center justify-center w-full h-full text-3xl" 
                  >
                    {emojiToDisplay}
                  </div>
                  {isService && index < 2 && (
                    <span className="absolute -top-1 -right-1 bg-jewelry-gold text-jewelry-cream text-[10px] px-1.5 py-0.5 rounded-lg font-semibold border border-jewelry-gold-dark/30">
                      NEW
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-center text-jewelry-brown-dark leading-tight">
                  {displayName?.length > 15 
                    ? displayName.substring(0, 15) + '...' 
                    : displayName}
                </span>
              </div>
            )
          })}
        </div>

        {/* Секция Акции */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-jewelry-brown-dark flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
              <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="17" cy="11" r="1" fill="currentColor" />
            </svg>
              {t('promo_title')}
            </h2>
            <button
              onClick={() => navigate('/promotions')}
              className="text-jewelry-gold font-semibold hover:text-jewelry-gold-dark transition-colors"
            >
              {t('home_see_all')} →
            </button>
          </div>

          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide">
            {promotions.slice(0, 3).map((promo, index) => {
              // Градиенты для разнообразия
              const imageGradients = [
                'from-jewelry-brown-dark via-jewelry-burgundy to-jewelry-gold',
                'from-jewelry-burgundy via-jewelry-gold to-jewelry-brown-dark',
                'from-jewelry-gold via-jewelry-brown-dark to-jewelry-burgundy'
              ]
              const imageGradient = imageGradients[index % imageGradients.length]
              
              return (
                <div
                  key={promo.id}
                  onClick={() => handlePromotionClick(promo.id)}
                  className="flex-shrink-0 w-72 cursor-pointer group"
                >
                  <div className="bg-jewelry-cream rounded-xl overflow-hidden shadow-xl group-hover:shadow-2xl transition-all duration-300 border border-jewelry-gold/30">
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
                          <div className="absolute top-3 right-3 bg-jewelry-gold text-jewelry-cream px-3 py-1 rounded-lg text-xs font-bold shadow-lg border border-jewelry-gold-dark/30">
                            FREE
                          </div>
                        )}
                      </div>
                    ) : (
                      // Placeholder с градиентом
                      <div className={`h-40 bg-gradient-to-br ${imageGradient} flex items-center justify-center relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream opacity-90">
                          <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="17" cy="11" r="1.5" fill="currentColor" />
                        </svg>
                        
                        {/* Бэдж скидки (если есть) */}
                        {promo.required_points === 0 && (
                          <div className="absolute top-3 right-3 bg-jewelry-gold text-jewelry-cream px-3 py-1 rounded-lg text-xs font-bold shadow-lg border border-jewelry-gold-dark/30">
                            FREE
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Контент */}
                    <div className="p-4 bg-jewelry-cream">
                      <h3 className="font-bold text-jewelry-brown-dark mb-1 line-clamp-2 min-h-[2.5rem]">
                        {promo.title}
                      </h3>
                      <p className="text-sm text-jewelry-gray-elegant mb-3">
                        {promo.partner?.company_name || promo.partner?.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-jewelry-gold">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <span className="text-xl font-bold">
                            {promo.required_points || 'Free'}
                          </span>
                        </div>
                        <button className="text-jewelry-gold text-sm font-semibold hover:text-jewelry-gold-dark transition-colors">
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

