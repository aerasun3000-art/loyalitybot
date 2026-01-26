import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFilteredServices, getClientBalance, getClientRatedPartners, getPartnersMetrics, getReferralPartnerInfo, getPromotionsForService } from '../services/supabase'
import { getChatId, hapticFeedback, showAlert } from '../utils/telegram'
import { getCategoryByCode, serviceCategories } from '../utils/serviceIcons'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import useCurrencyStore from '../store/currencyStore'
import { formatPriceWithPoints, fetchExchangeRates } from '../utils/currency'
import { supabase } from '../services/supabase'
import Loader from '../components/Loader'
import LocationSelector from '../components/LocationSelector'
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
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const { currency, rates, setRates } = useCurrencyStore()
  
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [balance, setBalance] = useState(0)
  const [filter, setFilter] = useState('none') // none, all, my_district, favorites, search
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
  const [favoritePartnerIds, setFavoritePartnerIds] = useState([])
  const [categoryFilter, setCategoryFilter] = useState(categoryParam || null)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)
  const [partnersMetrics, setPartnersMetrics] = useState({})
  const [referralPartnerInfo, setReferralPartnerInfo] = useState(null)
  const [servicePromotions, setServicePromotions] = useState({}) // serviceId -> promotions[]
  const [isEmptyCategoryModalOpen, setIsEmptyCategoryModalOpen] = useState(false)
  const [emptyCategoryCode, setEmptyCategoryCode] = useState(null)

  const resolveCategory = useCallback((code) => {
    if (!code) return null
    return getCategoryByCode(code) || serviceCategories[code] || null
  }, [])

  const normalizeCategoryCode = useCallback((code) => {
    if (!code) return null
    const categoryData = resolveCategory(code)
    return categoryData?.code || code
  }, [resolveCategory])

  const getCategorySortValue = useCallback((code) => {
    const canonical = normalizeCategoryCode(code)
    if (!canonical) return 500
    if (Object.prototype.hasOwnProperty.call(CATEGORY_PRIORITY, canonical)) {
      return CATEGORY_PRIORITY[canonical]
    }
    const categoryData = resolveCategory(canonical)
    return categoryData?.displayOrder ?? 500
  }, [normalizeCategoryCode, resolveCategory])

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
    const normalizedParam = normalizeCategoryCode(categoryParam)
    if (normalizedParam && normalizedParam !== categoryFilter) {
      setCategoryFilter(normalizedParam)
    } else if (!categoryParam && categoryFilter) {
      setCategoryFilter(null)
    }
  }, [categoryParam, categoryFilter, normalizeCategoryCode])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Получаем информацию о партнере, который добавил клиента через приветственный бонус
      const partnerInfo = await getReferralPartnerInfo(chatId)
      setReferralPartnerInfo(partnerInfo)
      
      const [servicesData, balanceData, ratedPartners] = await Promise.all([
        getFilteredServices(cityParam || null, null),
        getClientBalance(chatId),
        getClientRatedPartners(chatId)
      ])
      setServices(servicesData)
      setBalance(balanceData?.balance || 0)
      setSelectedCity(cityParam || '')
      setSelectedDistrict(districtParam || '')
      setFavoritePartnerIds(ratedPartners || [])

      // Загружаем метрики партнёров
      const partnerIds = [...new Set(servicesData.map(s => s.partner_chat_id).filter(Boolean))]
      if (partnerIds.length > 0) {
        const metrics = await getPartnersMetrics(partnerIds)
        setPartnersMetrics(metrics)
      }
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelect = (location) => {
    const params = new URLSearchParams()
    if (location.city) params.set('city', location.city)
    if (location.district) params.set('district', location.district)
    if (categoryFilter) params.set('category', categoryFilter)
    setSearchParams(params)
    setSelectedCity(location.city || '')
    setSelectedDistrict(location.district || '')
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
    
    // Сортируем: сначала по категории, потом по метрикам (NPS, затем средняя оценка)
    return Object.values(groupsMap).sort((a, b) => {
      const categoryDiff = getCategorySortValue(a.categoryCode) - getCategorySortValue(b.categoryCode)
      if (categoryDiff !== 0) return categoryDiff
      
      // В рамках одной категории сортируем по метрикам (лучшие партнёры выше)
      // 1. По NPS (выше = лучше)
      const npsDiff = (b.npsScore || 0) - (a.npsScore || 0)
      if (npsDiff !== 0) return npsDiff
      
      // 2. По средней оценке (выше = лучше)
      const ratingDiff = (b.rating || 0) - (a.rating || 0)
      if (ratingDiff !== 0) return ratingDiff
      
      // 3. По количеству отзывов (больше = лучше, так как больше доверия)
      return (b.ratingsCount || 0) - (a.ratingsCount || 0)
    })
  }

  const favoritePartnerIdsSet = useMemo(() => new Set(favoritePartnerIds), [favoritePartnerIds])

  const doesServiceMatchCurrentFilter = (service) => {
    const partner = service.partner
    const partnerId = service.partner_chat_id
    const mockGroup = { partner, partnerId }

    if (filter === 'my_district') {
      return matchesDistrict(mockGroup)
    }

    if (filter === 'favorites') {
      if (!partnerId || !favoritePartnerIdsSet.has(partnerId)) {
        return false
      }
      return matchesCity(mockGroup)
    }

    if (filter === 'all') {
      return isOnlinePartner(partner)
    }

    return matchesCity(mockGroup)
  }

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
    hapticFeedback('light')
    setCategoryFilter(code)
    setExpandedItem(null)
    setIsCategoryMenuOpen(false)
    const params = new URLSearchParams(searchParams)
    params.set('category', code)
    setSearchParams(params)
    
    // Проверяем наличие партнеров в категории
    const normalizedCode = normalizeCategoryCode(code)
    console.log('[handleCategorySelect] Checking category:', code, 'normalized:', normalizedCode)
    console.log('[handleCategorySelect] Services count:', services.length)
    
    const hasPartnersInCategory = services.some(service => {
      // Скрываем конкурентов
      if (isCompetitor(service)) {
        return false
      }
      
      // Проверяем соответствие категории
      const rawCode = service.partner?.business_type || service.category
      if (!rawCode) return false
      const serviceCategoryCode = normalizeCategoryCode(rawCode)
      const matches = serviceCategoryCode === normalizedCode
      if (matches) {
        console.log('[handleCategorySelect] Found matching service:', {
          serviceTitle: service.title,
          rawCode,
          serviceCategoryCode,
          normalizedCode
        })
      }
      return matches
    })
    
    console.log('[handleCategorySelect] Has partners in category:', hasPartnersInCategory, 'for category:', code)
    
    // Если нет партнеров, показываем модальное окно после небольшой задержки
    if (!hasPartnersInCategory) {
      console.log('[handleCategorySelect] No partners found, showing modal for category:', code)
      setTimeout(() => {
        setEmptyCategoryCode(code)
        setIsEmptyCategoryModalOpen(true)
        console.log('[handleCategorySelect] Modal state set - code:', code, 'modal open:', true)
      }, 200)
    } else {
      console.log('[handleCategorySelect] Partners found, modal not needed for category:', code)
    }
  }

  const resetCategoryFilter = () => {
    hapticFeedback('light')
    setCategoryFilter(null)
    setExpandedItem(null)
    setFilter('none')
    setIsCategoryMenuOpen(false)
    const params = new URLSearchParams(searchParams)
    params.delete('category')
    setSearchParams(params)
  }

  const isOnlinePartner = (partner) => {
    if (!partner) return false
    // Используем новое поле work_mode, если оно есть
    const workMode = partner.work_mode || partner.workMode
    if (workMode === 'online' || workMode === 'hybrid') {
      return true
    }
    // Обратная совместимость: проверяем старую логику с городом
    const city = partner?.city?.trim()
    if (!city) return true
    return city.toLowerCase() === 'все'
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

  // Функция для проверки, является ли партнер конкурентом
  const isCompetitor = useCallback((service) => {
    // Если у клиента нет партнера, который его добавил, не скрываем никого
    if (!referralPartnerInfo) {
      return false
    }

    const servicePartnerId = service.partner_chat_id || service.partnerId
    const serviceCategory = service.partner?.business_type || service.category || service.categoryCode
    
    // Если это сам партнер, который добавил клиента - НЕ конкурент (показываем)
    if (servicePartnerId === referralPartnerInfo.chatId) {
      return false
    }

    if (!serviceCategory || !referralPartnerInfo.businessType) {
      return false
    }

    // Нормализуем категории для сравнения
    const referralCategory = normalizeCategoryCode(referralPartnerInfo.businessType)
    const serviceCategoryNormalized = normalizeCategoryCode(serviceCategory)

    // Если категории совпадают - это конкурент (скрываем)
    return referralCategory === serviceCategoryNormalized
  }, [referralPartnerInfo, normalizeCategoryCode])

  useEffect(() => {
    if (categoryFilter && !categoryOptions.find(option => option.code === categoryFilter)) {
      setCategoryFilter(null)
    }
  }, [categoryFilter, categoryOptions])

  // Проверяем наличие партнеров в категории после загрузки данных и изменения фильтров
  useEffect(() => {
    if (!categoryFilter || loading || services.length === 0) {
      console.log('[useEffect check] Skipping check:', {
        categoryFilter,
        loading,
        servicesLength: services.length,
        reason: !categoryFilter ? 'no category' : loading ? 'still loading' : 'no services'
      })
      return
    }
    
    // Не показываем модальное окно, если оно уже открыто
    if (isEmptyCategoryModalOpen) {
      console.log('[useEffect check] Modal already open, skipping')
      return
    }
    
    console.log('[useEffect check] Starting check for category:', categoryFilter, 'Services:', services.length)
    
    // Небольшая задержка, чтобы дать время на обновление всех состояний
    const checkTimer = setTimeout(() => {
      const normalizedCode = normalizeCategoryCode(categoryFilter)
      console.log('[useEffect check] Normalized code:', normalizedCode)
      
      const hasPartnersInCategory = services.some(service => {
        // Скрываем конкурентов
        if (isCompetitor(service)) {
          return false
        }
        
        // Проверяем соответствие категории
        const rawCode = service.partner?.business_type || service.category
        if (!rawCode) return false
        const serviceCategoryCode = normalizeCategoryCode(rawCode)
        const matches = serviceCategoryCode === normalizedCode
        if (matches) {
          console.log('[useEffect check] Found matching service:', {
            serviceTitle: service.title,
            rawCode,
            serviceCategoryCode,
            normalizedCode
          })
        }
        return matches
      })
      
      console.log('[useEffect check] Has partners in category:', hasPartnersInCategory)
      
      // Если нет партнеров в категории, показываем модальное окно
      if (!hasPartnersInCategory) {
        console.log('[useEffect check] No partners found, showing modal for category:', categoryFilter)
        setEmptyCategoryCode(categoryFilter)
        setIsEmptyCategoryModalOpen(true)
      } else {
        console.log('[useEffect check] Partners found, modal not needed')
      }
    }, 500)
    
    return () => clearTimeout(checkTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, services.length, loading, isEmptyCategoryModalOpen])

  const getFilteredGroups = () => {
    if (!categoryFilter) {
      const categoryMap = new Map()
      const query = debouncedQuery.trim().toLowerCase()

      services.forEach(service => {
        const rawCode = service.partner?.business_type || service.category
        if (!rawCode) return

        // Скрываем конкурентов (партнеров с той же категорией услуг, что и партнер, который добавил клиента)
        // НО показываем услуги самого партнера, который добавил клиента
        if (isCompetitor(service)) {
          return
        }

        if (!doesServiceMatchCurrentFilter(service)) {
          return
        }

        const canonicalCode = normalizeCategoryCode(rawCode)
        if (!canonicalCode) return
        const categoryData = resolveCategory(canonicalCode)
        if (!categoryData) return

        if (filter === 'search' && query) {
          const categoryNameRu = (categoryData.name || '').toLowerCase()
          const categoryNameEn = (categoryData.nameEn || '').toLowerCase()
          const serviceTitle = (service.title || '').toLowerCase()
          if (!categoryNameRu.includes(query) && !categoryNameEn.includes(query) && !serviceTitle.includes(query)) {
            return
          }
        }

        if (!categoryMap.has(canonicalCode)) {
          categoryMap.set(canonicalCode, {
            id: canonicalCode,
            categoryCode: canonicalCode,
            categoryName: categoryData.name,
            categoryEmoji: categoryData.emoji || '⭐',
            displayOrder: categoryData.displayOrder || 999,
            isCategoryOnly: true
          })
        }
      })

      return Array.from(categoryMap.values()).sort(
        (a, b) => getCategorySortValue(a.categoryCode) - getCategorySortValue(b.categoryCode)
      )
    }

    let groups = getGroupedServices()
      .filter(group => group.categoryCode === categoryFilter)
      // Скрываем конкурентов (партнеров с той же категорией услуг)
      // НО показываем услуги самого партнера, который добавил клиента
      .filter(group => !isCompetitor({ partner: group.partner, partner_chat_id: group.partnerId, category: group.categoryCode }))

    if (filter === 'my_district') {
      groups = groups.filter(matchesDistrict)
    } else if (filter === 'favorites') {
      groups = groups
        .filter(group => favoritePartnerIdsSet.has(group.partnerId))
        .filter(matchesCity)
    } else if (filter === 'all') {
      groups = groups.filter(group => isOnlinePartner(group.partner))
    } else {
      groups = groups.filter(matchesCity)
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

  const handleFilterChange = (newFilter) => {
    hapticFeedback('light')

    if (newFilter === 'all' && !categoryFilter) {
      setIsCategoryMenuOpen(true)
      return
    }

    const nextFilter = filter === newFilter ? 'none' : newFilter

    if (nextFilter !== 'search') {
      setSearchQuery('')
    }

    if (nextFilter === 'my_district' && !selectedDistrict) {
      setIsLocationSelectorOpen(true)
    }

    if (nextFilter === 'none') {
      setExpandedItem(null)
    }

    setFilter(nextFilter)
  }

  const handlePlayClick = (groupId, e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation()
    }
    hapticFeedback('light')
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
      showAlert('Ссылка на бронирование не указана для этой услуги.')
      return
    }

    // Открываем ссылку в новой вкладке
    window.open(bookingUrl, '_blank')
    hapticFeedback('medium')
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

  if (loading) {
    return <Loader />
  }

  const filteredGroups = getFilteredGroups()

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 text-sakura-dark">
      <div className="absolute inset-0 -z-20">
        <img
          src="/bg/sakura.jpg"
          alt="Sakura background"
          className="w-full h-full object-cover opacity-85"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />

      {/* Шапка */}
      <div className="sticky top-0 z-20 px-4 pt-6 pb-4 bg-sakura-surface/15 backdrop-blur-xl border-b border-sakura-border/40">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-full border border-sakura-border/40 bg-sakura-surface/10 text-sakura-dark/80 hover:border-sakura-accent transition-colors"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold drop-shadow-sm adaptive-text">Мои мастера</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => {
                hapticFeedback('light')
                setIsCategoryMenuOpen(prev => !prev)
              }}
              className="p-2 pl-4 pr-3 rounded-full border border-sakura-border/40 bg-sakura-surface/10 text-sakura-dark/80 hover:border-sakura-accent transition-colors flex items-center gap-2"
            >
              <span className="text-sm font-semibold">
                {categoryFilter ? (getCategoryByCode(categoryFilter)?.name || 'Категория') : 'Все виды'}
              </span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {isCategoryMenuOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-sakura-surface border border-sakura-border/40 rounded-2xl shadow-xl overflow-hidden z-30">
                <button
                  onClick={resetCategoryFilter}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                    !categoryFilter ? 'bg-sakura-accent/20 text-sakura-dark' : 'text-sakura-dark/80 hover:bg-sakura-surface/10'
                  }`}
                >
                  Все виды услуг
                </button>
                {categoryOptions.map(({ code, data }) => (
                  <button
                    key={code}
                    onClick={() => handleCategorySelect(code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      categoryFilter === code
                        ? 'bg-sakura-accent/30 text-white'
                        : 'text-sakura-dark/80 hover:bg-sakura-surface/10'
                    }`}
                  >
                    <span className="text-lg">{data.emoji || '⭐'}</span>
                    <span className="flex-1 text-left">{data.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
              filter === 'all'
                ? 'bg-sakura-accent text-white'
                : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
            }`}
          >
            Все районы
          </button>
          <button
            onClick={() => handleFilterChange('my_district')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
              filter === 'my_district'
                ? 'bg-sakura-accent text-white'
                : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
            }`}
          >
            Мой район
          </button>
          <button
            onClick={() => handleFilterChange('favorites')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
              filter === 'favorites'
                ? 'bg-sakura-accent text-white'
                : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
            }`}
          >
            Любимые
          </button>
          <button
            onClick={() => handleFilterChange('search')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
              filter === 'search'
                ? 'bg-sakura-accent text-white'
                : 'bg-sakura-surface/40 text-sakura-dark border border-sakura-border/50'
            }`}
          >
            Поиск по услуге
          </button>
        </div>

        {/* Поле поиска (показывается только при выборе фильтра "Поиск по услуге") */}
        {filter === 'search' && (
          <div className="mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите название услуги..."
              className="w-full px-4 py-2 rounded-lg bg-sakura-surface/20 text-sakura-dark border border-sakura-border/40 placeholder-sakura-dark/60 outline-none focus:border-sakura-accent"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Список категорий/компаний */}
      <div className="relative z-10 px-4 py-6 space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="bg-sakura-surface/10 backdrop-blur-xl rounded-3xl p-8 text-center border border-sakura-border/40 shadow-xl">
            <span className="text-6xl leading-none mx-auto mb-4 block">🌸</span>
            <h3 className="text-xl font-bold mb-2">Мастера не найдены</h3>
            <p className="text-sm text-sakura-dark/80">
              {filter === 'search' && searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Попробуйте изменить фильтры или выбрать другую локацию'}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = !group.isCategoryOnly && expandedItem === group.id
            
            return (
              <div
                key={group.id}
                className="bg-sakura-surface/5 backdrop-blur-lg rounded-2xl border border-sakura-border/40 shadow-lg overflow-hidden"
              >
                {/* Основная строка */}
                <div 
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-sakura-surface/10 transition-colors"
                  onClick={(e) => {
                    if (group.isCategoryOnly) {
                      handleCategorySelect(group.categoryCode)
                      return
                    }
                    // Не раскрываем, если клик был на кнопке play (она обработает сама)
                    if (e.target.closest('button')) {
                      return
                    }
                    handlePlayClick(group.id, e)
                  }}
                >
                  {/* Иконка категории */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-sakura-surface/10 flex items-center justify-center border border-sakura-border/40">
                    <span className="text-3xl leading-none">{group.categoryEmoji}</span>
                  </div>

                  {/* Текстовая информация */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-sakura-dark mb-1 adaptive-text">
                      {group.categoryName}
                    </h3>
                    {!group.isCategoryOnly && (
                      <>
                        <p className="text-sm text-sakura-dark/70 mb-1 adaptive-subtext">
                          {group.companyName}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-sakura-dark/60">
                          {/* Средняя оценка */}
                          {group.ratingsCount > 0 && (
                            <div className="flex items-center gap-1">
                              <span>⭐</span>
                              <span className="font-semibold">{group.rating.toFixed(1)}</span>
                              <span className="text-sakura-dark/50">({group.ratingsCount})</span>
                            </div>
                          )}
                          {/* NPS Score */}
                          {group.ratingsCount > 0 && group.npsScore !== 0 && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                              group.npsScore >= 50 ? 'bg-green-100/80 text-green-700' :
                              group.npsScore >= 0 ? 'bg-yellow-100/80 text-yellow-700' :
                              'bg-red-100/80 text-red-700'
                            }`}>
                              <span className="font-semibold">NPS</span>
                              <span className="font-bold">{group.npsScore > 0 ? '+' : ''}{group.npsScore}</span>
                            </div>
                          )}
                          {/* Если нет отзывов */}
                          {group.ratingsCount === 0 && (
                            <span className="text-sakura-dark/40 italic">Нет отзывов</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Кнопка play */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (group.isCategoryOnly) {
                        handleCategorySelect(group.categoryCode)
                        return
                      }
                      handlePlayClick(group.id, e)
                    }}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-sakura-surface/50 border border-sakura-border/60 flex items-center justify-center text-sakura-dark hover:bg-sakura-surface/60 transition-colors"
                  >
                    {group.isCategoryOnly ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    ) : isExpanded ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Раскрывающееся меню со списком услуг */}
                {!group.isCategoryOnly && isExpanded && (
                  <div 
                    className="border-t border-sakura-border/40 bg-sakura-surface/10"
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
                          className="flex items-center justify-between p-3 rounded-lg bg-sakura-surface/5 border border-sakura-border/20 hover:bg-sakura-surface/10 cursor-pointer transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-sakura-dark mb-1">
                              {service.title}
                            </h4>
                            {service.description && (
                              <p className="text-xs text-sakura-dark/60 line-clamp-1">
                                {service.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className="text-xs text-sakura-dark/80">💸</span>
                            <span className="text-sm font-bold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
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
          })
        )}
      </div>

      {/* Модальное окно выбора локации */}
      <LocationSelector
        isOpen={isLocationSelectorOpen}
        onClose={() => setIsLocationSelectorOpen(false)}
        onSelect={handleLocationSelect}
      />

      {isServiceModalOpen && selectedService && (
        <div className="fixed inset-0 z-[100]" onClick={handleCloseServiceModal}>
          <div className="absolute inset-0 bg-sakura-deep/50 backdrop-blur-sm" />
          <div 
            className="relative h-full flex items-center justify-center px-4 py-4"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: '80px', maxHeight: '100vh', overflow: 'hidden' }}
          >
            <div 
              className="relative z-10 w-full max-w-md bg-sakura-surface/85 border border-sakura-border/60 rounded-3xl shadow-2xl p-6 max-h-[calc(100vh-8rem)] overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 8rem)', WebkitOverflowScrolling: 'touch' }}
            >
            <button
              onClick={handleCloseServiceModal}
              className="absolute top-4 right-4 w-10 h-10 rounded-full border border-sakura-border/40 bg-sakura-surface/20 text-sakura-dark hover:bg-sakura-surface/30 transition-colors z-20"
              aria-label="Закрыть"
            >
              ×
            </button>
            <div className="space-y-4 text-sakura-dark pb-8">
              <div>
                <p className="text-sm text-sakura-dark/60 mb-1 uppercase tracking-wide">Услуга</p>
                <h2 className="text-xl font-bold">{selectedService.title}</h2>
                <p className="text-sm text-sakura-dark/70 mt-1">
                  {selectedService.partner?.company_name || selectedService.partner?.name || t('partner_not_connected')}
                </p>
              </div>
              {selectedService.description && (
                <p className="text-sm text-sakura-dark/80 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                  {selectedService.description}
                </p>
              )}
              <div className="flex items-center gap-3 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                <span className="text-2xl">💸</span>
                <div className="flex-1">
                  <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">
                    {language === 'ru' ? 'Стоимость' : 'Cost'}
                  </p>
                  <p className="text-lg font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                    {formatPriceWithPoints(selectedService.price_points, currency, rates, true, language)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">
                    {language === 'ru' ? 'Ваш баланс' : 'Your balance'}
                  </p>
                  <p className={`text-lg font-semibold ${
                    balance >= selectedService.price_points ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {formatPriceWithPoints(balance, currency, rates, false, language)}
                  </p>
                </div>
              </div>


              <div className="space-y-3">
                {/* Кнопка обмена по акции (показывается только если есть активная акция) */}
                {(() => {
                  const promotions = servicePromotions[selectedService.id] || []
                  const redemptionPromotion = promotions.find(p => 
                    p.promotion_type === 'points_redemption' && 
                    p.max_points_payment && 
                    p.max_points_payment > 0
                  )
                  
                  if (redemptionPromotion) {
                    return (
                      <button
                        onClick={handleRedeemViaPromotion}
                        className="w-full py-3 rounded-full bg-gradient-to-r from-sakura-mid to-sakura-dark text-white font-semibold shadow-md hover:shadow-lg transition-all"
                      >
                        {language === 'ru' 
                          ? `🎁 Обменять по акции: ${redemptionPromotion.title}`
                          : `🎁 Redeem via promotion: ${redemptionPromotion.title}`}
                      </button>
                    )
                  }
                  return null
                })()}

                <button
                  onClick={handleGetCashback}
                  disabled={isQrLoading}
                  className="w-full py-3 rounded-full bg-sakura-accent text-white font-semibold shadow-md hover:bg-sakura-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isQrLoading ? 'Генерируем QR...' : (language === 'ru' ? 'Получить кэшбэк в баллах' : 'Get cashback points')}
                </button>

                <button
                  onClick={handleShowLocation}
                  className="w-full py-3 rounded-full bg-white text-sakura-dark font-semibold shadow-md border border-sakura-border hover:bg-sakura-surface transition-colors"
                >
                  {language === 'ru' ? '📍 Показать на карте' : '📍 Show on Map'}
                </button>

                <button
                  onClick={handleBookTime}
                  disabled={!selectedService.booking_url && !selectedService.partner?.booking_url}
                  className="w-full py-3 rounded-full bg-sakura-deep text-white font-semibold shadow-md hover:bg-sakura-deep/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {language === 'ru' ? 'Забронировать время' : 'Book time'}
                </button>
              </div>

              {qrError && (
                <div className="text-sm text-red-500 bg-red-100/60 border border-red-200 rounded-2xl p-3">
                  {qrError}
                </div>
              )}

              {qrImage && (
                <div className="flex flex-col items-center gap-3 bg-white/90 border border-sakura-border/40 rounded-3xl p-4 mb-8 pb-8">
                  <img src={qrImage} alt="QR для начисления" className="w-48 h-48 object-contain" />
                  <p className="text-xs text-sakura-dark/70 text-center px-2">
                    Партнёр сканирует QR-код и подтверждает начисление баллов.
                  </p>
                  {chatId && (
                    <p className="text-xs text-sakura-dark/50 text-center px-2 font-mono">
                      ID: {chatId}
                    </p>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно "Место свободно" */}
      {isEmptyCategoryModalOpen && emptyCategoryCode && (
        <div 
          className="fixed inset-0 z-[100]" 
          onClick={() => {
            console.log('[Modal] Closing modal')
            setIsEmptyCategoryModalOpen(false)
          }}
          style={{ zIndex: 1000 }}
        >
          <div className="absolute inset-0 bg-sakura-deep/50 backdrop-blur-sm" />
          <div 
            className="relative h-full flex items-center justify-center px-4 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10 w-full max-w-md bg-sakura-surface/95 border border-sakura-border/60 rounded-3xl shadow-2xl p-6">
              <button
                onClick={() => {
                  console.log('[Modal] Close button clicked')
                  setIsEmptyCategoryModalOpen(false)
                }}
                className="absolute top-4 right-4 w-10 h-10 rounded-full border border-sakura-border/40 bg-sakura-surface/20 text-sakura-dark hover:bg-sakura-surface/30 transition-colors z-20"
                aria-label="Закрыть"
              >
                ×
              </button>
              <div className="space-y-4 text-sakura-dark text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold mb-2">
                  {language === 'ru' ? 'Место свободно!' : 'Spot Available!'}
                </h2>
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-gray-500">Category: {emptyCategoryCode}</p>
                )}
                <p className="text-sakura-dark/80 mb-6">
                  {language === 'ru' 
                    ? 'В этой категории пока нет партнеров. Станьте первым и получите преимущество!'
                    : 'There are no partners in this category yet. Be the first and get an advantage!'}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      hapticFeedback('medium')
                      navigate('/partner/apply')
                      setIsEmptyCategoryModalOpen(false)
                    }}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-sakura-mid to-sakura-dark text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    {language === 'ru' ? '🤝 Стать партнером' : '🤝 Become a Partner'}
                  </button>
                  <button
                    onClick={() => {
                      hapticFeedback('light')
                      setIsEmptyCategoryModalOpen(false)
                    }}
                    className="w-full py-3 rounded-full bg-white text-sakura-dark font-semibold shadow-md border border-sakura-border hover:bg-sakura-surface transition-colors"
                  >
                    {language === 'ru' ? 'Закрыть' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Скрыть скроллбар и адаптивный цвет текста */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        /* Адаптивный цвет текста относительно подложки */
        .adaptive-text {
          color: #ffffff;
          mix-blend-mode: difference;
        }
        .adaptive-subtext {
          color: rgba(255,255,255,0.8);
          mix-blend-mode: difference;
        }
      `}</style>
    </div>
  )
}

export default Services
