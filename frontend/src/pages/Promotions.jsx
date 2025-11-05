import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Title, Card, Button, Chip } from '@telegram-apps/telegram-ui'
import { getActivePromotions } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
// import LuxuryIcon from '../components/LuxuryIcons'
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
      // 1) сначала берём кеш
      const cached = sessionStorage.getItem('promotions_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed)) {
            setPromotions(parsed)
            setLoading(false)
          }
        } catch {}
      }

      // 2) фоновая загрузка
      const data = await getActivePromotions()
      setPromotions(data)
      sessionStorage.setItem('promotions_cache', JSON.stringify(data))
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
        <div className="bg-gradient-to-r from-jewelry-brown-dark to-jewelry-burgundy px-4 pt-6 pb-8">
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
      <div className="bg-gradient-to-r from-jewelry-brown-dark to-jewelry-burgundy px-4 pt-6 pb-8">
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
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                  filter === 'all'
                    ? 'bg-jewelry-cream text-jewelry-gold shadow-lg'
                    : 'bg-jewelry-cream/20 text-jewelry-cream hover:bg-jewelry-cream/30'
                }`}
              >
            Все ({promotions.length})
          </button>
              <button
                onClick={() => handleFilterChange('active')}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                  filter === 'active'
                    ? 'bg-jewelry-cream text-jewelry-gold shadow-lg'
                    : 'bg-jewelry-cream/20 text-jewelry-cream hover:bg-jewelry-cream/30'
                }`}
              >
            Активные
          </button>
              <button
                onClick={() => handleFilterChange('ending')}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                  filter === 'ending'
                    ? 'bg-jewelry-cream text-jewelry-gold shadow-lg'
                    : 'bg-jewelry-cream/20 text-jewelry-cream hover:bg-jewelry-cream/30'
                }`}
              >
            Скоро закончатся
          </button>
        </div>
      </div>

      {/* Список акций */}
      <div className="px-4 -mt-4 pb-20">
        {filteredPromotions.length === 0 ? (
          <div className="bg-jewelry-cream rounded-xl p-8 text-center shadow-lg border border-jewelry-gold/20">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-jewelry-gray-elegant">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
            </svg>
            <p className="text-jewelry-brown-dark">Нет активных акций</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPromotions.map((promo, index) => {
              const daysLeft = getDaysRemaining(promo.end_date)
              const isHighlighted = promo.id === highlightId
              
              // Разнообразные градиенты для каждой карточки
              const gradients = [
                'from-jewelry-brown-dark via-jewelry-burgundy to-jewelry-gold',
                'from-jewelry-burgundy via-jewelry-gold to-jewelry-brown-dark',
                'from-jewelry-gold via-jewelry-brown-dark to-jewelry-burgundy',
                'from-jewelry-brown-light via-jewelry-burgundy to-jewelry-gold',
                'from-jewelry-burgundy via-jewelry-gold to-jewelry-brown-light',
                'from-jewelry-gold via-jewelry-brown-light to-jewelry-burgundy'
              ]
              const gradient = gradients[index % gradients.length]
              
              // Разнообразные иконки
              const iconNames = ['celebration', 'celebration', 'default', 'heart', 'flower', 'celebration', 'star', 'diamond', 'star']
              const iconName = iconNames[index % iconNames.length]
              
              return (
                  <div
                    key={promo.id}
                    className={`bg-jewelry-cream rounded-xl overflow-hidden shadow-lg border border-jewelry-gold/20 hover:shadow-xl transition-all duration-300 ${
                      isHighlighted ? 'ring-2 ring-jewelry-gold' : ''
                    }`}
                  >
                  {/* Баннер с изображением */}
                  {promo.image_url ? (
                    // Реальное фото
                    <div className="h-48 relative overflow-hidden">
                      <img 
                        src={promo.image_url} 
                        alt={promo.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      
                      {/* Бэджи */}
                      <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                        {/* Бэдж "Заканчивается" */}
                        {daysLeft <= 3 && (
                          <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                            {daysLeft === 0 ? (
                              <>
                                <span>⚠️</span>
                                <span>Последний день!</span>
                              </>
                            ) : (
                              <>
                                <span>ℹ️</span>
                                <span>{daysLeft} дн.</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Бэдж "Бесплатно" */}
                        {promo.required_points === 0 && (
                          <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ml-auto flex items-center gap-1">
                            <span>🎉</span>
                            <span>FREE</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Placeholder с градиентом
                    <div className={`h-48 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                      {/* Фоновые эффекты */}
                      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      
                      {/* Фоновая иконка */}
                      <div className="absolute opacity-20 text-9xl leading-none">
                        ⭐
                      </div>
                      
                      {/* Основная иконка */}
                      <div className="relative z-10 text-center text-6xl leading-none">
                        ⭐
                      </div>
                      
                      {/* Бэджи */}
                      <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                        {/* Бэдж "Заканчивается" */}
                        {daysLeft <= 3 && (
                          <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                            {daysLeft === 0 ? (
                              <>
                                <span>⚠️</span>
                                <span>Последний день!</span>
                              </>
                            ) : (
                              <>
                                <span>ℹ️</span>
                                <span>{daysLeft} дн.</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Бэдж "Бесплатно" */}
                        {promo.required_points === 0 && (
                          <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ml-auto flex items-center gap-1">
                            <span>🎉</span>
                            <span>FREE</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Контент */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-jewelry-brown-dark mb-2 line-clamp-2">
                      {promo.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-3">
                      {(promo.partner?.company_name || promo.partner?.name) && (
                        <span className="text-jewelry-gold font-semibold text-sm">
                          {promo.partner?.company_name || promo.partner?.name}
                        </span>
                      )}
                      {promo.required_points > 0 && (
                        <span className="bg-jewelry-gold/20 text-jewelry-gold px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                          <span>💰</span>
                          <span>{promo.required_points}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-jewelry-gray-elegant text-sm mb-4 line-clamp-3">
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
                        className="text-jewelry-gold font-semibold flex items-center gap-1 hover:gap-2 transition-all active:scale-95"
                      >
                        Подробнее
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
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

