import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices, getPublishedNews, getClientPopularCategories, getGlobalPopularCategories, getBackgroundImage, getReferralPartnerInfo, getReferralStats, getOrCreateReferralCode } from '../services/supabase'
import { getServiceIcon, getMainPageCategories, getCategoryByCode, getAllCategoryGroups, serviceCategories } from '../utils/serviceIcons'
import { shareReferralLink, buildReferralLink } from '../utils/referralShare'
import { useTranslation, translateDynamicContent, declinePoints } from '../utils/i18n'
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
  const [translatedNews, setTranslatedNews] = useState([])
  const [translatedPromotions, setTranslatedPromotions] = useState([])
  const [translating, setTranslating] = useState(false)
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [selectedServiceCategory, setSelectedServiceCategory] = useState(null)
  const [popularCategories, setPopularCategories] = useState([])
  const [pointsToNextReward, setPointsToNextReward] = useState(null)
  const [referralPartnerInfo, setReferralPartnerInfo] = useState(null)
  const [referralStats, setReferralStats] = useState(null)
  const [referralCode, setReferralCode] = useState(null)
  const [referralToast, setReferralToast] = useState(null)
  const [referralLoading, setReferralLoading] = useState(false)
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const carouselRef = useRef(null)
  const isScrollingRef = useRef(false)

  useEffect(() => {
    const seen = typeof localStorage !== 'undefined' && localStorage.getItem('onboarding_seen')
    if (!seen) setShowOnboarding(true)
  }, [])

  const dismissOnboarding = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('onboarding_seen', '1')
    setShowOnboarding(false)
    setOnboardingStep(1)
  }
  const nextOnboardingStep = () => {
    if (onboardingStep < 2) setOnboardingStep(2)
    else dismissOnboarding()
  }

  useEffect(() => {
    loadData()
    loadBackgroundImage()
  }, [chatId])

  useEffect(() => {
    if (!chatId) return
    setReferralLoading(true)
    const loadReferral = async () => {
      try {
        const stats = await getReferralStats(chatId)
        setReferralStats(stats)
        const code = stats?.referral_code ?? await getOrCreateReferralCode(chatId)
        setReferralCode(code)
      } catch (err) {
        console.warn('Referral data load failed:', err)
      } finally {
        setReferralLoading(false)
      }
    }
    loadReferral()
  }, [chatId])

  // Автоматический перевод новостей при изменении языка
  useEffect(() => {
    if (news.length === 0 || language === 'ru') {
      setTranslatedNews(news)
      return
    }

    const checkApiAndTranslate = async () => {
      // Если в БД уже есть предзаполненные английские поля, используем их без обращения к API
      if (language === 'en' && news.some(item => item.title_en || item.preview_text_en)) {
        const mapped = news.map(item => ({
          ...item,
          title: item.title_en || item.title,
          preview_text: item.preview_text_en || item.preview_text
        }))
        setTranslatedNews(mapped)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.warn('⚠️ VITE_API_URL не установлен. Переводы отключены. Показываем оригинальный текст.')
        setTranslatedNews(news)
        return
      }

      setTranslating(true)
      try {
        const translated = await Promise.all(
          news.map(async (item) => {
            try {
              return {
                ...item,
                title: await translateDynamicContent(item.title, language, 'ru'),
                preview_text: item.preview_text
                  ? await translateDynamicContent(item.preview_text, language, 'ru')
                  : null,
              }
            } catch (error) {
              console.warn(`Translation failed for news ${item.id}:`, error)
              return item
            }
          })
        )
        setTranslatedNews(translated)
      } catch (error) {
        console.error('Error translating news:', error)
        setTranslatedNews(news)
      } finally {
        setTranslating(false)
      }
    }

    checkApiAndTranslate()
  }, [news, language])

  // Автоматический перевод акций при изменении языка
  useEffect(() => {
    if (promotions.length === 0 || language === 'ru') {
      setTranslatedPromotions(promotions)
      return
    }

    const checkApiAndTranslate = async () => {
      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.warn('⚠️ VITE_API_URL не установлен. Переводы отключены. Показываем оригинальный текст.')
        setTranslatedPromotions(promotions)
        return
      }

      setTranslating(true)
      try {
        const translated = await Promise.all(
          promotions.map(async (item) => {
            try {
              return {
                ...item,
                title: await translateDynamicContent(item.title, language, 'ru'),
                description: item.description
                  ? await translateDynamicContent(item.description, language, 'ru')
                  : null,
              }
            } catch (error) {
              console.warn(`Translation failed for promotion ${item.id}:`, error)
              return item
            }
          })
        )
        setTranslatedPromotions(translated)
      } catch (error) {
        console.error('Error translating promotions:', error)
        setTranslatedPromotions(promotions)
      } finally {
        setTranslating(false)
      }
    }

    checkApiAndTranslate()
  }, [promotions, language])

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
      
      // Получаем информацию о партнере, который добавил клиента
      const partnerInfo = await getReferralPartnerInfo(chatId)
      setReferralPartnerInfo(partnerInfo)
      
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
      
      // Фильтруем конкурентов перед сортировкой
      const filteredServices = filterCompetitors(servicesData, partnerInfo)
      
      // Сортируем услуги по популярности категорий
      const sortedServices = sortServicesByPopularity(filteredServices, categories)
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

  // Функция для нормализации кода категории
  const normalizeCategoryCode = (code) => {
    if (!code) return null
    const categoryData = getCategoryByCode(code) || serviceCategories[code]
    return categoryData?.code || code
  }

  // Функция для проверки, является ли партнер конкурентом
  const isCompetitor = (service, referralPartnerInfo) => {
    // Если у клиента нет партнера, который его добавил, не скрываем никого
    if (!referralPartnerInfo) {
      return false
    }

    const servicePartnerId = service.partner_chat_id || service.partnerId
    
    // Если это сам партнер, который добавил клиента - НЕ конкурент (показываем)
    if (servicePartnerId === referralPartnerInfo.chatId) {
      return false
    }

    // ВСЕГДА используем business_type партнёра для определения конкурента
    const serviceCategory = service.partner?.business_type || service.category || service.categoryCode

    if (!serviceCategory || !referralPartnerInfo.businessType) {
      return false
    }

    // Нормализуем категории для сравнения
    const referralCategory = normalizeCategoryCode(referralPartnerInfo.businessType)
    const serviceCategoryNormalized = normalizeCategoryCode(serviceCategory)

    // Если категории совпадают - это конкурент (скрываем)
    return referralCategory === serviceCategoryNormalized
  }

  // Функция для фильтрации конкурентов
  const filterCompetitors = (servicesList, referralPartnerInfo) => {
    if (!referralPartnerInfo || !servicesList || servicesList.length === 0) {
      return servicesList
    }

    return servicesList.filter(service => !isCompetitor(service, referralPartnerInfo))
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

  // Обработчик бесконечного скролла для карусели акций
  useEffect(() => {
    const container = carouselRef.current
    if (!container || translatedPromotions.length <= 1) return

    const handleScroll = () => {
      if (isScrollingRef.current) return
      
      const scrollLeft = container.scrollLeft
      const containerWidth = container.offsetWidth
      const cardWidth = 280
      const gap = 16
      const cardWithGap = cardWidth + gap
      
      // Получаем данные о реальных карточках из DOM
      const firstCard = container.querySelector('[data-real-index="0"]')
      if (!firstCard) return
      
      const realStartIndex = parseInt(firstCard.getAttribute('data-index') || '0')
      const baseLength = translatedPromotions.length
      const realEndIndex = realStartIndex + baseLength
      
      // Если прокрутили слишком далеко вправо (к концу клонов)
      if (scrollLeft >= (realEndIndex * cardWithGap) - containerWidth) {
        isScrollingRef.current = true
        // Переходим к началу реальных карточек
        container.scrollLeft = realStartIndex * cardWithGap + (scrollLeft - realEndIndex * cardWithGap)
        setTimeout(() => { isScrollingRef.current = false }, 50)
      }
      // Если прокрутили слишком далеко влево (к началу клонов)
      else if (scrollLeft <= (realStartIndex * cardWithGap) - containerWidth / 2) {
        isScrollingRef.current = true
        // Переходим к концу реальных карточек
        container.scrollLeft = realEndIndex * cardWithGap - containerWidth / 2 + (scrollLeft - (realStartIndex * cardWithGap - containerWidth / 2))
        setTimeout(() => { isScrollingRef.current = false }, 50)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [translatedPromotions.length])

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
    // Фильтруем услуги по выбранной category_group, если она выбрана
    let filteredServices = services
    if (selectedCategoryGroup) {
      filteredServices = services.filter(service => {
        const partnerCategoryGroup = service.partner?.category_group || 'beauty'
        return partnerCategoryGroup === selectedCategoryGroup
      })
    }
    
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
 
    if (filteredServices && filteredServices.length > 0) {
      filteredServices.forEach(service => {
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
          <h1 className="text-2xl font-bold text-sakura-deep bg-gradient-to-br from-white/35 to-sakura-surface/33 backdrop-blur-sm px-3 py-1 rounded-lg drop-shadow">
            {t('home_greeting')} {userName}
          </h1>
          <LanguageSwitcher />
        </div>

        {/* Карточка с балансом и прогрессом */}
        <div className="bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-sakura-border/40 transition-shadow hover:shadow-2xl">
          <p className="text-sakura-deep font-bold text-base mb-3">
            {t('home_value_title')}
          </p>
          
          {/* Баланс */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-sakura-border/50 bg-gradient-to-br from-white/35 to-sakura-surface/38 backdrop-blur-sm shadow">
                <span className="text-sakura-deep text-base leading-none">💸</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sakura-dark">{balance} {t('home_points')}</span>
                {pointsToNextReward !== null && (
                  <span className="text-xs text-sakura-dark/60">
                    {pointsToNextReward > 0
                      ? t('home_points_to_next_reward', { 
                          points: pointsToNextReward, 
                          pointsWord: language === 'ru' ? declinePoints(pointsToNextReward) : 'points'
                        })
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

          <p className="text-sakura-mid text-xs mt-3">
            {t('home_balance_slogan')}
          </p>
        </div>

        {/* Блок «Зарабатывай баллами на рекомендациях» */}
        {chatId && (
          <div className="mt-4 bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-sakura-border/40">
            <h3 className="font-bold text-sakura-deep text-sm mb-1">{t('home_referral_title')}</h3>
            <p className="text-sakura-mid text-xs mb-3">{t('home_referral_subtitle')}</p>
            {(referralStats?.total_referrals ?? 0) === 0 && (
              <p className="text-sakura-mid text-xs mb-3 rounded-lg bg-sakura-mid/10 p-2 border border-sakura-border/30">
                {t('referral_empty_state')}
              </p>
            )}
            {referralStats && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{(() => {
                  const levels = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }
                  return levels[referralStats.referral_level] || levels.bronze
                })()}</span>
                <span className="text-sakura-deep text-sm font-medium">
                  {t('referral_your_level')}: {t(`referral_level_${referralStats.referral_level || 'bronze'}`)}
                </span>
              </div>
            )}
            <p className="text-sakura-mid text-xs mb-3">{t('referral_partner_cta')}</p>
            {referralLoading ? (
              <div className="space-y-2">
                <div className="h-10 bg-sakura-mid/20 rounded-lg animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-8 w-24 bg-sakura-mid/20 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-sakura-mid/20 rounded animate-pulse" />
                </div>
              </div>
            ) : referralCode ? (
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    const link = buildReferralLink(referralCode)
                    await shareReferralLink(link, {
                      title: 'LoyaltyBot',
                      text: t('home_referral_subtitle'),
                      onSuccess: () => {
                        setReferralToast(t('toast_link_copied'))
                        setTimeout(() => setReferralToast(null), 2500)
                      },
                      onError: () => {
                        setReferralToast(t('toast_copy_failed'))
                        setTimeout(() => setReferralToast(null), 2500)
                      }
                    })
                  }}
                  className="w-full bg-sakura-accent/80 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-sakura-accent transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <polyline points="16 6 12 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {t('home_referral_copy_btn')} / {t('home_referral_share_btn')}
                </button>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { hapticFeedback('light'); navigate('/partner/apply'); }}
                    className="text-sakura-deep font-semibold text-xs hover:underline"
                  >
                    {t('referral_become_partner_btn')} →
                  </button>
                  <button
                    onClick={() => { hapticFeedback('light'); navigate('/community'); }}
                    className="text-sakura-mid text-xs hover:underline"
                  >
                    {t('home_referral_more')} →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sakura-mid text-xs italic">{t('home_referral_link_soon')}</p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { hapticFeedback('light'); navigate('/partner/apply'); }}
                    className="text-sakura-deep font-semibold text-xs hover:underline"
                  >
                    {t('referral_become_partner_btn')} →
                  </button>
                  <button
                    onClick={() => { hapticFeedback('light'); navigate('/community'); }}
                    className="text-sakura-mid text-xs hover:underline"
                  >
                    {t('home_referral_more')} →
                  </button>
                </div>
              </div>
            )}
            {referralToast && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-sakura-deep text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50 animate-pulse">
                {referralToast}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Секция новостей */}
      <div className="bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-t-[2rem] px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-sakura-deep flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t('news_latest')}
          </h2>
          {translatedNews.length > 0 && (
            <button
              onClick={() => navigate('/news')}
              className="bg-sakura-accent/15 text-sakura-deep font-semibold text-sm px-3 py-1 rounded-lg border border-sakura-accent/30 hover:bg-sakura-accent/25 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
            >
              {t('home_see_all')} →
            </button>
          )}
          {translating && (
            <div className="flex items-center gap-2 text-xs text-sakura-mid">
              <Loader size="sm" />
              <span>{t('translating') || 'Перевод...'}</span>
            </div>
          )}
        </div>
        
        {/* Карусель новостей */}
        <div className="overflow-x-auto flex gap-3 pb-4 scrollbar-hide mb-6 snap-x snap-mandatory">
          {translatedNews.length > 0 ? (
            translatedNews.map((item, index) => {
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
                  className="group flex-shrink-0 w-64 bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
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
                      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg border border-sakura-border/50">
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
                      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg border border-sakura-border/50">
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
              <div className="flex-shrink-0 w-64 bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
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
              <div className="flex-shrink-0 w-64 bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
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

        {/* Секция Services - Группы категорий */}
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
          </button>
        </div>

        {/* Сетка групп категорий в стиле карточек - 2x3 (6 карточек) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {(() => {
            // Фильтруем категории: скрываем travel_tourism, automotive_pets, healthcare, education, retail
            const filteredGroups = getAllCategoryGroups()
              .filter(group => 
                group.code !== 'travel_tourism' && 
                group.code !== 'automotive_pets' &&
                group.code !== 'healthcare' &&
                group.code !== 'education' &&
                group.code !== 'retail'
              )
              .slice(0, 5) // Берем первые 5 категорий
            
            // Добавляем черную карточку "Еще" в массив
            const cardsToDisplay = [
              ...filteredGroups.map(group => ({ type: 'category', group })),
              { type: 'more' }
            ]
            
            return cardsToDisplay.map((item, index) => {
              if (item.type === 'more') {
                // Черная карточка "Еще"
                return (
                  <div
                    key="more"
                    onClick={() => {
                      hapticFeedback('light')
                      navigate('/categories')
                    }}
                    className="bg-gray-900 rounded-2xl p-3 md:p-4 cursor-pointer 
                               hover:scale-105 hover:shadow-lg 
                               active:scale-95 transition-all duration-200
                               relative h-28 md:h-32 flex flex-col items-center justify-center"
                  >
                    {/* Название "Еще" */}
                    <h3 className="font-bold text-lg md:text-xl text-white">
                      {language === 'ru' ? 'Еще' : 'More'}
                    </h3>
                    
                    {/* Стрелка вправо */}
                    <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 text-white text-3xl md:text-4xl">
                      →
                    </div>
                  </div>
                )
              }
              
              // Обычная карточка категории
              const { group } = item
              const displayName = language === 'ru' ? group.name : group.nameEn
              const emojiToDisplay = group.emoji || '⭐'
              
              return (
                <div
                  key={group.code}
                  onClick={() => {
                    hapticFeedback('light')
                    // Переход на страницу услуг с фильтром по группе категорий
                    const params = new URLSearchParams()
                    params.set('category_group', group.code)
                    navigate(`/services?${params.toString()}`)
                  }}
                  className="bg-white rounded-2xl p-3 md:p-4 cursor-pointer 
                             hover:scale-105 hover:shadow-lg 
                             active:scale-95 transition-all duration-200
                             relative h-28 md:h-32 flex flex-col overflow-hidden shadow-md"
                >
                  {/* Название группы - вверху слева */}
                  <h3 className="font-bold text-sm md:text-sm text-sakura-deep leading-tight pr-12 md:pr-12 line-clamp-2">
                    {displayName}
                  </h3>
                  
                  {/* Иконка/Emoji в правом нижнем углу */}
                  <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 text-4xl md:text-5xl">
                    {emojiToDisplay}
                  </div>
                </div>
              )
            })
          })()}
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

          {translatedPromotions.length > 0 ? (
            <>
              {/* Карусель акций с эффектом закладок - максимум 2 по горизонтали */}
              {(() => {
                const allPromotions = translatedPromotions
                
                // Для бесконечной карусели дублируем карточки
                const displayPromotions = allPromotions.length > 1
                  ? [...allPromotions, ...allPromotions, ...allPromotions]
                  : allPromotions

                return (
                  <div className="relative -mx-4 px-4">
                    <div 
                      ref={(el) => {
                        carouselRef.current = el
                      }}
                      className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                      style={{
                        WebkitOverflowScrolling: 'touch',
                        scrollBehavior: 'smooth'
                      }}
                    >
                      {displayPromotions.map((promo, index) => {
                        const getDaysRemaining = (endDate) => {
                          const now = new Date()
                          const end = new Date(endDate)
                          const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
                          return diff
                        }

                        const daysLeft = getDaysRemaining(promo.end_date)
                        const isEndingSoon = daysLeft <= 3
                        const isNew = (() => {
                          const created = new Date(promo.created_at || promo.start_date)
                          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          return created >= sevenDaysAgo
                        })()

                        const cardColors = [
                          { bg: 'bg-yellow-400', text: 'text-yellow-900' },
                          { bg: 'bg-teal-500', text: 'text-teal-900' },
                          { bg: 'bg-pink-400', text: 'text-pink-900' },
                          { bg: 'bg-purple-400', text: 'text-purple-900' },
                          { bg: 'bg-blue-400', text: 'text-blue-900' },
                          { bg: 'bg-green-400', text: 'text-green-900' },
                          { bg: 'bg-orange-400', text: 'text-orange-900' },
                          { bg: 'bg-indigo-400', text: 'text-indigo-900' }
                        ]
                        const colors = cardColors[(parseInt(promo.id) || index) % cardColors.length]
                        
                        return (
                          <div
                            key={`${promo.id}-${index}`}
                            onClick={() => handlePromotionClick(promo.id)}
                            className={`relative flex-shrink-0 cursor-pointer hover:scale-105 active:scale-[0.98] transition-all duration-300 rounded-2xl overflow-hidden shadow-lg ${
                              !promo.image_url ? colors.bg : ''
                            }`}
                            style={{
                              width: 'calc(50vw - 20px)', // 2 карточки по горизонтали с небольшими отступами
                              maxWidth: '280px',
                              aspectRatio: '1 / 1.618', // Вертикальные карточки с золотым сечением
                              marginLeft: index > 0 ? '-12px' : '0', // Эффект наложения (закладки)
                              zIndex: allPromotions.length - (index % allPromotions.length) // Ближние карточки выше
                            }}
                          >
                            {/* Фоновое изображение с градиентным overlay */}
                            {promo.image_url ? (
                              <>
                                <img
                                  src={promo.image_url}
                                  alt={promo.title}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div 
                                  className="absolute inset-0"
                                  style={{
                                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))'
                                  }}
                                />
                              </>
                            ) : (
                              <div className={`absolute inset-0 ${colors.bg} opacity-90`} />
                            )}

                            {/* Иконка "подробнее" в правом верхнем углу */}
                            <div className="absolute top-3 right-3 z-20">
                              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                  <path d="M7 17L17 7M7 7h10v10" />
                                </svg>
                              </div>
                            </div>

                            {/* Название и бренд вверху */}
                            <div className="absolute top-0 left-0 right-0 z-10 p-4 pt-14">
                              <h3 
                                className="text-white font-bold mb-1 drop-shadow-lg line-clamp-2"
                                style={{
                                  fontSize: '16px',
                                  fontWeight: 700,
                                  lineHeight: '1.3',
                                  color: '#FFFFFF'
                                }}
                              >
                                {promo.title}
                              </h3>
                              {promo.partner?.company_name && (
                                <p 
                                  className="text-white/90 drop-shadow-md line-clamp-1"
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    opacity: 0.9
                                  }}
                                >
                                  {promo.partner.company_name}
                                </p>
                              )}
                            </div>

                            {/* Бейджи статуса */}
                            <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
                              {isEndingSoon && (
                                <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg">
                                  🔥 {daysLeft}д
                                </div>
                              )}
                              {isNew && !isEndingSoon && (
                                <div className="bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg">
                                  ⚡ {t('promo_new')}
                                </div>
                              )}
                            </div>

                            {/* Цена в правом нижнем углу */}
                            <div className="absolute bottom-4 right-4 z-10">
                              <div 
                                className="text-white font-bold drop-shadow-lg"
                                style={{
                                  fontSize: '18px',
                                  fontWeight: 700,
                                  color: '#FFFFFF'
                                }}
                              >
                                {promo.discount_value || (promo.required_points > 0 ? `${promo.required_points} ${t('promo_points')}` : t('promo_free'))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="bg-sakura-surface/15 rounded-xl p-8 text-center border border-sakura-border/30">
              <p className="text-sakura-mid">{t('no_promotions') || 'Нет активных акций'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Онбординг при первом заходе */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-sakura-deep/90 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-sakura-deep mb-4">
              {onboardingStep === 1 ? t('onboarding_screen1_title') : t('home_referral_title')}
            </h2>
            <p className="text-sakura-mid text-sm mb-6 whitespace-pre-line">
              {onboardingStep === 1 ? t('onboarding_screen1_text') : t('onboarding_screen2_text')}
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {onboardingStep === 2 ? (
                  <button
                    type="button"
                    onClick={dismissOnboarding}
                    className="flex-1 py-3 rounded-xl bg-sakura-accent text-white font-semibold"
                  >
                    {t('onboarding_start')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={nextOnboardingStep}
                      className="flex-1 py-3 rounded-xl bg-sakura-accent text-white font-semibold"
                    >
                      {language === 'ru' ? 'Далее' : 'Next'}
                    </button>
                    <button
                      type="button"
                      onClick={dismissOnboarding}
                      className="py-3 px-4 rounded-xl border border-sakura-border text-sakura-deep font-medium"
                    >
                      {t('onboarding_start')}
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={dismissOnboarding}
                className="mt-2 text-xs text-sakura-mid hover:underline"
              >
                {t('onboarding_dont_show_again')}
              </button>
            </div>
          </div>
        </div>
      )}

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

