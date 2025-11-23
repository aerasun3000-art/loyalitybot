import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

  const getCardColor = (index) => {
    const colors = [
      { bg: 'bg-yellow-400', text: 'text-yellow-900' },
      { bg: 'bg-teal-500', text: 'text-teal-900' },
      { bg: 'bg-pink-400', text: 'text-pink-900' },
      { bg: 'bg-purple-400', text: 'text-purple-900' },
      { bg: 'bg-blue-400', text: 'text-blue-900' },
      { bg: 'bg-green-400', text: 'text-green-900' },
      { bg: 'bg-orange-400', text: 'text-orange-900' },
      { bg: 'bg-indigo-400', text: 'text-indigo-900' }
    ]
    return colors[index % colors.length]
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
    <div className="min-h-screen bg-[#F5F5DC]">
      {/* Шапка */}
      <div className="bg-[#F5F5DC] px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="text-gray-800 mr-3"
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
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'serif' }}>Акции</h1>
          </div>
          <button className="text-gray-800">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>

        {/* Фильтры (категории) */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 relative ${
              filter === 'all'
                ? 'text-gray-900'
                : 'text-gray-600'
            }`}
          >
            Все
            {filter === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => handleFilterChange('active')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 relative ${
              filter === 'active'
                ? 'text-gray-900'
                : 'text-gray-600'
            }`}
          >
            Активные
            {filter === 'active' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => handleFilterChange('ending')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 relative ${
              filter === 'ending'
                ? 'text-gray-900'
                : 'text-gray-600'
            }`}
          >
            Скоро закончатся
            {filter === 'ending' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Список акций */}
      <div className="px-4 pb-20 pt-2">
        {filteredPromotions.length === 0 ? (
          <div className="bg-jewelry-cream rounded-xl p-8 text-center shadow-lg border border-jewelry-gold/20">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-jewelry-gray-elegant">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
            </svg>
            <p className="text-jewelry-brown-dark">Нет активных акций</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredPromotions.map((promo, index) => {
              const daysLeft = getDaysRemaining(promo.end_date)
              const isHighlighted = promo.id === highlightId
              const colors = getCardColor(parseInt(promo.id) || index)
              
              return (
                <div
                  key={promo.id}
                  onClick={() => {
                    hapticFeedback('light')
                    navigate(`/promotions/${promo.id}`)
                  }}
                  className={`${colors.bg} rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-300 hover:shadow-xl relative ${
                    isHighlighted ? 'ring-2 ring-white ring-offset-2' : ''
                  }`}
                  style={{ aspectRatio: '1 / 1.2' }}
                >
                  {/* Название вверху слева */}
                  <div className="absolute top-3 left-3 right-3 z-10">
                    <h3 
                      className="text-white font-bold leading-tight drop-shadow-lg"
                      style={{
                        fontSize: 'clamp(11px, 3vw, 14px)',
                        lineHeight: '1.2',
                        maxHeight: '2.4em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {promo.title.toUpperCase()}
                    </h3>
                    {daysLeft <= 3 && (
                      <div className="mt-1.5 inline-block bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {daysLeft === 0 ? '⚠️' : `ℹ️ ${daysLeft}д`}
                      </div>
                    )}
                  </div>

                  {/* Большое изображение (70-80% карточки) */}
                  <div className="absolute inset-0 flex items-end justify-center pt-12 pb-16">
                    {promo.image_url ? (
                      <img
                        src={promo.image_url}
                        alt={promo.title}
                        className="w-full h-auto max-h-[75%] object-contain"
                        style={{ 
                          objectPosition: 'center bottom'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center max-h-[75%]">
                        <span className="text-8xl leading-none opacity-40">⭐</span>
                      </div>
                    )}
                  </div>

                  {/* Цена/скидка внизу */}
                  <div className="absolute bottom-4 left-4 right-4 z-10">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                      <div className="text-white text-sm font-semibold">
                        {promo.discount_value || (promo.required_points > 0 ? `${promo.required_points} баллов` : 'Бесплатно')}
                      </div>
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

