import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getApprovedServices, getClientBalance } from '../services/supabase'
import { getChatId, hapticFeedback, showConfirm } from '../utils/telegram'
import Loader from '../components/Loader'

const Services = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('id')
  const chatId = getChatId()
  
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [balance, setBalance] = useState(0)
  const [filter, setFilter] = useState('all') // all, affordable, expensive
  const [selectedService, setSelectedService] = useState(null)

  useEffect(() => {
    loadData()
  }, [chatId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [servicesData, balanceData] = await Promise.all([
        getApprovedServices(),
        getClientBalance(chatId)
      ])
      setServices(servicesData)
      setBalance(balanceData?.balance || 0)
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setLoading(false)
    }
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
    return <Loader text="Загрузка услуг..." />
  }

  const filteredServices = getFilteredServices()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
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

        {/* Фильтры */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'all'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Все ({services.length})
          </button>
          <button
            onClick={() => handleFilterChange('affordable')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'affordable'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Доступные
          </button>
          <button
            onClick={() => handleFilterChange('expensive')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'expensive'
                ? 'bg-white text-orange-500'
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
                    isHighlighted ? 'ring-2 ring-orange-500' : ''
                  } ${!isAffordable ? 'opacity-60' : ''}`}
                >
                  {/* Иконка */}
                  <div className="h-32 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center relative">
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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-orange-500 font-bold text-lg">
                          🪙
                        </span>
                        <span className={`font-bold ${
                          isAffordable ? 'text-orange-500' : 'text-gray-400'
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
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center">
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
                <span className="text-2xl font-bold text-orange-500">
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
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {balance >= selectedService.price_points ? 'Обменять' : 'Недостаточно баллов'}
              </button>
            </div>
          </div>
        </div>
      )}

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

