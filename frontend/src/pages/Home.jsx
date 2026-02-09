import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices, getPublishedNews, getClientPopularCategories, getGlobalPopularCategories, getBackgroundImage, getReferralPartnerInfo, getReferralStats, getOrCreateReferralCode, getOnboardingSeen, setOnboardingSeen, isApprovedPartner } from '../services/supabase'
import { getServiceIcon, getMainPageCategories, getCategoryByCode, serviceCategories } from '../utils/serviceIcons'
import { filterCompetitors } from '../utils/categoryHelpers'
import { useTranslation, translateDynamicContent, declinePoints } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import LocationSelector from '../components/LocationSelector'
import LanguageSwitcher from '../components/LanguageSwitcher'
import HomeBalance from '../components/home/HomeBalance'
import HomeReferral from '../components/home/HomeReferral'
import HomeNews from '../components/home/HomeNews'
import HomeCategoryGrid from '../components/home/HomeCategoryGrid'
import HomePromotions from '../components/home/HomePromotions'
import HomeOnboarding from '../components/home/HomeOnboarding'
import {
  BalanceSkeleton,
  CarouselCardSkeleton,
  NewsCardSkeleton,
  ServiceSkeleton
} from '../components/SkeletonCard'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

const Home = () => {
  const navigate = useNavigate()
  const user = getTelegramUser()
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const { toast, showToast, hideToast } = useToast()
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

  const onboardingSeenKey = 'loyalitybot_onboarding_seen'
  const onboardingSeenKeyLegacy = 'onboarding_seen'

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let seen = false
      if (chatId) {
        try {
          seen = await getOnboardingSeen(chatId)
        } catch (_) {}
      }
      if (!cancelled && !seen) {
        try {
          if (typeof localStorage !== 'undefined') {
            seen = !!localStorage.getItem(onboardingSeenKey) || !!localStorage.getItem(onboardingSeenKeyLegacy)
          }
          if (!seen && typeof sessionStorage !== 'undefined') {
            seen = !!sessionStorage.getItem(onboardingSeenKey) || !!sessionStorage.getItem(onboardingSeenKeyLegacy)
          }
        } catch (_) {}
      }
      if (!cancelled && !seen) setShowOnboarding(true)
    }
    run()
    return () => { cancelled = true }
  }, [chatId])

  const dismissOnboarding = () => {
    setShowOnboarding(false)
    setOnboardingStep(1)
    if (chatId) setOnboardingSeen(chatId).catch(() => {})
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(onboardingSeenKey, '1')
        localStorage.setItem(onboardingSeenKeyLegacy, '1')
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(onboardingSeenKey, '1')
        sessionStorage.setItem(onboardingSeenKeyLegacy, '1')
      }
    } catch (_) {}
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
      
      // Получаем информацию о партнере, который добавил клиента и проверяем, является ли текущий пользователь партнёром
      const [partnerInfo, isPartnerUser] = await Promise.all([
        getReferralPartnerInfo(chatId),
        chatId ? isApprovedPartner(chatId) : Promise.resolve(false)
      ])
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
      
      // Фильтруем конкурентов перед сортировкой (для партнёров ограничения не применяем — показываем все услуги)
      const filteredServices = filterCompetitors(servicesData, isPartnerUser ? null : partnerInfo)
      
      // Сортируем услуги по популярности категорий
      const sortedServices = sortServicesByPopularity(filteredServices, categories)
      setServices(sortedServices.slice(0, 8))

      setPointsToNextReward(
        calculatePointsToNextReward(servicesData, balanceData?.balance || 0)
      )
    } catch (error) {
      console.error('Error loading home data:', error)
      showToast(t('error_something_wrong'))
    } finally {
      setLoading(false)
    }
  }

  // normalizeCategoryCode, isCompetitor, filterCompetitors → utils/categoryHelpers.js

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

        <HomeBalance
          balance={balance}
          pointsToNextReward={pointsToNextReward}
          language={language}
          t={t}
          navigate={navigate}
          declinePoints={declinePoints}
        />

        <HomeReferral
          chatId={chatId}
          referralStats={referralStats}
          referralCode={referralCode}
          referralToast={referralToast}
          referralLoading={referralLoading}
          language={language}
          t={t}
          navigate={navigate}
          setReferralToast={setReferralToast}
        />
      </div>

      {/* Секция новостей + категории + акции */}
      <div className="bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-t-[2rem] px-4 pt-6 pb-4">
        <HomeNews
          translatedNews={translatedNews}
          translating={translating}
          language={language}
          t={t}
          navigate={navigate}
          onNewsClick={handleNewsClick}
          formatDate={formatDate}
        />
        

        <HomeCategoryGrid language={language} t={t} navigate={navigate} />

        <HomePromotions
          translatedPromotions={translatedPromotions}
          carouselRef={carouselRef}
          t={t}
          navigate={navigate}
          onPromotionClick={handlePromotionClick}
        />
      </div>

            <HomeOnboarding
        showOnboarding={showOnboarding}
        onboardingStep={onboardingStep}
        language={language}
        t={t}
        onNext={nextOnboardingStep}
        onDismiss={dismissOnboarding}
      />

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

      {toast && <Toast message={toast.message} type={toast.type} key={toast.key} onClose={hideToast} />}
    </div>
  )
}

export default Home

