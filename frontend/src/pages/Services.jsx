import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFilteredServices, getClientBalance, getClientRatedPartners, getPartnersMetrics, getReferralPartnerInfo, getPromotionsForService, notifyPartnerInterest, upsertNpsRating, isApprovedPartner } from '../services/supabase'
import { getChatId, getUsername, hapticFeedback, showAlert, openTelegramLink } from '../utils/telegram'
import { getCategoryByCode, serviceCategories, getAllServiceCategories, getCategoryGroupByCode } from '../utils/serviceIcons'
import { normalizeCategoryCode, isCompetitor } from '../utils/categoryHelpers'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import useCurrencyStore from '../store/currencyStore'
import { formatPriceWithPoints, fetchExchangeRates } from '../utils/currency'
import { supabase } from '../services/supabase'
import Loader from '../components/Loader'
import Layout from '../components/Layout'
import LocationSelector from '../components/LocationSelector'
import { PartnerCardSkeleton } from '../components/SkeletonCard'
import ServicesFilterBar from '../components/ServicesFilterBar'
import QuickRatingModal from '../components/services/QuickRatingModal'
import ServiceModal from '../components/services/ServiceModal'
import EmptyCategoryModal from '../components/services/EmptyCategoryModal'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import QRCode from 'qrcode'

const CATEGORY_PRIORITY = {
  nail_care: -1000,
  body_wellness: 1000,
  nutrition_coaching: 1001,
  mindfulness_coaching: 1002,
  image_consulting: 1003
}

const Services = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const cityParam = searchParams.get('city')
  const districtParam = searchParams.get('district')
  const categoryParam = searchParams.get('category')
  const categoryGroupParam = searchParams.get('category_group')
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const { currency, rates, setRates } = useCurrencyStore()
  const { toast, showToast, hideToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [balance, setBalance] = useState(0)
  const [filter, setFilter] = useState('all') // none, all, my_district, favorites, search
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [expandedItem, setExpandedItem] = useState(null) // ID раскрытого элемента
  const [selectedService, setSelectedService] = useState(null)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [isQrLoading, setIsQrLoading] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrError, setQrError] = useState(null)
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState(cityParam || '')
  const [selectedDistrict, setSelectedDistrict] = useState(districtParam || '')
  const [favoritePartnerIds, setFavoritePartnerIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`fav_partners_${chatId}`) || '[]')
    } catch { return [] }
  })
  const [categoryFilter, setCategoryFilter] = useState(categoryParam || null)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)
  const [partnersMetrics, setPartnersMetrics] = useState({})
  const [referralPartnerInfo, setReferralPartnerInfo] = useState(null)
  const [isPartnerUser, setIsPartnerUser] = useState(false)
  const [servicePromotions, setServicePromotions] = useState({}) // serviceId -> promotions[]
  const [isEmptyCategoryModalOpen, setIsEmptyCategoryModalOpen] = useState(false)
  const [emptyCategoryCode, setEmptyCategoryCode] = useState(null)
  const [lastSelectedCategory, setLastSelectedCategory] = useState(null) // Защита от повторных вызовов
  const [sortBy, setSortBy] = useState('default') // default | rating | nps
  const [quickRatingModal, setQuickRatingModal] = useState({ open: false, group: null, rating: 0 })
  const [quickRatingSubmitting, setQuickRatingSubmitting] = useState(false)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const serviceModalRef = useRef(null)
  const pullStartY = useRef(0)
  const listContainerRef = useRef(null)

  const resolveCategory = useCallback((code) => {
    if (!code) return null
    return getCategoryByCode(code) || serviceCategories[code] || null
  }, [])

  const getCategorySortValue = useCallback((code) => {
    const canonical = normalizeCategoryCode(code)
    if (!canonical) return 500
    if (Object.prototype.hasOwnProperty.call(CATEGORY_PRIORITY, canonical)) {
      return CATEGORY_PRIORITY[canonical]
    }
    const categoryData = resolveCategory(canonical)
    return categoryData?.displayOrder ?? 500
  }, [resolveCategory])

  useEffect(() => {
    loadData()
    // Загружаем курсы валют
    fetchExchangeRates(supabase).then(newRates => {
      if (newRates) setRates(newRates)
    })
  }, [chatId, cityParam, districtParam])

  // debounce поискового запроса
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(id)
  }, [searchQuery])

  useEffect(() => {
    // Обработка category_group параметра
    if (categoryGroupParam) {
      // При переходе по группе с явной категорией в URL — синхронизируем фильтр
      if (categoryParam) {
        const normalizedParam = normalizeCategoryCode(categoryParam)
        if (normalizedParam && normalizedParam !== categoryFilter) {
          setCategoryFilter(normalizedParam)
        }
      } else {
        // Без category в URL — показываем все категории группы по умолчанию
        if (categoryFilter) setCategoryFilter(null)
      }
    }
    // Синхронизируем categoryFilter с URL параметром только при изменении categoryParam
    else if (categoryParam) {
      const normalizedParam = normalizeCategoryCode(categoryParam)
      if (normalizedParam && normalizedParam !== categoryFilter) {
        setCategoryFilter(normalizedParam)
      }
    } else if (!categoryParam && !categoryGroupParam && categoryFilter) {
      setCategoryFilter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam, categoryGroupParam]) // Убрали categoryFilter и normalizeCategoryCode из зависимостей для предотвращения зацикливания

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Получаем информацию о партнере, который добавил клиента и проверяем, является ли текущий пользователь партнёром
      const [partnerInfo, approvedPartner] = await Promise.all([
        getReferralPartnerInfo(chatId),
        chatId ? isApprovedPartner(chatId) : Promise.resolve(false)
      ])
      setReferralPartnerInfo(partnerInfo)
      setIsPartnerUser(!!approvedPartner)
      
      const [servicesData, balanceData, ratedPartners] = await Promise.all([
        getFilteredServices(cityParam || null, null),
        getClientBalance(chatId),
        getClientRatedPartners(chatId)
      ])
      setServices(servicesData)
      setBalance(balanceData?.balance || 0)
      // Автоопределение города: URL param → localStorage → город реферального партнёра
      const autoCity = cityParam
        || localStorage.getItem('selectedCity')
        || (partnerInfo?.city && partnerInfo.city !== 'Online' && partnerInfo.city !== 'Все' ? partnerInfo.city : '')
        || ''
      setSelectedCity(autoCity)
      setSelectedDistrict('')
      // Объединяем оценённых (из БД) + избранных (из localStorage)
      const localFavs = (() => { try { return JSON.parse(localStorage.getItem(`fav_partners_${chatId}`) || '[]') } catch { return [] } })()
      const merged = [...new Set([...(ratedPartners || []), ...localFavs])]
      setFavoritePartnerIds(merged)

      // Загружаем метрики партнёров
      const partnerIds = [...new Set(servicesData.map(s => s.partner_chat_id).filter(Boolean))]
      if (partnerIds.length > 0) {
        const metrics = await getPartnersMetrics(partnerIds)
        setPartnersMetrics(metrics)
      }
    } catch (error) {
      console.error('Error loading services:', error)
      showToast(t('error_something_wrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelect = (location) => {
    const params = new URLSearchParams()
    if (location.city) params.set('city', location.city)
    if (categoryFilter) params.set('category', categoryFilter)
    setSearchParams(params)
    setSelectedCity(location.city || '')
    setSelectedDistrict('')
    // Если выбран город — активируем фильтр "Город", если сброшен — "Мировой"
    if (location.city) {
      setFilter('my_district')
    } else {
      setFilter('all')
    }
    loadData()
  }

  const handleOpenLocationSelector = () => {
    hapticFeedback('light')
    setIsLocationSelectorOpen(true)
  }

  // Группировка услуг по категории и компании
  // ВАЖНО: Всегда используем business_type партнёра для группировки,
  // чтобы все услуги одного партнёра были в одной группе
  const getGroupedServices = () => {
    const groupsMap = {}
    
    // Сначала находим основную категорию для каждого партнёра
    const partnerCategories = new Map()
    services.forEach(service => {
      const partnerId = service.partner_chat_id || 'unknown'
      if (!partnerCategories.has(partnerId)) {
        // Приоритет: business_type партнёра > первая категория услуг
        const category = service.partner?.business_type || service.category || 'other'
        partnerCategories.set(partnerId, category)
      }
    })
    
    services.forEach(service => {
      const partnerId = service.partner_chat_id || 'unknown'
      // ВСЕГДА используем business_type партнёра или основную категорию из его услуг
      const rawCategoryCode = service.partner?.business_type || 
                              partnerCategories.get(partnerId) || 
                              service.category || 
                              'other'
      const companyName = service.partner?.company_name || service.partner?.name || t('partner_not_connected')
      const category = resolveCategory(rawCategoryCode) || {
        code: rawCategoryCode,
        name: 'Услуга',
        emoji: '⭐'
      }
      const canonicalCode = category.code || rawCategoryCode
      const key = `${canonicalCode}_${partnerId}`
      
      // Получаем метрики партнёра
      const metrics = partnersMetrics[partnerId] || {
        npsScore: 0,
        avgRating: 0,
        ratingsCount: 0,
        promoters: 0,
        passives: 0,
        detractors: 0
      }
      
      if (!groupsMap[key]) {
        groupsMap[key] = {
          id: key,
          categoryCode: canonicalCode,
          categoryName: category.name,
          categoryEmoji: category.emoji,
          companyName,
          partnerId,
          partner: service.partner,
          services: [],
          // Используем реальные метрики вместо заглушки
          rating: metrics.avgRating || 0,
          npsScore: metrics.npsScore || 0,
          ratingsCount: metrics.ratingsCount || 0,
          metrics
        }
      }
      
      groupsMap[key].services.push(service)
    })
    
    // Сортируем: по категории, затем NPS → кол-во голосов
    return Object.values(groupsMap).sort((a, b) => {
      const categoryDiff = getCategorySortValue(a.categoryCode) - getCategorySortValue(b.categoryCode)
      if (categoryDiff !== 0) return categoryDiff

      // 1. NPS (выше = лучше)
      const npsDiff = (b.npsScore || 0) - (a.npsScore || 0)
      if (npsDiff !== 0) return npsDiff

      // 2. Количество голосов (больше = лучше)
      return (b.ratingsCount || 0) - (a.ratingsCount || 0)
    })
  }

  const favoritePartnerIdsSet = useMemo(() => new Set(favoritePartnerIds), [favoritePartnerIds])

  const categoryOptions = useMemo(() => {
    const optionMap = new Map()
    // Находим основную категорию для каждого партнёра
    const partnerCategoriesMap = new Map()
    services.forEach(service => {
      const partnerId = service.partner_chat_id || 'unknown'
      if (!partnerCategoriesMap.has(partnerId)) {
        const category = service.partner?.business_type || service.category
        partnerCategoriesMap.set(partnerId, category)
      }
    })
    
    services.forEach(service => {
      const partnerId = service.partner_chat_id || 'unknown'
      // ВСЕГДА используем business_type партнёра или основную категорию
      const rawCode = service.partner?.business_type || 
                      partnerCategoriesMap.get(partnerId) || 
                      service.category
      if (!rawCode) return
      const categoryData = resolveCategory(rawCode)
      if (!categoryData) return
      const canonicalCode = categoryData.code || rawCode
      if (!optionMap.has(canonicalCode)) {
        optionMap.set(canonicalCode, { code: canonicalCode, data: categoryData })
      }
    })

    return Array.from(optionMap.values()).sort(
      (a, b) => getCategorySortValue(a.code) - getCategorySortValue(b.code)
    )
  }, [services, resolveCategory, getCategorySortValue])

  const handleCategorySelect = (code) => {
    // Защита от повторных вызовов для той же категории
    if (lastSelectedCategory === code && categoryFilter === code) {
      return
    }
    
    hapticFeedback('light')
    setLastSelectedCategory(code)
    setCategoryFilter(code)
    setExpandedItem(null)
    setIsCategoryMenuOpen(false)
    const params = new URLSearchParams(searchParams)
    params.set('category', code)
    setSearchParams(params)
    
    // Проверяем наличие партнеров в категории
    const normalizedCode = normalizeCategoryCode(code)
    
    const hasPartnersInCategory = services.some(service => {
      // Скрываем конкурентов
      if (isCompetitor(service, referralPartnerInfo, isPartnerUser)) {
        return false
      }
      
      // Проверяем соответствие категории
      const rawCode = service.partner?.business_type || service.category
      if (!rawCode) return false
      const serviceCategoryCode = normalizeCategoryCode(rawCode)
      return serviceCategoryCode === normalizedCode
    })
    
    // Если нет партнеров, показываем модальное окно после небольшой задержки
    if (!hasPartnersInCategory) {
      setTimeout(() => {
        setEmptyCategoryCode(code)
        setIsEmptyCategoryModalOpen(true)
      }, 200)
    }
  }

  const resetCategoryFilter = () => {
    hapticFeedback('light')
    setCategoryFilter(null)
    setExpandedItem(null)
    setFilter('all')
    setIsCategoryMenuOpen(false)
    const params = new URLSearchParams(searchParams)
    params.delete('category')
    setSearchParams(params)
  }

  const isOnlinePartner = (partner) => {
    if (!partner) return false
    const workMode = partner.work_mode || partner.workMode
    if (workMode === 'online' || workMode === 'hybrid') {
      return true
    }
    // Обратная совместимость: work_mode не задан (null) — считаем онлайн, если город «Все», «Online» или не указан
    const city = partner?.city?.trim()?.toLowerCase()
    if (!city) return true
    if (city === 'все' || city === 'online') return true
    return false
  }

  const matchesCity = (group) => {
    if (!selectedCity) return true
    if (isOnlinePartner(group.partner)) return true
    return group.partner?.city === selectedCity
  }

  const matchesDistrict = (group) => {
    if (!selectedDistrict) {
      return isOnlinePartner(group.partner)
    }
    if (isOnlinePartner(group.partner)) return true
    return group.partner?.district === selectedDistrict
  }

  // isCompetitor → utils/categoryHelpers.js

  useEffect(() => {
    // Проверяем, что категория валидна - либо есть в существующих услугах, либо в списке всех возможных категорий
    if (categoryFilter) {
      const existsInOptions = categoryOptions.find(option => option.code === categoryFilter)
      const existsInAllCategories = getAllServiceCategories().some(cat => cat.code === categoryFilter)
      const existsInServiceCategories = serviceCategories[categoryFilter]
      
      // Сбрасываем только если категория не существует ни в одном из списков
      if (!existsInOptions && !existsInAllCategories && !existsInServiceCategories) {
        setCategoryFilter(null)
      }
    }
  }, [categoryFilter, categoryOptions])

  // Проверяем наличие партнеров в категории после загрузки данных
  // ВАЖНО: Этот useEffect срабатывает только когда данные загружены и категория выбрана
  useEffect(() => {
    // Пропускаем, если еще загружается или нет данных
    if (loading || services.length === 0) {
      return
    }
    
    // Пропускаем, если категория не выбрана
    if (!categoryFilter) {
      return
    }
    
    // Пропускаем, если модальное окно уже открыто
    if (isEmptyCategoryModalOpen) {
      return
    }
    
    // Небольшая задержка, чтобы дать время на обновление всех состояний
    const checkTimer = setTimeout(() => {
      const normalizedCode = normalizeCategoryCode(categoryFilter)
      
      const hasPartnersInCategory = services.some(service => {
        // Скрываем конкурентов
        if (isCompetitor(service, referralPartnerInfo, isPartnerUser)) {
          return false
        }
        
        // Проверяем соответствие категории
        const rawCode = service.partner?.business_type || service.category
        if (!rawCode) return false
        const serviceCategoryCode = normalizeCategoryCode(rawCode)
        return serviceCategoryCode === normalizedCode
      })
      
      // Если нет партнеров в категории, показываем модальное окно
      if (!hasPartnersInCategory) {
        setEmptyCategoryCode(categoryFilter)
        setIsEmptyCategoryModalOpen(true)
      }
    }, 500)
    
    return () => clearTimeout(checkTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, services.length, loading, isEmptyCategoryModalOpen])

  const getFilteredGroups = () => {
    let groups = getGroupedServices()

    // Обработка category_group: фильтруем по всем категориям из группы
    if (categoryGroupParam) {
      const group = getCategoryGroupByCode(categoryGroupParam)
      if (group && group.categories) {
        const allowedCategories = new Set(
          group.categories.map(cat => normalizeCategoryCode(cat)).filter(Boolean)
        )
        groups = groups.filter(g => allowedCategories.has(normalizeCategoryCode(g.categoryCode)))
      }
    }

    // Фильтр по конкретной категории
    if (categoryFilter) {
      const canonical = normalizeCategoryCode(categoryFilter)
      groups = groups.filter(group => normalizeCategoryCode(group.categoryCode) === canonical)
    }

    // Скрываем конкурентов (кроме партнёра, который добавил клиента)
    groups = groups.filter(group => !isCompetitor({
      partner: group.partner,
      partner_chat_id: group.partnerId,
      category: group.categoryCode
    }, referralPartnerInfo, isPartnerUser))

    if (filter === 'my_district') {
      // Город: только локальные или гибрид в этом городе (без чисто-онлайн)
      groups = groups.filter(group => {
        if (!selectedCity) return true
        const partner = group.partner
        const workMode = partner?.work_mode || partner?.workMode
        const partnerCity = partner?.city?.trim()
        // Гибрид в нужном городе — ок
        if (workMode === 'hybrid' && partnerCity === selectedCity) return true
        // Офлайн в нужном городе — ок
        if (partnerCity === selectedCity && workMode !== 'online') return true
        return false
      })
    } else if (filter === 'favorites') {
      // Мои: только отмеченные сердечком
      groups = groups.filter(group => favoritePartnerIdsSet.has(group.partnerId))
    } else if (filter === 'all') {
      // Мировой ТОП: все партнёры, онлайн сначала, ТОП-10 по категории
      // Сортируем: онлайн выше офлайн
      groups = groups.sort((a, b) => {
        const aOnline = isOnlinePartner(a.partner) ? 0 : 1
        const bOnline = isOnlinePartner(b.partner) ? 0 : 1
        return aOnline - bOnline
      })
    } else {
      // none / search без фильтра — все
    }

    if (filter === 'search' && debouncedQuery) {
      const q = debouncedQuery.trim().toLowerCase()
      groups = groups.filter(group => {
        const matchesCategoryName = group.categoryName.toLowerCase().includes(q)
        const matchesCompany = group.companyName.toLowerCase().includes(q)
        const matchesServices = group.services.some(s => (s.title || '').toLowerCase().includes(q))
        return matchesCategoryName || matchesCompany || matchesServices
      })
    }

    return groups
  }

  const filteredGroups = useMemo(() => getFilteredGroups(), [
    services,
    filter,
    categoryFilter,
    selectedCity,
    selectedDistrict,
    favoritePartnerIds,
    debouncedQuery,
    categoryGroupParam,
    partnersMetrics,
    referralPartnerInfo,
    favoritePartnerIdsSet,
    normalizeCategoryCode,
    getCategorySortValue,
    resolveCategory,
    isCompetitor
  ])

  const sortedGroups = useMemo(() => {
    const sorted = [...filteredGroups]
    if (sortBy === 'rating') {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    } else if (sortBy === 'nps') {
      sorted.sort((a, b) => {
        const npsDiff = (b.npsScore || 0) - (a.npsScore || 0)
        if (npsDiff !== 0) return npsDiff
        return (b.ratingsCount || 0) - (a.ratingsCount || 0)
      })
    }
    // По умолчанию уже отсортировано в getGroupedServices: NPS → голоса
    return sorted
  }, [filteredGroups, sortBy])

  const rankingMap = useMemo(() => {
    const map = new Map()
    sortedGroups.forEach((group, index) => {
      if (group?.id) {
        map.set(group.id, index + 1)
      }
    })
    return map
  }, [sortedGroups])

  const topHighlightIds = useMemo(() => {
    return new Set(sortedGroups.slice(0, 3).map(group => group.id))
  }, [sortedGroups])

  const groupedSections = useMemo(() => {
    const sectionMap = new Map()

    sortedGroups.forEach(group => {
      if (!group) return
      const canonical = normalizeCategoryCode(group.categoryCode) || group.categoryCode || 'other'
      if (!sectionMap.has(canonical)) {
        sectionMap.set(canonical, {
          key: canonical,
          title: group.categoryName,
          emoji: group.categoryEmoji || '⭐',
          order: getCategorySortValue(group.categoryCode),
          items: []
        })
      }
      sectionMap.get(canonical).items.push(group)
    })

    return Array.from(sectionMap.values())
      .sort((a, b) => a.order - b.order)
      .map(section => ({
        ...section,
        // Мировой ТОП: максимум 10 партнёров на категорию
        items: filter === 'all' ? section.items.slice(0, 10) : section.items
      }))
  }, [sortedGroups, normalizeCategoryCode, getCategorySortValue, filter])

  const handleFilterChange = (newFilter) => {
    hapticFeedback('light')

    // "Город" — всегда открываем модалку для выбора/смены города
    if (newFilter === 'my_district') {
      setSearchQuery('')
      setIsLocationSelectorOpen(true)
      return
    }

    const nextFilter = filter === newFilter ? 'none' : newFilter

    if (nextFilter !== 'search') {
      setSearchQuery('')
    }

    if (nextFilter === 'none') {
      setExpandedItem(null)
    }

    setFilter(nextFilter)
  }

  const handlePlayClick = async (groupId, e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation()
    }
    hapticFeedback('light')
    
    // Отправляем уведомление партнёру о заинтересованности клиента
    if (chatId) {
      const group = filteredGroups.find(g => g.id === groupId)
      if (group && group.partnerId) {
        try {
          const clientUsername = getUsername()
          await notifyPartnerInterest(group.partnerId, chatId, clientUsername)
        } catch (error) {
          // Игнорируем ошибки отправки уведомления (не критично)
          console.warn('Не удалось отправить уведомление партнёру:', error)
        }
      }
    }
    
    setExpandedItem(expandedItem === groupId ? null : groupId)
  }

  const handleServiceClick = async (service) => {
    hapticFeedback('medium')
    setSelectedService(service)
    setIsServiceModalOpen(true)
    setQrImage('')
    setQrError(null)
    
    // Загружаем акции для этой услуги
    if (service.id) {
      const promotions = await getPromotionsForService(service.id)
      setServicePromotions(prev => ({
        ...prev,
        [service.id]: promotions
      }))
    }
  }

  const handleCloseServiceModal = () => {
    hapticFeedback('light')
    setIsServiceModalOpen(false)
    setSelectedService(null)
    setQrImage('')
    setQrError(null)
  }

  useEffect(() => {
    if (!isServiceModalOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleCloseServiceModal()
    }
    window.addEventListener('keydown', onKeyDown)
    const firstFocusable = serviceModalRef.current?.querySelector('button:not([disabled]), [href], input')
    if (firstFocusable) firstFocusable.focus?.()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isServiceModalOpen])

  const handleRedeemViaPromotion = () => {
    if (!selectedService) return
    
    // Находим первую активную акцию для обмена баллов
    const promotions = servicePromotions[selectedService.id] || []
    const redemptionPromotion = promotions.find(p => 
      p.promotion_type === 'points_redemption' && 
      p.max_points_payment && 
      p.max_points_payment > 0
    )
    
    if (redemptionPromotion) {
      hapticFeedback('medium')
      navigate(`/promotions/${redemptionPromotion.id}`)
    } else {
      showAlert(
        language === 'ru' 
          ? 'Для этой услуги нет активных акций с возможностью обмена баллов'
          : 'No active promotions with points redemption available for this service'
      )
    }
  }

  const handleGetCashback = async () => {
    if (!chatId) {
      showAlert('Авторизуйтесь через Telegram, чтобы получить QR-код.')
      return
    }

    if (!selectedService) {
      return
    }

    try {
      setIsQrLoading(true)
      setQrError(null)

      // QR код содержит только chat_id
      const qrPayload = chatId
      const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 })
      setQrImage(dataUrl)
    } catch (error) {
      console.error('Error generating cashback QR:', error)
      setQrError('Не удалось сгенерировать QR-код. Попробуйте позже.')
    } finally {
      setIsQrLoading(false)
    }
  }

  const handleBookTime = () => {
    if (!selectedService) {
      return
    }

    const bookingUrl = selectedService.booking_url || selectedService.partner?.booking_url
    
    if (!bookingUrl) {
      showAlert(language === 'ru' ? 'Ссылка на бронирование не указана для этой услуги.' : 'Booking link not specified for this service.')
      return
    }

    // Открываем ссылку в новой вкладке
    window.open(bookingUrl, '_blank')
    hapticFeedback('medium')
  }

  const handleContactPartner = () => {
    if (!selectedService || !chatId) {
      showAlert(language === 'ru' ? 'Авторизуйтесь через Telegram, чтобы написать партнёру.' : 'Please authorize via Telegram to contact partner.')
      return
    }

    const partnerChatId = selectedService.partner_chat_id
    if (!partnerChatId) {
      showAlert(language === 'ru' ? 'Партнёр не найден.' : 'Partner not found.')
      return
    }

    try {
      hapticFeedback('medium')
      
      // Формируем данные для отправки через бота
      const contactData = {
        action: 'contact_specialist',
        partner_chat_id: partnerChatId,
        client_chat_id: chatId,
        service_title: selectedService.title || '',
        service_id: selectedService.id || null,
        message_text: language === 'ru' 
          ? `Здравствуйте! Интересуюсь услугой "${selectedService.title}"`
          : `Hello! I'm interested in the service "${selectedService.title}"`,
        timestamp: Date.now()
      }

      // Кодируем в base64
      const contactDataBase64 = btoa(JSON.stringify(contactData))
      
      // Открываем бота с параметром
      const botUsername = import.meta.env.VITE_CLIENT_BOT_USERNAME || 'mindbeatybot'
      const botLink = `https://t.me/${botUsername}?start=contact_${contactDataBase64}`
      openTelegramLink(botLink)
    } catch (error) {
      console.error('Error contacting partner:', error)
      showAlert(language === 'ru' ? 'Ошибка при открытии переписки. Попробуйте позже.' : 'Error opening conversation. Please try again later.')
    }
  }

  const handleShowLocation = () => {
    if (!selectedService) return

    const mapsLink = selectedService.partner?.google_maps_link
    const city = selectedService.partner?.city
    const district = selectedService.partner?.district
    
    if (mapsLink) {
      window.open(mapsLink, '_blank')
    } else if (city || district) {
      // Fallback to search query if no direct link
      const query = encodeURIComponent(`${selectedService.partner?.company_name || ''} ${city || ''} ${district || ''}`.trim())
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
    } else {
       showAlert(language === 'ru' ? 'Локация не указана' : 'Location not specified')
       return
    }
    hapticFeedback('medium')
  }

  const toggleFavorite = useCallback((partnerId) => {
    hapticFeedback('light')
    setFavoritePartnerIds(prev => {
      const set = new Set(prev)
      if (set.has(partnerId)) {
        set.delete(partnerId)
      } else {
        set.add(partnerId)
      }
      const arr = [...set]
      try { localStorage.setItem(`fav_partners_${chatId}`, JSON.stringify(arr)) } catch {}
      return arr
    })
  }, [chatId])

  const handleRefresh = useCallback(async () => {
    setPullRefreshing(true)
    await loadData()
    setPullRefreshing(false)
  }, [])

  const handleQuickRatingSubmit = async () => {
    const { group } = quickRatingModal
    if (!group || !chatId || quickRatingModal.rating < 1 || quickRatingModal.rating > 10) return
    setQuickRatingSubmitting(true)
    try {
      await upsertNpsRating(chatId, group.partnerId, quickRatingModal.rating, '', group.companyName || '')
      const rated = await getClientRatedPartners(chatId)
      setFavoritePartnerIds(rated || [])
      setQuickRatingModal({ open: false, group: null, rating: 0 })
      hapticFeedback('medium')
    } catch (err) {
      console.error('Quick rating error:', err)
      showAlert(language === 'ru' ? 'Не удалось сохранить оценку' : 'Failed to save rating')
    } finally {
      setQuickRatingSubmitting(false)
    }
  }

  const handlePullRefresh = useCallback(() => {
    if (loading || pullRefreshing) return
    handleRefresh()
  }, [loading, pullRefreshing, handleRefresh])

  if (loading && !pullRefreshing) {
    return (
      <Layout>
        <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4 pt-2">
          <div className="h-7 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }} />
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 h-10 w-24 rounded-full animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }} />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <PartnerCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
    <div className="max-w-screen-sm mx-auto">
      {/* Шапка */}
      <div
        className="sticky top-0 z-20 px-4 pt-2 pb-3"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color) 92%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 12%, transparent)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl transition-all active:scale-90"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">{language === 'ru' ? 'Мои мастера' : 'My Masters'}</h1>
          <div className="relative">
            <button
              onClick={() => {
                hapticFeedback('light')
                setIsCategoryMenuOpen(prev => !prev)
              }}
              className="p-2 pl-3 pr-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
              style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
            >
              <span className="text-sm font-medium">
                {categoryFilter ? (getCategoryByCode(categoryFilter)?.name || (language === 'ru' ? 'Категория' : 'Category')) : (language === 'ru' ? 'Все' : 'All')}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isCategoryMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl shadow-xl overflow-hidden z-30"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)',
                }}
              >
                <button
                  onClick={resetCategoryFilter}
                  className="w-full text-left px-4 py-3 text-sm font-semibold transition-colors active:bg-black/5"
                  style={{
                    backgroundColor: !categoryFilter ? 'color-mix(in srgb, var(--tg-theme-button-color) 12%, transparent)' : 'transparent',
                    color: !categoryFilter ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-text-color)',
                  }}
                >
                  {language === 'ru' ? 'Все виды услуг' : 'All service types'}
                </button>
                {categoryOptions.map(({ code, data }) => (
                  <button
                    key={code}
                    onClick={() => handleCategorySelect(code)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors active:bg-black/5"
                    style={{
                      backgroundColor: categoryFilter === code ? 'color-mix(in srgb, var(--tg-theme-button-color) 12%, transparent)' : 'transparent',
                      color: categoryFilter === code ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-text-color)',
                    }}
                  >
                    <span className="text-lg">{data.emoji || '⭐'}</span>
                    <span className="flex-1 text-left">{data.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <ServicesFilterBar
          filter={filter}
          handleFilterChange={handleFilterChange}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortedGroupsLength={sortedGroups.length}
          language={language}
        />
      </div>

      {/* Список категорий/компаний */}
      {pullRefreshing && (
        <div className="px-4 pt-2 text-center">
          <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{language === 'ru' ? 'Обновление...' : 'Refreshing...'}</span>
        </div>
      )}
      <div
        ref={listContainerRef}
        className="px-4 py-4 space-y-3"
        onTouchStart={(e) => {
          const el = listContainerRef.current
          if (el?.scrollTop === 0) pullStartY.current = e.touches[0]?.clientY ?? 0
        }}
        onTouchEnd={(e) => {
          const el = listContainerRef.current
          if (!el || el.scrollTop !== 0) return
          const endY = e.changedTouches?.[0]?.clientY ?? 0
          if (endY - pullStartY.current > 80) handlePullRefresh()
        }}
        style={{ touchAction: 'pan-y' }}
      >
        {sortedGroups.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <span className="text-5xl leading-none mx-auto mb-3 block">🔍</span>
            <h3 className="text-lg font-bold mb-2">{language === 'ru' ? 'Мастера не найдены' : 'No masters found'}</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {filter === 'search' && searchQuery
                ? (language === 'ru' ? 'Попробуйте изменить поисковый запрос' : 'Try changing your search')
                : (language === 'ru' ? 'Попробуйте изменить фильтры или выбрать другую локацию' : 'Try changing filters or location')}
            </p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <button
                onClick={() => { hapticFeedback('medium'); setFilter('all') }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)',
                }}
              >
                {language === 'ru' ? 'Показать мировой ТОП' : 'Show world TOP'}
              </button>
              <button
                onClick={() => { hapticFeedback('light'); setFilter('none'); setSearchQuery(''); resetCategoryFilter() }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)',
                }}
              >
                {language === 'ru' ? 'Сбросить фильтры' : 'Reset filters'}
              </button>
            </div>
          </div>
        ) : (
          groupedSections.map((section) => (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center gap-2 px-1 pt-3">
                <span className="text-xl">{section.emoji}</span>
                <h2 className="text-sm font-bold tracking-wide uppercase" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {section.title}
                </h2>
              </div>
              <div className="space-y-1.5">
                {section.items.map((group, index) => {
                  const isExpanded = expandedItem === group.id
                  // Ранг внутри секции (каждая категория начинается с #1)
                  const rank = index + 1

                  const isTop3 = rank <= 3
                  let containerStyle = { backgroundColor: 'var(--tg-theme-secondary-bg-color)' }
                  let rankBadgeStyle = { backgroundColor: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-hint-color)' }
                  let cardTextColor = 'var(--tg-theme-text-color)'
                  let cardHintColor = 'var(--tg-theme-hint-color)'
                  if (rank === 1) {
                    containerStyle = { background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }
                    rankBadgeStyle = { backgroundColor: '#f59e0b', color: '#fff' }
                    cardTextColor = '#1c1917'
                    cardHintColor = '#78716c'
                  } else if (rank === 2) {
                    containerStyle = { background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)' }
                    rankBadgeStyle = { backgroundColor: '#0ea5e9', color: '#fff' }
                    cardTextColor = '#0c4a6e'
                    cardHintColor = '#64748b'
                  } else if (rank === 3) {
                    containerStyle = { background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }
                    rankBadgeStyle = { backgroundColor: '#8b5cf6', color: '#fff' }
                    cardTextColor = '#3b0764'
                    cardHintColor = '#7c6f9b'
                  }


                  const photoUrl = group.partner?.photo_url

                  return (
                    <div
                      key={group.id}
                      className="rounded-2xl overflow-hidden"
                      style={containerStyle}
                    >
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={(e) => {
                          if (e.target.closest('button')) {
                            return
                          }
                          handlePlayClick(group.id, e)
                        }}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden" style={{ backgroundColor: isTop3 ? 'rgba(255,255,255,0.45)' : 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}>
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={group.companyName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl">
                                  {group.categoryEmoji || '⭐'}
                                </div>
                              )}
                            </div>
                            <span
                              className="absolute -top-1.5 -left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                              style={rankBadgeStyle}
                            >
                              {rank}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[15px] font-semibold truncate leading-snug" style={{ color: cardTextColor }}>
                              {group.companyName}
                            </h3>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: cardHintColor }}>
                              {group.ratingsCount > 0 ? (
                                <>
                                  <span className="font-bold" style={{ color: isTop3 ? cardTextColor : 'var(--tg-theme-button-color)' }}>
                                    ⭐ {group.rating.toFixed(1)}
                                  </span>
                                  <span style={{ opacity: 0.5 }}>({group.ratingsCount})</span>
                                </>
                              ) : (
                                <span className="italic" style={{ opacity: 0.6 }}>{language === 'ru' ? 'Нет оценок' : 'No ratings'}</span>
                              )}
                              <span style={{ opacity: 0.3 }}>·</span>
                              <span>{group.services.length} {language === 'ru' ? 'усл.' : 'svc'}</span>
                              {group.npsScore !== 0 && (
                                <>
                                  <span style={{ opacity: 0.3 }}>·</span>
                                  <span className="font-semibold" style={{ color: group.npsScore >= 50 ? '#15803d' : group.npsScore > 0 ? '#a16207' : '#b91c1c' }}>
                                    NPS {group.npsScore > 0 ? `+${group.npsScore}` : group.npsScore}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {group.partnerId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(group.partnerId)
                              }}
                              className="p-1.5 rounded-lg"
                              style={favoritePartnerIdsSet.has(group.partnerId)
                                ? { color: '#dc2626' }
                                : { color: cardHintColor }
                              }
                              aria-label={favoritePartnerIdsSet.has(group.partnerId) ? (language === 'ru' ? 'Убрать из Моих' : 'Remove from favorites') : (language === 'ru' ? 'Добавить в Мои' : 'Add to favorites')}
                            >
                              {favoritePartnerIdsSet.has(group.partnerId) ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePlayClick(group.id, e)
                            }}
                            className="p-1.5 rounded-lg"
                            style={{ color: cardHintColor }}
                            aria-label={isExpanded ? (language === 'ru' ? 'Свернуть' : 'Collapse') : (language === 'ru' ? 'Подробнее' : 'Details')}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d={isExpanded ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div
                          className="border-t"
                          style={{
                            borderColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 12%, transparent)',
                            backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 60%, transparent)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                            {group.services.map((service) => (
                              <div
                                key={service.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleServiceClick(service)
                                }}
                                className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors active:scale-[0.98]"
                                style={{
                                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color) 70%, transparent)',
                                  borderColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)',
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--tg-theme-text-color)' }}>
                                    {service.title}
                                  </h4>
                                  {service.description && (
                                    <p className="text-xs line-clamp-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                                      {service.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                  <span className="text-xs">💸</span>
                                  <span className="text-sm font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>
                                    {formatPriceWithPoints(service.price_points, currency, rates, true, language)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <QuickRatingModal
        quickRatingModal={quickRatingModal}
        quickRatingSubmitting={quickRatingSubmitting}
        language={language}
        onClose={() => setQuickRatingModal({ open: false, group: null, rating: 0 })}
        onSubmit={handleQuickRatingSubmit}
        onRatingChange={(n) => setQuickRatingModal(prev => ({ ...prev, rating: n }))}
      />

      {/* Модальное окно выбора локации */}
      <LocationSelector
        isOpen={isLocationSelectorOpen}
        onClose={() => setIsLocationSelectorOpen(false)}
        onSelect={handleLocationSelect}
      />

      <ServiceModal
        isOpen={isServiceModalOpen}
        selectedService={selectedService}
        servicePromotions={servicePromotions}
        balance={balance}
        chatId={chatId}
        qrImage={qrImage}
        qrError={qrError}
        isQrLoading={isQrLoading}
        language={language}
        t={t}
        currency={currency}
        rates={rates}
        formatPriceWithPoints={formatPriceWithPoints}
        serviceModalRef={serviceModalRef}
        onClose={handleCloseServiceModal}
        onGetCashback={handleGetCashback}
        onRedeemViaPromotion={handleRedeemViaPromotion}
        onBookTime={handleBookTime}
        onContactPartner={handleContactPartner}
        onShowLocation={handleShowLocation}
      />

      <EmptyCategoryModal
        isOpen={isEmptyCategoryModalOpen}
        emptyCategoryCode={emptyCategoryCode}
        language={language}
        t={t}
        navigate={navigate}
        onClose={() => setIsEmptyCategoryModalOpen(false)}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} key={toast.key} onClose={hideToast} />}
    </div>
    </Layout>
  )
}

export default Services
