import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramUser, getChatId, hapticFeedback, openTelegramLink } from '../utils/telegram'
import QRCode from 'qrcode'
import { getClientBalance, getClientKarma, getActivePromotions, getApprovedServices, getPublishedNews, getClientPopularCategories, getGlobalPopularCategories, getCategoryPartnerCounts, getBackgroundImage, getReferralPartnerInfo, getReferralStats, getOrCreateReferralCode, getOnboardingSeen, setOnboardingSeen, isApprovedPartner } from '../services/supabase'
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
import Layout from '../components/Layout'
import LoyaltyCard from '../components/LoyaltyCard'
import KarmaIndicator from '../components/KarmaIndicator'
import CategoryGridNeo, { buildCategoriesFromServiceTiles } from '../components/CategoryGridNeo'
import NewsCarouselNeo from '../components/NewsCarouselNeo'
// BottomNav теперь глобально в App.jsx
import ThemeSwitcher from '../components/ThemeSwitcher'
import QuickActions from '../components/QuickActions'
import QuickActionsGrid, { DEFAULT_CATEGORIES } from '../components/QuickActionsGrid'
import { shareReferralLink, buildReferralLink } from '../utils/referralShare'
import { Share2 } from 'lucide-react'

// Простая лестница уровней лояльности по количеству баллов
// Порог = количество баллов, с которого начинается уровень
const TIER_LADDER = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 500 },
  { name: 'Gold', threshold: 2000 },
  { name: 'Platinum', threshold: 5000 },
  { name: 'Diamond', threshold: 10000 },
]

const getTierInfo = (balance) => {
  let current = TIER_LADDER[0]
  let next = null

  for (let i = 0; i < TIER_LADDER.length; i += 1) {
    const tier = TIER_LADDER[i]
    if (balance >= tier.threshold) {
      current = tier
      next = TIER_LADDER[i + 1] || null
    } else {
      next = tier
      break
    }
  }

  if (!next) {
    // Пользователь на максимальном уровне
    return {
      currentTier: current.name,
      nextTierName: current.name,
      nextTierPoints: null,
    }
  }

  return {
    currentTier: current.name,
    nextTierName: next.name,
    nextTierPoints: next.threshold,
  }
}

const getTierLabelKey = (name) => {
  switch (name) {
    case 'Bronze':
      return 'tier_bronze'
    case 'Silver':
      return 'tier_silver'
    case 'Gold':
      return 'tier_gold'
    case 'Platinum':
      return 'tier_platinum'
    case 'Diamond':
      return 'tier_diamond'
    default:
      return name
  }
}

const Home = () => {
  const navigate = useNavigate()
  const user = getTelegramUser()
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const { toast, showToast, hideToast } = useToast()
  
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
  const [categoryPartnerCounts, setCategoryPartnerCounts] = useState({})
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrImage, setQrImage] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [karmaScore, setKarmaScore] = useState(50)
  const [karmaLevel, setKarmaLevel] = useState('reliable')
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

    let cancelled = false

    const checkApiAndTranslate = async () => {
      // Если в БД уже есть предзаполненные английские поля, используем их без обращения к API
      if (language === 'en' && news.some(item => item.title_en || item.preview_text_en)) {
        const mapped = news.map(item => ({
          ...item,
          title: item.title_en || item.title,
          preview_text: item.preview_text_en || item.preview_text
        }))
        if (!cancelled) setTranslatedNews(mapped)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.warn('⚠️ VITE_API_URL не установлен. Переводы отключены. Показываем оригинальный текст.')
        if (!cancelled) setTranslatedNews(news)
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
        if (!cancelled) setTranslatedNews(translated)
      } catch (error) {
        console.error('Error translating news:', error)
        if (!cancelled) setTranslatedNews(news)
      } finally {
        if (!cancelled) setTranslating(false)
      }
    }

    checkApiAndTranslate()
    return () => { cancelled = true }
  }, [news, language])

  // Автоматический перевод акций при изменении языка
  useEffect(() => {
    if (promotions.length === 0 || language === 'ru') {
      setTranslatedPromotions(promotions)
      return
    }

    let cancelled = false

    const checkApiAndTranslate = async () => {
      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.warn('⚠️ VITE_API_URL не установлен. Переводы отключены. Показываем оригинальный текст.')
        if (!cancelled) setTranslatedPromotions(promotions)
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
        if (!cancelled) setTranslatedPromotions(translated)
      } catch (error) {
        console.error('Error translating promotions:', error)
        if (!cancelled) setTranslatedPromotions(promotions)
      } finally {
        if (!cancelled) setTranslating(false)
      }
    }

    checkApiAndTranslate()
    return () => { cancelled = true }
  }, [promotions, language])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Получаем информацию о партнере, который добавил клиента и проверяем, является ли текущий пользователь партнёром
      const [partnerInfo, isPartnerUser] = await Promise.all([
        getReferralPartnerInfo(chatId),
        chatId ? isApprovedPartner(chatId) : Promise.resolve(false)
      ])
      setReferralPartnerInfo(partnerInfo)
      
      const [balanceData, karmaData, promotionsData, servicesData, newsData, popularCats, partnerCounts] = await Promise.all([
        getClientBalance(chatId),
        getClientKarma(chatId).catch(() => ({ karmaScore: 50, karmaLevel: 'reliable' })),
        getActivePromotions(),
        getApprovedServices(),
        getPublishedNews(),
        getClientPopularCategories(chatId).catch(() => null),
        getCategoryPartnerCounts().catch(() => ({}))
      ])
      setCategoryPartnerCounts(partnerCounts || {})
      
      setBalance(balanceData?.balance || 0)
      setUserName(balanceData?.name || user?.first_name || t('profile_guest'))
      setKarmaScore(karmaData?.karmaScore ?? 50)
      setKarmaLevel(karmaData?.karmaLevel ?? 'reliable')
      setPromotions(promotionsData.slice(0, 5))
      setNews(newsData.slice(0, 5))
      
      // Если есть персональные категории, используем их, иначе глобальные
      let categories = popularCats
      if (!categories || categories.length === 0) {
        categories = await getGlobalPopularCategories()
      }
      setPopularCategories(categories || [])
      
      // Фильтруем конкурентов: клиенты видят только реферера в его категории; партнёры видят себя + реферера
      const filteredServices = filterCompetitors(servicesData, partnerInfo, isPartnerUser, isPartnerUser ? chatId : null)
      
      // Сортируем услуги по популярности категорий
      const sortedServices = sortServicesByPopularity(filteredServices, categories, partnerCounts || {})
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
  const sortServicesByPopularity = (servicesList, personalCategoryOrder, partnerCounts = {}) => {
    return [...servicesList].sort((a, b) => {
      const aCategory = a.partner?.business_type || a.category || getServiceIcon(a.title) || 'default'
      const bCategory = b.partner?.business_type || b.category || getServiceIcon(b.title) || 'default'

      const aPartnerScore = partnerCounts[aCategory] ?? 0
      const bPartnerScore = partnerCounts[bCategory] ?? 0

      if (aPartnerScore !== bPartnerScore) {
        return bPartnerScore - aPartnerScore
      }

      const aPersonalRank = personalCategoryOrder?.indexOf(aCategory) ?? -1
      const bPersonalRank = personalCategoryOrder?.indexOf(bCategory) ?? -1
      const aPersonalScore = aPersonalRank === -1 ? 0 : (personalCategoryOrder?.length || 0) - aPersonalRank
      const bPersonalScore = bPersonalRank === -1 ? 0 : (personalCategoryOrder?.length || 0) - bPersonalRank

      if (aPersonalScore !== bPersonalScore) {
        return bPersonalScore - aPersonalScore
      }

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

  // Генерация QR-кода для пользователя
  const handleShowQr = async () => {
    if (!chatId) {
      showToast(language === 'ru' ? 'Необходима авторизация' : 'Authorization required')
      return
    }

    hapticFeedback('light')
    setQrLoading(true)

    try {
      // Формат QR: CLIENT_ID:<chat_id>
      const qrData = `CLIENT_ID:${chatId}`
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff'
        }
      })
      setQrImage(qrDataUrl)
      setShowQrModal(true)
    } catch (error) {
      console.error('Error generating QR:', error)
      showToast(language === 'ru' ? 'Ошибка генерации QR-кода' : 'Error generating QR code')
    } finally {
      setQrLoading(false)
    }
  }

  // Отправка сообщения в поддержку
  const handleSupport = () => {
    hapticFeedback('light')
    const botUsername = import.meta.env.VITE_CLIENT_BOT_USERNAME || 'mindbeatybot'
    const supportLink = `https://t.me/${botUsername}?start=support`
    openTelegramLink(supportLink)
  }

  // Skeleton вместо Loader (новый дизайн)
  if (loading) {
    return (
      <Layout>
        <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-6 pb-4">
          {/* Header skeleton */}
          <header className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
              <div className="flex flex-col gap-1">
                <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
                <div className="h-3 w-16 rounded animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
              </div>
            </div>
            <div className="h-8 w-16 rounded-full animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
          </header>
          {/* LoyaltyCard skeleton */}
          <div className="h-[200px] rounded-3xl animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
          {/* QuickActions skeleton */}
          <div className="flex gap-3">
            <div className="flex-1 h-14 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
            <div className="flex-1 h-14 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
          </div>
          {/* QuickActionsGrid skeleton */}
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[100px] rounded-[24px] animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
            ))}
          </div>
          {/* News carousel skeleton */}
          <div className="flex gap-4 overflow-hidden">
            <div className="flex-none w-[280px] h-[160px] rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
            <div className="flex-none w-[280px] h-[160px] rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
          </div>
          {/* Categories skeleton */}
          <div className="grid grid-cols-3 gap-4 pb-20">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
                <div className="h-3 w-10 rounded animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color, #e5e7eb)' }} />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  // Новый дизайн (по умолчанию)
  const { currentTier, nextTierName, nextTierPoints } = getTierInfo(balance || 0)
    const currentTierLabel = t(getTierLabelKey(currentTier))
    const promoItems = Array.isArray(translatedPromotions)
      ? translatedPromotions.map((p) => ({
          id: `promo-${p.id}`,
          rawId: p.id,
          title: p.title,
          image: p.image_url || undefined,
          tag: 'АКЦИЯ',
          kind: 'promo',
        }))
      : []
    const newsItems = Array.isArray(translatedNews)
      ? translatedNews.map((n) => ({
          id: `news-${n.id}`,
          rawId: n.id,
          title: n.title,
          image: n.image_url || n.image || undefined,
          tag: 'НОВОСТЬ',
          kind: 'news',
        }))
      : []
    const carouselItems = [...promoItems, ...newsItems]
    const serviceTiles = getServiceTiles()
    const neoCategories = buildCategoriesFromServiceTiles(serviceTiles)
    const CATEGORY_KEYS = [
      'category_beauty',
      'category_food',
      'category_sport',
      'category_health',
      'category_shopping',
      'category_coffee',
      'category_gaming',
      'category_travel',
      'category_more',
    ]
    const localizedCategories = neoCategories.map((cat, index) => ({
      ...cat,
      name: t(CATEGORY_KEYS[index] || 'category_more'),
    }))
    const handleQuickAction = (cat) => {
      hapticFeedback('light')
      if (cat.nameKey === 'support') {
        handleSupport()
      } else if (cat.nameKey === 'activities') {
        navigate('/history')
      } else {
        navigate('/promotions')
      }
    }
    const getQuickActionLabel = (cat) => {
      if (cat.nameKey === 'rewards_store') return language === 'ru' ? 'Магазин наград' : 'Rewards Store'
      if (cat.nameKey === 'activities') return t('history_title')
      if (cat.nameKey === 'partner_offers') return t('promo_title')
      if (cat.nameKey === 'support') return t('profile_support')
      return cat.nameEn
    }
    return (
      <Layout>
        <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-6 pb-4">
          <header className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tg-secondary-bg flex items-center justify-center text-sm font-semibold">
                {userName.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-bold text-tg-text">
                  {t('home_greeting')} {userName}
                </h1>
                <p className="text-[11px] text-tg-hint uppercase tracking-wide">
                  {currentTierLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </header>
          <LoyaltyCard
            balance={balance}
            nextTierPoints={nextTierPoints}
            currentTier={currentTier}
            nextTierName={nextTierName}
            t={t}
            lang={language}
          />
          <div className="rounded-xl p-4 shadow-sm" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
            <KarmaIndicator karmaScore={karmaScore} karmaLevel={karmaLevel} />
          </div>
          <QuickActions
            onScanQr={handleShowQr}
            onInvite={() => { hapticFeedback('light'); navigate('/community') }}
            scanLabel={language === 'ru' ? 'Сканировать QR' : 'Scan QR'}
            inviteLabel={language === 'ru' ? 'Пригласить' : 'Invite'}
            loading={qrLoading}
          />
          <QuickActionsGrid
            categories={DEFAULT_CATEGORIES}
            onSelect={handleQuickAction}
            getLabel={getQuickActionLabel}
          />
          {/* Реферальный блок */}
          {chatId && referralCode && (
            <section
              className="p-4 rounded-2xl border border-black/5 dark:border-white/5"
              style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
                    {t('home_referral_title')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>
                    {t('home_referral_subtitle')}
                  </p>
                </div>
                {referralStats && (
                  <span className="text-lg">
                    {({ bronze: '\u{1F949}', silver: '\u{1F948}', gold: '\u{1F947}', platinum: '\u{1F48E}' })[referralStats.referral_level] || '\u{1F949}'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  hapticFeedback('light')
                  const link = buildReferralLink(referralCode)
                  await shareReferralLink(link, {
                    title: 'LoyaltyBot',
                    text: t('home_referral_subtitle'),
                    onSuccess: () => showToast(t('toast_link_copied')),
                    onError: () => showToast(t('toast_copy_failed')),
                  })
                }}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)',
                }}
              >
                <Share2 size={16} />
                {t('home_referral_share_btn')}
              </button>
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => { hapticFeedback('light'); navigate('/partner/apply') }}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--tg-theme-link-color)' }}
                >
                  {t('referral_become_partner_btn')} →
                </button>
                <button
                  type="button"
                  onClick={() => { hapticFeedback('light'); navigate('/community') }}
                  className="text-xs"
                  style={{ color: 'var(--tg-theme-hint-color)' }}
                >
                  {t('home_referral_more')} →
                </button>
              </div>
            </section>
          )}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-tg-text">
                {t('news_latest')}
              </h2>
              <button
                type="button"
                className="text-xs text-tg-link"
                onClick={() => navigate('/promotions')}
              >
                {t('home_see_all')}
              </button>
            </div>
            <NewsCarouselNeo
              items={carouselItems.length > 0 ? carouselItems : undefined}
              translating={translating}
              onItemClick={(item) => {
                hapticFeedback('light')
                if (item.kind === 'promo') {
                  navigate(`/promotions/${item.rawId}`)
                } else if (item.kind === 'news') {
                  navigate(`/news/${item.rawId}`)
                }
              }}
            />
          </section>
          <section className="space-y-3 pb-20">
            <h2 className="text-sm font-semibold text-tg-text">{t('home_services')}</h2>
            <CategoryGridNeo
              categories={localizedCategories}
              onSelect={(cat) => {
                if (cat?.id === 9) {
                  navigate('/categories')
                  return
                }
                const params = new URLSearchParams()
                if (cat?.serviceCode) {
                  params.set('category', cat.serviceCode)
                }
                navigate(params.toString() ? `/services?${params.toString()}` : '/services')
              }}
            />
          </section>
        </div>
        <LocationSelector
          isOpen={isLocationSelectorOpen}
          onClose={() => setIsLocationSelectorOpen(false)}
          onSelect={handleLocationSelect}
        />
        <HomeOnboarding
          showOnboarding={showOnboarding}
          onboardingStep={onboardingStep}
          language={language}
          t={t}
          onNext={nextOnboardingStep}
          onDismiss={dismissOnboarding}
        />
        {/* QR Modal */}
        {showQrModal && qrImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowQrModal(false)}
          >
            <div
              className="bg-sakura-surface dark:bg-sakura-dark rounded-3xl p-6 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-2 text-tg-text">
                {language === 'ru' ? 'Ваш QR-код' : 'Your QR Code'}
              </h3>
              <p className="text-sm text-tg-hint mb-4">
                {language === 'ru'
                  ? 'Покажите этот QR-код партнеру для быстрого начисления или списания баллов'
                  : 'Show this QR code to the partner for quick points accrual or redemption'}
              </p>
              <div className="flex justify-center mb-4 bg-white rounded-2xl p-4">
                <img src={qrImage} alt="QR Code" className="w-64 h-64 object-contain" />
              </div>
              {chatId && (
                <p className="text-xs text-tg-hint mb-4 font-mono">
                  ID: {chatId}
                </p>
              )}
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-3 rounded-xl font-medium bg-tg-secondary-bg text-tg-text active:scale-[0.98] transition-transform"
                style={{
                  backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                }}
              >
                {language === 'ru' ? 'Закрыть' : 'Close'}
              </button>
            </div>
          </div>
        )}
        {toast && <Toast message={toast.message} type={toast.type} key={toast.key} onClose={hideToast} />}
      </Layout>
    )
}

export default Home

