import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices, getPublishedNews, getClientPopularCategories, getGlobalPopularCategories, getBackgroundImage } from '../services/supabase'
import { getServiceIcon, getMainPageCategories, getCategoryByCode, serviceCategories } from '../utils/serviceIcons'
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
  const [bgImage, setBgImage] = useState((import.meta.env && import.meta.env.VITE_BG_IMAGE) || '/bg/sakura.jpg')
  const buildTimeString = (import.meta.env && import.meta.env.VITE_BUILD_TIME) 
    ? String(import.meta.env.VITE_BUILD_TIME) 
    : new Date().toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit' 
      })
  
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [userName, setUserName] = useState('')
  const [promotions, setPromotions] = useState([])
  const [services, setServices] = useState([])
  const [news, setNews] = useState([])
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(null)
  const [popularCategories, setPopularCategories] = useState([])
  const [pointsToNextReward, setPointsToNextReward] = useState(null)

  useEffect(() => {
    loadData()
    loadBackgroundImage()
  }, [chatId])

  const loadBackgroundImage = async () => {
    try {
      const bg = await getBackgroundImage()
      if (bg) {
        setBgImage(bg)
      }
    } catch (error) {
      // Тихо обрабатываем ошибку, используем дефолтный фон
      console.warn('Background image not loaded from DB, using default:', error?.message || error)
    }
  }

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

      setPointsToNextReward(
        calculatePointsToNextReward(servicesData, balanceData?.balance || 0)
      )
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

  const calculatePointsToNextReward = (servicesList, currentBalance) => {
    if (!Array.isArray(servicesList) || servicesList.length === 0) {
      return null
    }

    const prices = servicesList
      .map(service => service?.price_points)
      .filter(price => typeof price === 'number' && price > 0)

    if (prices.length === 0) {
      return null
    }

    const nextPrice = prices
      .filter(price => price > currentBalance)
      .sort((a, b) => a - b)[0]

    if (nextPrice === undefined) {
      return 0
    }

    return Math.max(nextPrice - currentBalance, 0)
  }

  const handleServiceClick = (service, categoryCode = null) => {
    hapticFeedback('light')
    
    if (service && service.id) {
      setSelectedServiceCategory(service)
      setIsLocationSelectorOpen(true)
    } else if (categoryCode) {
      const params = new URLSearchParams()
      params.set('category', categoryCode)
      navigate(`/services?${params.toString()}`)
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
    const mainCategories = getMainPageCategories()
    
    if (popularCategories.length > 0) {
      // Сортируем категории по популярности
      const categoryIndex = {}
      popularCategories.forEach((cat, index) => {
        categoryIndex[cat] = index
      })
      
      return [...mainCategories]
        .sort((a, b) => {
          const aIndex = categoryIndex[a.code] ?? 999
          const bIndex = categoryIndex[b.code] ?? 999
          return aIndex - bIndex
        })
        .slice(0, 8)
    }
    
    // Если нет данных о популярности, используем стандартный порядок (первые 8)
    return mainCategories.slice(0, 8)
  }

  // Возвращает ровно 8 плиток услуг: сначала реальные услуги (уже отсортированы по популярности),
  // затем – дефолтные иконки по глобальной популярности, чтобы добить до 8 без повторов
  const getServiceTiles = () => {
    const tiles = []
    const addedCodes = new Set()
    const normalizeCode = (code) => {
      if (!code) return null
      return String(code).trim().toLowerCase()
    }
    const getShortLabel = (categoryData) => {
      const code = normalizeCode(categoryData.code)
      const shortMap = language === 'ru'
        ? {
            brow_design: 'Брови',
            hair_salon: 'Прически',
            lash_services: 'Реснички',
            makeup_pmu: 'Макияж'
          }
        : {
            brow_design: 'Brows',
            hair_salon: 'Hairstyles',
            lash_services: 'Lashes',
            makeup_pmu: 'Makeup'
          }
      return shortMap[code] || (language === 'ru' ? categoryData.name : categoryData.nameEn || categoryData.name)
    }
    const addCategory = (code) => {
      const normalized = normalizeCode(code)
      if (!normalized) return
      const categoryData = getCategoryByCode(normalized) || serviceCategories[normalized]
      if (!categoryData) return
      const canonicalCode = normalizeCode(categoryData.code || normalized)
      if (!canonicalCode || addedCodes.has(canonicalCode)) return
      tiles.push({ type: 'category', code: canonicalCode, data: { ...categoryData, shortLabel: getShortLabel(categoryData) } })
      addedCodes.add(canonicalCode)
    }
 
    if (services && services.length > 0) {
      services.forEach(service => {
        let categoryCode = service.partner?.business_type || service.category || null
        if (!categoryCode) {
          const inferredCode = getServiceIcon(service.title)
          if (inferredCode) {
            categoryCode = inferredCode
          }
        }

        addCategory(categoryCode)
      })
    }

    if (tiles.length < 8) {
      const defaults = getDefaultServicesByPopularity()
      for (const def of defaults) {
        addCategory(def.code || def.icon)
        if (tiles.length >= 8) break
      }
    }

    return tiles.slice(0, 8)
  }

  const handlePromotionClick = (promoId) => {
    hapticFeedback('light')
    if (!promoId) {
      console.error('Invalid promotion ID:', promoId)
      return
    }
    navigate(`/promotions/${promoId}`)
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
      <div className="relative min-h-screen pb-24">
        {/* Background image - fixed to cover all content */}
        <div
          className="fixed inset-0 -z-10 bg-center bg-cover opacity-60 pointer-events-none select-none"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        {/* Gradient overlay */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />
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
    <div className="relative min-h-screen pb-24">
      {/* Background image - fixed to cover all content */}
      <div
        className="fixed inset-0 -z-10 bg-center bg-cover opacity-60 pointer-events-none select-none"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Gradient overlay */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />
      {/* Шапка с приветствием */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-sakura-deep bg-sakura-surface/13 backdrop-blur-sm px-3 py-1 rounded-lg drop-shadow">
            {t('home_greeting')} {userName}
          </h1>
          <LanguageSwitcher />
        </div>

        {/* Карточка с балансом и прогрессом */}
        <div className="bg-sakura-surface/8 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-sakura-border/40 transition-shadow hover:shadow-2xl">
          <p className="text-sakura-deep font-bold text-base mb-3">
            {t('home_balance_text')}
          </p>
          
          {/* Баланс */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-sakura-border/50 bg-sakura-surface/18 backdrop-blur-sm shadow">
                <span className="text-sakura-deep text-base leading-none">💸</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sakura-dark">{balance} {t('home_points')}</span>
                {pointsToNextReward !== null && (
                  <span className="text-xs text-sakura-dark/60">
                    {pointsToNextReward > 0
                      ? t('home_points_to_next_reward', { points: pointsToNextReward })
                      : t('home_points_ready')}
                  </span>
                )}
              </div>
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
      <div className="bg-sakura-surface/8 backdrop-blur-sm rounded-t-[2rem] px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-sakura-deep flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t('news_latest')}
          </h2>
          {news.length > 0 && (
            <button
              onClick={() => navigate('/news')}
              className="bg-sakura-accent/15 text-sakura-deep font-semibold text-sm px-3 py-1 rounded-lg border border-sakura-accent/30 hover:bg-sakura-accent/25 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
            >
              {t('home_see_all')} →
            </button>
          )}
        </div>
        
        {/* Карусель новостей */}
        <div className="overflow-x-auto flex gap-3 pb-4 scrollbar-hide mb-6 snap-x snap-mandatory">
          {news.length > 0 ? (
            news.map((item, index) => {
              const gradients = [
                'from-jewelry-pink-dark to-jewelry-rose',
                'from-jewelry-rose to-jewelry-pink-light',
                'from-jewelry-pink-medium to-jewelry-rose',
                'from-jewelry-pink-dark to-jewelry-pink-medium',
                'from-jewelry-rose to-jewelry-pink-medium'
              ]
              const gradient = gradients[index % gradients.length]

              return (
                <div
                  key={item.id}
                  onClick={() => handleNewsClick(item.id)}
                  className="group flex-shrink-0 w-64 bg-sakura-surface/8 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
                >
                  {item.image_url ? (
                    <div className="h-24 relative overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover opacity-65 transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-2 right-2 bg-sakura-surface/18 backdrop-blur-sm px-2 py-1 rounded-lg border border-sakura-border/50">
                        <span className="text-xs font-semibold text-jewelry-brown-dark">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                      <div className="absolute inset-0 bg-sakura-accent/10" />
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <div className="absolute top-2 right-2 bg-sakura-surface/18 backdrop-blur-sm px-2 py-1 rounded-lg border border-sakura-border/50">
                        <span className="text-xs font-semibold text-jewelry-brown-dark">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-sakura-deep mb-2 flex items-center gap-2 line-clamp-2 min-h-[3rem]">
                      {item.title}
                    </h3>
                    <p className="text-sm text-sakura-mid line-clamp-2">
                      {item.preview_text || item.content.substring(0, 80) + '...'}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm transition-transform duration-300 group-hover:translate-x-0.5 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                      <span>Подробнее</span>
                      <span aria-hidden="true">→</span>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <>
              {/* Карточка 1: Добро пожаловать */}
              <div className="flex-shrink-0 w-64 bg-rose-surface rounded-xl overflow-hidden border border-rose-border shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
                onClick={() => navigate('/news')}>
                <div className="h-24 bg-gradient-to-br from-sakura-mid to-sakura-accent flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-jewelry-rose/10" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sakura-dark mb-2 flex items-center gap-2">
                    Добро пожаловать!
                  </h3>
                  <p className="text-sm text-jewelry-gray-elegant">
                    Накапливайте баллы за каждую покупку у наших партнёров и обменивайте на услуги!
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                    <span>Перейти к новостям</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </div>
              </div>
              
              {/* Карточка 2: Акции месяца */}
              <div className="flex-shrink-0 w-64 bg-sakura-surface/8 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
                onClick={() => navigate('/promotions')}>
                <div className="h-24 bg-gradient-to-br from-sakura-accent to-sakura-mid flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-jewelry-rose/10" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sakura-dark mb-2 flex items-center gap-2">
                    Акции месяца
                  </h3>
                  <p className="text-sm text-jewelry-gray-elegant">
                    Специальные предложения от партнёров - скидки до 50%!
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                    <span>Открыть акции</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </div>
              </div>
              
              {/* Карточка 3: Реферальная программа */}
              <div className="flex-shrink-0 w-64 bg-sakura-surface/8 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
                onClick={() => navigate('/profile')}>
                <div className="h-24 bg-gradient-to-br from-sakura-mid to-sakura-deep flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-jewelry-rose/10" />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-jewelry-cream">
                    <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="17" cy="11" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sakura-dark mb-2 flex items-center gap-2">
                    Реферальная программа
                  </h3>
                  <p className="text-sm text-jewelry-gray-elegant">
                    Приглашайте друзей и получайте бонусные баллы за каждого!
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                    <span>Открыть рефералы</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Секция Services */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-sakura-deep">
            {t('home_services')}
          </h2>
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1"
          >
            <span className="text-sakura-deep font-semibold hover:opacity-80 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              {t('home_see_all')}
            </span>
            {services.length > 8 && (
              <span className="bg-rose-accent text-white text-xs px-2 py-0.5 rounded-lg ml-1 font-semibold border border-rose-border">
                NEW
              </span>
            )}
          </button>
        </div>

        {/* Сетка услуг 4x2 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {getServiceTiles().map((itemWrapper, index) => {
            const categoryData = itemWrapper.data
            const categoryCode = itemWrapper.code
            const emojiToDisplay = categoryData.emoji || '⭐'
            const displayName = categoryData.shortLabel || (language === 'ru' ? categoryData.name : categoryData.nameEn || categoryData.name)

            return (
              <div
                key={categoryCode || index}
                onClick={() => handleServiceClick(null, categoryCode)}
                className="flex flex-col items-center cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="w-16 h-16 bg-sakura-surface/18 backdrop-blur-sm rounded-xl flex items-center justify-center mb-2 relative hover:bg-sakura-accent/10 transition-colors border border-sakura-border/50 shadow-sm active:shadow-md">
                  <div className="flex items-center justify-center w-full h-full text-3xl">
                    {emojiToDisplay}
                  </div>
                </div>
                <span className="text-[11px] text-center text-sakura-deep leading-tight">
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
            <h2 className="text-2xl font-bold text-sakura-deep flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="17" cy="11" r="1" fill="currentColor" />
            </svg>
              {t('promo_title')}
            </h2>
            <button
              onClick={() => navigate('/promotions')}
            className="bg-sakura-accent/15 text-sakura-deep font-semibold text-sm px-3 py-1 rounded-lg border border-sakura-accent/30 hover:bg-sakura-accent/25 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
            >
              {t('home_see_all')} →
            </button>
          </div>

          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide snap-x snap-mandatory">
            {promotions.slice(0, 3).map((promo, index) => {
              // Градиенты для разнообразия
              const imageGradients = [
                'from-jewelry-pink-dark via-jewelry-rose to-jewelry-pink-light',
                'from-jewelry-rose via-jewelry-pink-light to-jewelry-pink-medium',
                'from-jewelry-pink-medium via-jewelry-pink-dark to-jewelry-rose'
              ]
              const imageGradient = imageGradients[index % imageGradients.length]
              const partnerCategory =
                promo.partner?.category ||
                promo.partner?.business_type ||
                promo.partner?.industry ||
                promo.category_label
              
              return (
                <div
                  key={promo.id}
                  onClick={() => handlePromotionClick(promo.id)}
                  className="flex-shrink-0 w-72 cursor-pointer group snap-start active:scale-[0.985] transition-transform"
                >
                  <div className="bg-sakura-surface/13 backdrop-blur-sm rounded-xl overflow-hidden shadow-xl group-hover:shadow-2xl transition-all duration-300 border border-sakura-border/40">
                    {/* Изображение */}
                    {promo.image_url ? (
                      // Реальное фото
                      <div className="h-40 relative overflow-hidden">
                        <img 
                          src={promo.image_url} 
                          alt={promo.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover opacity-65 transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        
                        {/* Бэдж скидки (если есть) */}
                        {promo.required_points === 0 && (
                          <div className="absolute top-3 right-3 bg-sakura-accent text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg border border-sakura-border/40">
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
                          <div className="absolute top-3 right-3 bg-sakura-accent text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg border border-sakura-border/40">
                            FREE
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Контент */}
                    <div className="p-4 bg-sakura-surface/13 backdrop-blur-sm">
                      <h3 className="font-bold text-sakura-deep mb-1 line-clamp-2 min-h-[2.5rem]">
                        {promo.title}
                      </h3>
                      {partnerCategory && (
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-sakura-mid/80 mb-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                            <path d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="line-clamp-1">{partnerCategory}</span>
                        </div>
                      )}
                      <p className="text-sm text-sakura-mid mb-3">
                        {promo.partner?.company_name || promo.partner?.name}
                      </p>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-1 text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <span className="text-xl font-bold">
                            {promo.required_points || 'Free'}
                          </span>
                        </div>
                        <button className="bg-sakura-accent/15 text-sakura-deep text-sm font-semibold px-3 py-1 rounded-lg border border-sakura-accent/20 hover:bg-sakura-accent/25 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                          {t('promo_details')}
                          <span className="ml-1" aria-hidden="true">→</span>
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

    {/* Техническая отметка версии/времени билда */}
    <div className="fixed bottom-1 right-2 z-50 px-2 py-1 rounded-md text-[10px] opacity-70 bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10">
      Build: {buildTimeString}
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

