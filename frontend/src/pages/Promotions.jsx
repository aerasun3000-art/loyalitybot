import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Title, Card, Button, Chip } from '@telegram-apps/telegram-ui'
import { getActivePromotions } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import Loader from '../components/Loader'

const Promotions = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('id')
  
  const [loading, setLoading] = useState(true)
  const [promotions, setPromotions] = useState([])
  const [filter, setFilter] = useState('all') // all, active, ending

  useEffect(() => {
    loadPromotions()
  }, [])

  const loadPromotions = async () => {
    try {
      setLoading(true)
      const data = await getActivePromotions()
      setPromotions(data)
    } catch (error) {
      console.error('Error loading promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredPromotions = () => {
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    
    switch (filter) {
      case 'ending':
        return promotions.filter(p => new Date(p.end_date) <= threeDaysFromNow)
      case 'active':
        return promotions.filter(p => new Date(p.end_date) > threeDaysFromNow)
      default:
        return promotions
    }
  }

  const handleFilterChange = (newFilter) => {
    hapticFeedback('light')
    setFilter(newFilter)
  }

  const getDaysRemaining = (endDate) => {
    const now = new Date()
    const end = new Date(endDate)
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return <Loader text="Загрузка акций..." />
  }

  const filteredPromotions = getFilteredPromotions()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 pt-6 pb-8">
        <div className="flex items-center mb-6">
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
          <h1 className="text-2xl font-bold text-white">Акции партнёров</h1>
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
            Все ({promotions.length})
          </button>
          <button
            onClick={() => handleFilterChange('active')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'active'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => handleFilterChange('ending')}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
              filter === 'ending'
                ? 'bg-white text-orange-500'
                : 'bg-white/20 text-white'
            }`}
          >
            Скоро закончатся
          </button>
        </div>
      </div>

      {/* Список акций */}
      <div className="px-4 -mt-4 pb-20">
        {filteredPromotions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <span className="text-6xl mb-4 block">📭</span>
            <p className="text-gray-600">Нет активных акций</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPromotions.map((promo) => {
              const daysLeft = getDaysRemaining(promo.end_date)
              const isHighlighted = promo.id === highlightId
              
              return (
                <div
                  key={promo.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all ${
                    isHighlighted ? 'ring-2 ring-orange-500' : ''
                  }`}
                >
                  {/* Баннер */}
                  <div className="h-48 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center relative">
                    <span className="text-8xl">🎉</span>
                    {daysLeft <= 3 && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {daysLeft === 0 ? 'Последний день' : `${daysLeft} дн.`}
                      </div>
                    )}
                  </div>

                  {/* Контент */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {promo.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-orange-500 font-semibold">
                        {promo.partner?.company_name || promo.partner?.name}
                      </span>
                      {promo.required_points > 0 && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-bold">
                          {promo.required_points} баллов
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {promo.description || 'Подробности уточняйте у партнёра'}
                    </p>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        До {new Date(promo.end_date).toLocaleDateString('ru', {
                          day: 'numeric',
                          month: 'long'
                        })}
                      </span>
                      <button
                        onClick={() => {
                          hapticFeedback('medium')
                          // TODO: Открыть детали акции
                        }}
                        className="text-orange-500 font-semibold"
                      >
                        Подробнее →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

export default Promotions

