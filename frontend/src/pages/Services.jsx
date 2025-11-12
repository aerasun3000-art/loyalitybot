import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFilteredServices, getClientBalance, getClientRatedPartners } from '../services/supabase'
import { getChatId, hapticFeedback, showAlert } from '../utils/telegram'
import { getCategoryByCode, serviceCategories } from '../utils/serviceIcons'
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
  const getGroupedServices = () => {
    const groupsMap = {}
    
    services.forEach(service => {
      const rawCategoryCode = service.partner?.business_type || service.category || 'other'
      const partnerId = service.partner_chat_id || 'unknown'
      const companyName = service.partner?.company_name || service.partner?.name || 'Неизвестная компания'
      const category = resolveCategory(rawCategoryCode) || {
        code: rawCategoryCode,
        name: 'Услуга',
        emoji: '⭐'
      }
      const canonicalCode = category.code || rawCategoryCode
      const key = `${canonicalCode}_${partnerId}`
      
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
          rating: 4.8 // Заглушка рейтинга
        }
      }
      
      groupsMap[key].services.push(service)
    })
    
    return Object.values(groupsMap).sort(
      (a, b) => getCategorySortValue(a.categoryCode) - getCategorySortValue(b.categoryCode)
    )
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
    services.forEach(service => {
      const rawCode = service.partner?.business_type || service.category
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

  useEffect(() => {
    if (categoryFilter && !categoryOptions.find(option => option.code === categoryFilter)) {
      setCategoryFilter(null)
    }
  }, [categoryFilter, categoryOptions])

  const getFilteredGroups = () => {
    if (!categoryFilter) {
      const categoryMap = new Map()
      const query = debouncedQuery.trim().toLowerCase()

      services.forEach(service => {
        const rawCode = service.partner?.business_type || service.category
        if (!rawCode) return

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

    let groups = getGroupedServices().filter(group => group.categoryCode === categoryFilter)

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

  const handleServiceClick = (service) => {
    hapticFeedback('medium')
    setSelectedService(service)
    setIsServiceModalOpen(true)
    setQrImage('')
    setQrError(null)
  }

  const handleCloseServiceModal = () => {
    hapticFeedback('light')
    setIsServiceModalOpen(false)
    setSelectedService(null)
    setQrImage('')
    setQrError(null)
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

      const payloadParts = [`CLIENT_ID:${chatId}`]
      if (selectedService.id) {
        payloadParts.push(`SERVICE_ID:${selectedService.id}`)
      }
      if (selectedService.partner_chat_id) {
        payloadParts.push(`PARTNER_ID:${selectedService.partner_chat_id}`)
      }

      const qrPayload = payloadParts.join(';')
      const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 })
      setQrImage(dataUrl)
    } catch (error) {
      console.error('Error generating cashback QR:', error)
      setQrError('Не удалось сгенерировать QR-код. Попробуйте позже.')
    } finally {
      setIsQrLoading(false)
    }
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
                        <div className="flex items-center gap-1 text-xs text-sakura-dark/60">
                          <span>⭐</span>
                          <span>{group.rating}</span>
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
                            <span className="text-sm font-bold text-sakura-accent">
                              {service.price_points}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-sakura-deep/50 backdrop-blur-sm" onClick={handleCloseServiceModal} />
          <div className="relative z-10 w-full max-w-md bg-sakura-surface/85 border border-sakura-border/60 rounded-3xl shadow-2xl p-6">
            <button
              onClick={handleCloseServiceModal}
              className="absolute top-4 right-4 w-10 h-10 rounded-full border border-sakura-border/40 bg-sakura-surface/20 text-sakura-dark hover:bg-sakura-surface/30 transition-colors"
              aria-label="Закрыть"
            >
              ×
            </button>
            <div className="space-y-4 text-sakura-dark">
              <div>
                <p className="text-sm text-sakura-dark/60 mb-1 uppercase tracking-wide">Услуга</p>
                <h2 className="text-xl font-bold">{selectedService.title}</h2>
                {selectedService.partner?.company_name && (
                  <p className="text-sm text-sakura-dark/70 mt-1">{selectedService.partner.company_name}</p>
                )}
              </div>
              {selectedService.description && (
                <p className="text-sm text-sakura-dark/80 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                  {selectedService.description}
                </p>
              )}
              <div className="flex items-center gap-3 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">Ориентировочная стоимость</p>
                  <p className="text-lg font-semibold text-sakura-accent">{selectedService.price_points}</p>
                </div>
              </div>

              <div className="bg-sakura-surface/10 border border-sakura-border/30 rounded-2xl p-4 text-sm text-sakura-dark/80 space-y-2">
                <p className="font-semibold text-sakura-dark">Как получить кэшбэк</p>
                <p>1. Нажмите кнопку ниже, чтобы сгенерировать персональный QR-код.</p>
                <p>2. Покажите QR-код администратору салона. Он подтвердит начисление.</p>
                <p>3. После сканирования вы получите уведомление в Telegram.</p>
              </div>

              <button
                onClick={handleGetCashback}
                disabled={isQrLoading}
                className="w-full py-3 rounded-full bg-sakura-accent text-white font-semibold shadow-md hover:bg-sakura-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isQrLoading ? 'Генерируем QR...' : 'Получить кэшбэк в баллах'}
              </button>

              {qrError && (
                <div className="text-sm text-red-500 bg-red-100/60 border border-red-200 rounded-2xl p-3">
                  {qrError}
                </div>
              )}

              {qrImage && (
                <div className="flex flex-col items-center gap-3 bg-white/90 border border-sakura-border/40 rounded-3xl p-4">
                  <img src={qrImage} alt="QR для начисления" className="w-48 h-48 object-contain" />
                  <p className="text-xs text-sakura-dark/70 text-center">
                    Партнёр сканирует QR-код и подтверждает начисление баллов.
                  </p>
                </div>
              )}
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
