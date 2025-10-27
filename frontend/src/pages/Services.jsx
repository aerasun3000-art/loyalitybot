import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFilteredServices, getClientBalance } from '../services/supabase'
import { getChatId, hapticFeedback, showConfirm } from '../utils/telegram'
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
  const [selectedService, setSelectedService] = useState(null)
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState(cityParam || '')
  const [selectedDistrict, setSelectedDistrict] = useState(districtParam || '')

  useEffect(() => {
    loadData()
  }, [chatId, cityParam, districtParam])

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
    switch (filter) {
      case 'affordable':
        return services.filter(s => s.price_points <= balance)
      case 'expensive':
        return services.filter(s => s.price_points > balance)
      default:
        return services
    }
  }

  const handleFilterChange = (newFilter) => {
    hapticFeedback('light')
    setFilter(newFilter)
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

  const serviceIcons = ['🧹', '🔧', '🏠', '💼', '🚗', '📦', '🎨', '💆', '🍕', '☕', '🎁', '🎮']

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-r from-pink-400 to-rose-500 px-4 pt-6 pb-8">
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
                <div className="w-16 h-16 bg-pink-100 rounded-2xl mx-auto mb-3" />
                <div className="h-4 bg-pink-100 rounded w-3/4 mx-auto mb-2" />
                <div className="h-3 bg-pink-50 rounded w-1/2 mx-auto" />
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
      <div className="bg-gradient-to-r from-pink-400 to-rose-500 px-4 pt-6 pb-8">
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
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {/* Кнопка выбора локации */}
          {!selectedCity && !selectedDistrict && (
            <button
              onClick={handleOpenLocationSelector}
              className="px-4 py-2 rounded-full font-semibold whitespace-nowrap bg-white text-pink-500 flex items-center gap-2"
            >
              📍 Выбрать город
            </button>
          )}
          
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white text-pink-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Все ({services.length})
          </button>
          <button
            onClick={() => handleFilterChange('affordable')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'affordable'
                ? 'bg-white text-pink-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Доступные
          </button>
          <button
            onClick={() => handleFilterChange('expensive')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'expensive'
                ? 'bg-white text-pink-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Копим
          </button>
        </div>
      </div>

      {/* Список услуг */}
      <div className="px-4 -mt-4 pb-20">
        {filteredServices.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-gray-600">
              {filter === 'affordable' 
                ? 'Нет доступных услуг. Копите баллы!'
                : 'Услуги не найдены'}
            </p>
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
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all ${
                    isHighlighted ? 'ring-2 ring-pink-500' : ''
                  } ${!isAffordable ? 'opacity-60' : ''}`}
                >
                  {/* Иконка */}
                  <div className="h-32 bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center relative">
                    <span className="text-6xl">
                      {serviceIcons[index % serviceIcons.length]}
                    </span>
                    {!isAffordable && (
                      <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs">
                        🔒
                      </div>
                    )}
                  </div>

                  {/* Информация */}
                  <div className="p-3">
                    <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
                      {service.title}
                    </h3>
                    
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {service.partner?.company_name || service.partner?.name}
                    </p>
                    
                    {/* Отображаем город/район */}
                    {service.partner?.city && (
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">
                          {service.partner.city}{service.partner.district ? `, ${service.partner.district}` : ''}
                        </span>
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-pink-500 font-bold text-lg">
                          🪙
                        </span>
                        <span className={`font-bold ${
                          isAffordable ? 'text-pink-500' : 'text-gray-400'
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
            className="bg-white rounded-t-3xl w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center">
                <span className="text-4xl">
                  {serviceIcons[services.indexOf(selectedService) % serviceIcons.length]}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  {selectedService.title}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedService.partner?.company_name || selectedService.partner?.name}
                </p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              {selectedService.description || 'Подробности уточняйте у партнёра'}
            </p>

            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-600">Стоимость:</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl">🪙</span>
                <span className="text-2xl font-bold text-pink-500">
                  {selectedService.price_points}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedService(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={handleExchange}
                disabled={balance < selectedService.price_points}
                className={`flex-1 py-4 rounded-xl font-semibold ${
                  balance >= selectedService.price_points
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {balance >= selectedService.price_points ? 'Обменять' : 'Недостаточно баллов'}
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
        title="Выберите местоположение"
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default Services

