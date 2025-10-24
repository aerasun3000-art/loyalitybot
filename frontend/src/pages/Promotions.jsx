import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Title, Card, Button, Chip } from '@telegram-apps/telegram-ui'
import { getActivePromotions } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import Loader from '../components/Loader'
import { PromotionSkeleton } from '../components/SkeletonCard'

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
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-pink-400 to-rose-500 px-4 pt-6 pb-8">
          <div className="flex items-center mb-6">
            <div className="w-6 h-6 bg-white/50 rounded animate-pulse mr-3" />
            <div className="h-8 bg-white/50 rounded w-40 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-white/30 rounded-full w-24 animate-pulse" />
            <div className="h-10 bg-white/30 rounded-full w-32 animate-pulse" />
            <div className="h-10 bg-white/30 rounded-full w-40 animate-pulse" />
          </div>
        </div>

        <div className="px-4 -mt-4 pb-20 space-y-4">
          <PromotionSkeleton />
          <PromotionSkeleton />
          <PromotionSkeleton />
        </div>
      </div>
    )
  }

  const filteredPromotions = getFilteredPromotions()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-pink-400 to-rose-500 px-4 pt-6 pb-8">
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
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  filter === 'all'
                    ? 'bg-white text-pink-500 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
            Все ({promotions.length})
          </button>
              <button
                onClick={() => handleFilterChange('active')}
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  filter === 'active'
                    ? 'bg-white text-pink-500 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
            Активные
          </button>
              <button
                onClick={() => handleFilterChange('ending')}
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  filter === 'ending'
                    ? 'bg-white text-pink-500 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
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
            {filteredPromotions.map((promo, index) => {
              const daysLeft = getDaysRemaining(promo.end_date)
              const isHighlighted = promo.id === highlightId
              
              // Разнообразные градиенты для каждой карточки
              const gradients = [
                'from-pink-400 via-rose-400 to-pink-500',
                'from-purple-400 via-pink-400 to-rose-400',
                'from-rose-400 via-pink-500 to-purple-400',
                'from-pink-500 via-purple-400 to-pink-400',
                'from-pink-300 via-pink-400 to-rose-400',
                'from-purple-300 via-pink-300 to-pink-400'
              ]
              const gradient = gradients[index % gradients.length]
              
              // Разнообразные иконки
              const icons = ['🎉', '🎁', '✨', '💖', '🌸', '💝', '🌟', '💎', '⭐']
              const icon = icons[index % icons.length]
              
              return (
                  <div
                    key={promo.id}
                    className={`bg-white rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover active:scale-98 transition-all duration-300 ${
                      isHighlighted ? 'ring-2 ring-pink-500' : ''
                    }`}
                  >
                  {/* Баннер с изображением */}
                  <div className={`h-48 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                    {/* Фоновые эффекты */}
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    
                    {/* Фоновая иконка */}
                    <span className="text-9xl opacity-20 absolute">{icon}</span>
                    
                    {/* Основная иконка */}
                    <div className="relative z-10 text-center">
                      <span className="text-8xl drop-shadow-2xl">{icon}</span>
                    </div>
                    
                    {/* Бэджи */}
                    <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                      {/* Бэдж "Заканчивается" */}
                      {daysLeft <= 3 && (
                        <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                          {daysLeft === 0 ? '🔥 Последний день!' : `⏰ ${daysLeft} дн.`}
                        </div>
                      )}
                      
                      {/* Бэдж "Бесплатно" */}
                      {promo.required_points === 0 && (
                        <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ml-auto">
                          🎁 FREE
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Контент */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2">
                      {promo.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-pink-500 font-semibold text-sm">
                        {promo.partner?.company_name || promo.partner?.name}
                      </span>
                      {promo.required_points > 0 && (
                        <span className="bg-pink-100 text-pink-600 px-2 py-1 rounded-full text-xs font-bold">
                          🪙 {promo.required_points}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {promo.description || 'Подробности уточняйте у партнёра'}
                    </p>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
                          <path d="M8 4v4.5l3.5 2.1.7-1.2-3-1.8V4z"/>
                        </svg>
                        <span>
                          До {new Date(promo.end_date).toLocaleDateString('ru', {
                            day: 'numeric',
                            month: 'long'
                          })}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          hapticFeedback('medium')
                          // TODO: Открыть детали акции
                        }}
                        className="text-pink-500 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        Подробнее
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                        </svg>
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

