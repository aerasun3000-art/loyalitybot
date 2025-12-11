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
  const [timeRemaining, setTimeRemaining] = useState({})

  // Форматирование времени до окончания
  const formatTimeRemaining = (milliseconds) => {
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24))
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
      return `${days}д ${hours}ч`
    } else if (hours > 0) {
      return `${hours}ч ${minutes}м`
    } else {
      return `${minutes}м`
    }
  }

  useEffect(() => {
    loadPromotions()
  }, [])

  // Обновление счетчика времени каждую секунду для hero-акции
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const updated = {}
      promotions.forEach(promo => {
        const end = new Date(promo.end_date)
        const diff = end - now
        if (diff > 0) {
          updated[promo.id] = formatTimeRemaining(diff)
        }
      })
      setTimeRemaining(updated)
    }, 1000)

    return () => clearInterval(interval)
  }, [promotions])

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

  // Функция для выбора hero-акции
  const getHeroPromotion = (promotionsList) => {
    if (!promotionsList || promotionsList.length === 0) return null

    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Приоритет 1: Заканчивается < 3 дня
    const endingSoon = promotionsList.find(p => {
      const endDate = new Date(p.end_date)
      return endDate <= threeDaysFromNow && endDate > now
    })
    if (endingSoon) return endingSoon

    // Приоритет 2: Новая (< 7 дней)
    const newPromo = promotionsList.find(p => {
      const created = new Date(p.created_at || p.start_date)
      return created >= sevenDaysAgo
    })
    if (newPromo) return newPromo

    // Приоритет 3: Первая в списке
    return promotionsList[0]
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
          <>
            {/* Hero-акция */}
            {(() => {
              const heroPromo = getHeroPromotion(filteredPromotions)
              if (!heroPromo) return null

              const daysLeft = getDaysRemaining(heroPromo.end_date)
              const isHighlighted = heroPromo.id === highlightId
              const isEndingSoon = daysLeft <= 3
              const isNew = (() => {
                const created = new Date(heroPromo.created_at || heroPromo.start_date)
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                return created >= sevenDaysAgo
              })()
              
              const heroTimeRemaining = timeRemaining[heroPromo.id] || (() => {
                const now = new Date()
                const end = new Date(heroPromo.end_date)
                const diff = end - now
                return diff > 0 ? formatTimeRemaining(diff) : '0м'
              })()

              return (
                <div className="mb-6">
                  <div
                    onClick={() => {
                      hapticFeedback('light')
                      navigate(`/promotions/${heroPromo.id}`)
                    }}
                    className={`relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-300 shadow-2xl ${
                      isHighlighted ? 'ring-4 ring-red-500 ring-offset-2' : ''
                    }`}
                    style={{ 
                      height: '60vh',
                      minHeight: '400px',
                      maxHeight: '500px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                  >
                    {/* Фоновое изображение */}
                    {heroPromo.image_url ? (
                      <>
                        <img
                          src={heroPromo.image_url}
                          alt={heroPromo.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-red-500" />
                    )}

                    {/* Бейджи */}
                    <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {isEndingSoon && (
                          <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse">
                            🔥 ГОРЯЧЕЕ ПРЕДЛОЖЕНИЕ
                          </div>
                        )}
                        {isNew && !isEndingSoon && (
                          <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                            ⚡ НОВАЯ АКЦИЯ
                          </div>
                        )}
                        {!isEndingSoon && !isNew && (
                          <div className="bg-yellow-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                            ⭐ ТОП АКЦИЯ
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Счетчик времени (если заканчивается < 3 дня) */}
                    {isEndingSoon && (
                      <div className="absolute top-4 right-4 z-20">
                        <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-xl border-2 border-red-500 shadow-lg">
                          <div className="text-xs font-semibold text-red-300 mb-1">Осталось</div>
                          <div className="text-xl font-bold text-white">{heroTimeRemaining}</div>
                        </div>
                      </div>
                    )}

                    {/* Контент внизу */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-6">
                      {/* Название */}
                      <h2 className="text-white font-bold text-2xl mb-2 drop-shadow-2xl leading-tight">
                        {heroPromo.title}
                      </h2>

                      {/* Партнер */}
                      {heroPromo.partner?.company_name && (
                        <p className="text-white/90 text-sm mb-3 drop-shadow-lg">
                          {heroPromo.partner.company_name}
                        </p>
                      )}

                      {/* Ценность предложения */}
                      <div className="mb-4">
                        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 inline-block border border-white/30">
                          <div className="text-white text-lg font-bold">
                            {heroPromo.discount_value || (heroPromo.required_points > 0 ? `${heroPromo.required_points} баллов` : 'БЕСПЛАТНО')}
                          </div>
                        </div>
                      </div>

                      {/* CTA-кнопка */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          hapticFeedback('medium')
                          navigate(`/promotions/${heroPromo.id}`)
                        }}
                        className="w-full bg-white text-gray-900 font-bold py-4 rounded-xl shadow-2xl hover:bg-gray-100 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <span>Активировать сейчас</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Сетка остальных акций */}
            {(() => {
              const heroPromo = getHeroPromotion(filteredPromotions)
              const gridPromotions = heroPromo 
                ? filteredPromotions.filter(p => p.id !== heroPromo.id)
                : filteredPromotions

              if (gridPromotions.length === 0) return null

              return (
                <div className="grid grid-cols-2 gap-4">
                  {gridPromotions.map((promo, index) => {
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
              )
            })()}
          </>
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

