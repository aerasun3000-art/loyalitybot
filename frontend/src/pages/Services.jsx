import { useState, useEffect } from 'react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFilteredServices, getClientBalance } from '../services/supabase'
import { getChatId, hapticFeedback, showConfirm } from '../utils/telegram'
import { getServiceIcon, serviceCategories } from '../utils/serviceIcons'
import Loader from '../components/Loader'
import LocationSelector from '../components/LocationSelector'

const Services = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightId = searchParams.get('id')
  const cityParam = searchParams.get('city')
  const districtParam = searchParams.get('district')
  const chatId = getChatId()
  
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [balance, setBalance] = useState(0)
  const [filter, setFilter] = useState('all') // all, affordable, expensive
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortBy, setSortBy] = useState('relevance') // relevance, price_asc, price_desc, newest
  const [selectedService, setSelectedService] = useState(null)
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState(cityParam || '')
  const [selectedDistrict, setSelectedDistrict] = useState(districtParam || '')

  useEffect(() => {
    loadData()
  }, [chatId, cityParam, districtParam])

  // debounce поискового запроса
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(id)
  }, [searchQuery])

  const loadData = async () => {
    try {
      setLoading(true)
      const [servicesData, balanceData] = await Promise.all([
        getFilteredServices(cityParam || null, districtParam || null),
        getClientBalance(chatId)
      ])
      setServices(servicesData)
      setBalance(balanceData?.balance || 0)
      setSelectedCity(cityParam || '')
      setSelectedDistrict(districtParam || '')
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelect = (location) => {
    // Обновляем URL параметры
    const params = new URLSearchParams()
    if (location.city) params.set('city', location.city)
    if (location.district) params.set('district', location.district)
    if (highlightId) params.set('id', highlightId)
    
    setSearchParams(params)
    setSelectedCity(location.city || '')
    setSelectedDistrict(location.district || '')
    
    // Перезагружаем данные
    loadData()
  }

  const handleOpenLocationSelector = () => {
    hapticFeedback('light')
    setIsLocationSelectorOpen(true)
  }

  const getFilteredServices = () => {
    // 1) базовая выборка по фильтру доступности
    let result = (() => {
      switch (filter) {
        case 'affordable':
          return services.filter(s => s.price_points <= balance)
        case 'expensive':
          return services.filter(s => s.price_points > balance)
        default:
          return services
      }
    })()

    // 2) поиск по названию услуги и имени партнёра
    const q = debouncedQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(s => {
        const title = (s.title || '').toLowerCase()
        const partnerName = (s.partner?.company_name || s.partner?.name || '').toLowerCase()
        return title.includes(q) || partnerName.includes(q)
      })
    }

    // 3) сортировка
    if (sortBy === 'price_asc') {
      result = [...result].sort((a, b) => (a.price_points || 0) - (b.price_points || 0))
    } else if (sortBy === 'price_desc') {
      result = [...result].sort((a, b) => (b.price_points || 0) - (a.price_points || 0))
    } else if (sortBy === 'newest') {
      result = [...result].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }

    return result
  }

  const handleFilterChange = (newFilter) => {
    hapticFeedback('light')
    setFilter(newFilter)
  }

  const handleSortChange = (newSort) => {
    hapticFeedback('light')
    setSortBy(newSort)
  }

  const handleServiceClick = (service) => {
    hapticFeedback('medium')
    setSelectedService(service)
  }

  const handleExchange = () => {
    if (!selectedService) return
    
    if (balance < selectedService.price_points) {
      showConfirm(
        `У вас недостаточно баллов. Нужно ${selectedService.price_points}, а у вас ${balance}.`,
        () => {}
      )
      return
    }

    showConfirm(
      `Обменять ${selectedService.price_points} баллов на "${selectedService.title}"?`,
      (confirmed) => {
        if (confirmed) {
          // TODO: Реализовать обмен через API
          hapticFeedback('success')
          console.log('Exchange confirmed:', selectedService)
        }
      }
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-r from-jewelry-brown-dark to-jewelry-burgundy px-4 pt-6 pb-8">
          <div className="flex items-center mb-6">
            <div className="w-6 h-6 bg-white/50 rounded animate-pulse mr-3" />
            <div className="h-8 bg-white/50 rounded w-32 animate-pulse" />
          </div>
          <div className="h-4 bg-white/30 rounded w-48 animate-pulse" />
        </div>

        <div className="px-4 -mt-4 pb-20">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="w-16 h-16 bg-jewelry-cream rounded-xl mx-auto mb-3 border border-jewelry-gold/20" />
                <div className="h-4 bg-jewelry-cream rounded w-3/4 mx-auto mb-2 border border-jewelry-gold/20" />
                <div className="h-3 bg-jewelry-cream/50 rounded w-1/2 mx-auto border border-jewelry-gold/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const filteredServices = getFilteredServices()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-jewelry-brown-dark to-jewelry-burgundy px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="text-white mr-3"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-white">Услуги</h1>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full">
            <span className="text-white font-bold">{balance} баллов</span>
          </div>
        </div>

        {/* Выбранная локация */}
        {(selectedCity || selectedDistrict) && (
          <div className="mb-4 flex items-center justify-between bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-white text-sm">
              📍 {selectedCity}{selectedDistrict ? `, ${selectedDistrict}` : ''}
            </span>
            <button
              onClick={handleOpenLocationSelector}
              className="text-white text-xs underline ml-2"
            >
              Изменить
            </button>
          </div>
        )}

        {/* Фильтры */}
        <div className="flex flex-col gap-3">
          {/* Строка поиска + сортировка */}
          <div className="flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск услуг..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/80 outline-none border border-white/20"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/20 text-white outline-none border border-white/20"
            >
              <option value="relevance">По релевантности</option>
              <option value="newest">Сначала новые</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {/* Кнопка выбора локации */}
          {!selectedCity && !selectedDistrict && (
            <button
              onClick={handleOpenLocationSelector}
              className="px-4 py-2 rounded-lg font-semibold whitespace-nowrap bg-jewelry-cream text-jewelry-gold flex items-center gap-2 border border-jewelry-gold/20 transition-transform active:scale-95"
            >
              📍 Выбрать город
            </button>
          )}
          
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-transform active:scale-95 ${
              filter === 'all'
                ? 'bg-jewelry-cream text-jewelry-gold'
                : 'bg-white/20 text-white'
            }`}
          >
            Все ({services.length})
          </button>
          <button
            onClick={() => handleFilterChange('affordable')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-transform active:scale-95 ${
              filter === 'affordable'
                ? 'bg-jewelry-cream text-jewelry-gold'
                : 'bg-white/20 text-white'
            }`}
          >
            Доступные
          </button>
          <button
            onClick={() => handleFilterChange('expensive')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-transform active:scale-95 ${
              filter === 'expensive'
                ? 'bg-jewelry-cream text-jewelry-gold'
                : 'bg-white/20 text-white'
            }`}
          >
            Копим
          </button>
          </div>
        </div>
      </div>

      {/* Список услуг */}
      <div className="px-4 -mt-4 pb-20">
        {filteredServices.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-gray-600 mb-3">
              {searchQuery
                ? 'Ничего не найдено по вашему запросу.'
                : filter === 'affordable'
                  ? 'Нет доступных услуг. Копите баллы!'
                  : 'Услуги не найдены'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {(selectedCity || selectedDistrict) && (
                <button
                  onClick={() => handleOpenLocationSelector()}
                  className="px-4 py-2 rounded-lg font-semibold bg-jewelry-gold text-jewelry-cream hover:bg-jewelry-gold-dark transition-colors"
                >
                  📍 Изменить локацию
                </button>
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-lg font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                >
                  Очистить поиск
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredServices.map((service, index) => {
              const isAffordable = balance >= service.price_points
              const isHighlighted = service.id === highlightId
              
              return (
                <div
                  key={service.id}
                  onClick={() => handleServiceClick(service)}
                  className={`bg-jewelry-cream rounded-xl overflow-hidden shadow-lg border border-jewelry-gold/20 cursor-pointer transition-all active:scale-98 hover:shadow-xl ${
                    isHighlighted ? 'ring-2 ring-jewelry-gold' : ''
                  } ${!isAffordable ? 'opacity-60' : ''}`}
                >
                  {/* Иконка */}
                  <div className="h-32 bg-gradient-to-br from-jewelry-cream to-jewelry-gold-light flex items-center justify-center relative">
                    <span className="text-5xl leading-none">
                      {serviceCategories[getServiceIcon(service.title)]?.emoji || '⭐'}
                    </span>
                    {!isAffordable && (
                      <div className="absolute top-2 right-2 bg-jewelry-gray-elegant text-jewelry-cream px-2 py-1 rounded-lg text-xs font-semibold">
                        🔒
                      </div>
                    )}
                  </div>

                  {/* Информация */}
                  <div className="p-3">
                    <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
                      {service.title}
                    </h3>
                    
                    {(service.partner?.company_name || service.partner?.name) && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {service.partner?.company_name || service.partner?.name}
                      </p>
                    )}
                    
                    {/* Отображаем город/район */}
                    {service.partner?.city && (
                      <p className="text-xs text-jewelry-gray-elegant mb-2 flex items-center gap-1">
                        <span className="text-lg leading-none">📍</span>
                        <span className="truncate">
                          {service.partner.city === 'Все' ? 'Везде (онлайн)' : service.partner.city}
                          {service.partner.district && service.partner.district !== 'Все' ? `, ${service.partner.district}` : ''}
                        </span>
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-lg leading-none 💰">💰</span>
                        <span className={`font-bold ${
                          isAffordable ? 'text-jewelry-gold' : 'text-gray-400'
                        }`}>
                          {service.price_points}
                        </span>
                      </div>
                      {isAffordable && (
                        <span className="text-green-500 text-xs">✓ Доступно</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Модальное окно с деталями услуги */}
      {selectedService && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full p-6 shadow-lg transform transition-all duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Закрыть кнопку */}
            <button
              onClick={() => setSelectedService(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Изображение услуги */}
            <div className="flex items-center justify-center mb-6">
              {selectedService.image_url ? (
                <img 
                  src={selectedService.image_url} 
                  alt={selectedService.title}
                  className="w-32 h-32 object-cover rounded-full shadow-md"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-jewelry-cream to-jewelry-gold-light rounded-full flex items-center justify-center shadow-md border border-jewelry-gold/20">
                  <span className="text-6xl leading-none">
                    {serviceCategories[getServiceIcon(selectedService.title)]?.emoji || '⭐'}
                  </span>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
              {selectedService.title}
            </h2>
            <p className="text-center text-gray-600 text-sm mb-4">
              {selectedService.partner?.company_name || selectedService.partner?.name}
            </p>

            {/* Описание */}
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              {selectedService.description}
            </p>

            {/* Цена и кнопка обмена */}
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2 text-jewelry-gold">
                <span className="text-3xl leading-none">💰</span>
                <span className="text-3xl font-bold">
                  {selectedService.price_points}
                </span>
                <span className="text-lg font-semibold text-gray-500">баллов</span>
              </div>
              <button
                onClick={handleExchange}
                className={`px-6 py-3 rounded-full text-white font-bold transition-colors shadow-lg active:scale-95 ${
                  balance >= selectedService.price_points
                    ? 'bg-jewelry-gold hover:bg-jewelry-gold-dark'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={balance < selectedService.price_points}
              >
                Обменять
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

export default Services