import { useState, useEffect, useRef } from 'react'
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
  const carouselRef = useRef(null)
  const isScrollingRef = useRef(false)

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

  // Обработчик бесконечного скролла для карусели
  useEffect(() => {
    const container = carouselRef.current
    if (!container || promotions.length <= 1) return

    const handleScroll = () => {
      if (isScrollingRef.current) return
      
      const scrollLeft = container.scrollLeft
      const containerWidth = container.offsetWidth
      const cardWidth = 280
      const gap = 16
      const cardWithGap = cardWidth + gap
      
      // Получаем данные о реальных карточках из DOM
      const firstCard = container.querySelector('[data-real-index="0"]')
      if (!firstCard) return
      
      const realStartIndex = parseInt(firstCard.getAttribute('data-index') || '0')
      // Вычисляем количество реальных карточек из DOM
      const allRealCards = container.querySelectorAll('[data-real-index]')
      const uniqueRealIndices = new Set(Array.from(allRealCards).map(card => card.getAttribute('data-real-index')))
      const baseLength = uniqueRealIndices.size
      if (baseLength <= 1) return
      
      const realEndIndex = realStartIndex + baseLength
      
      // Если прокрутили слишком далеко вправо (к концу клонов)
      if (scrollLeft >= (realEndIndex * cardWithGap) - containerWidth) {
        isScrollingRef.current = true
        // Переходим к началу реальных карточек
        container.scrollLeft = realStartIndex * cardWithGap + (scrollLeft - realEndIndex * cardWithGap)
        setTimeout(() => { isScrollingRef.current = false }, 50)
      }
      // Если прокрутили слишком далеко влево (к началу клонов)
      else if (scrollLeft <= (realStartIndex * cardWithGap) - containerWidth / 2) {
        isScrollingRef.current = true
        // Переходим к концу реальных карточек
        container.scrollLeft = realEndIndex * cardWithGap - containerWidth / 2 + (scrollLeft - (realStartIndex * cardWithGap - containerWidth / 2))
        setTimeout(() => { isScrollingRef.current = false }, 50)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [promotions, filter])

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
            {/* Единая карусель всех акций (включая hero) */}
            {(() => {
              // Используем ВСЕ акции для карусели, hero-акция будет первой
              const heroPromo = getHeroPromotion(filteredPromotions)
              
              // Если есть hero-акция, ставим её первой, остальные после неё
              // Важно: используем filteredPromotions полностью, чтобы не потерять акции
              let carouselPromotions = heroPromo && filteredPromotions.length > 1
                ? [heroPromo, ...filteredPromotions.filter(p => p.id !== heroPromo.id)]
                : filteredPromotions


              // Создаем бесконечную карусель: дублируем карточки в начале и конце
              // Если карточек меньше 2, повторяем для сохранения дизайна
              const basePromotions = carouselPromotions.length < 2 
                ? [...carouselPromotions, ...carouselPromotions]
                : carouselPromotions
              
              // Для бесконечной карусели дублируем карточки в начале и конце
              const displayPromotions = basePromotions.length > 1
                ? [...basePromotions, ...basePromotions, ...basePromotions]
                : basePromotions

              // Вычисляем позицию начала "реальных" карточек (после первых клонов)
              const realStartIndex = basePromotions.length
              const realEndIndex = realStartIndex + basePromotions.length

              return (
                <div className="relative">
                  <div 
                    ref={(el) => {
                      carouselRef.current = el
                      
                      if (el && displayPromotions.length > 0 && basePromotions.length > 1) {
                        // Центрируем первую реальную карточку при загрузке
                        setTimeout(() => {
                          const container = el
                          const containerWidth = container.offsetWidth
                          const cardWidth = 280
                          const gap = 16
                          // Прокручиваем к началу реальных карточек
                          const scrollPosition = realStartIndex * (cardWidth + gap) + (containerWidth / 2) - (cardWidth / 2) - 16
                          container.scrollLeft = scrollPosition
                        }, 100)
                      }
                    }}
                    className="flex gap-4 overflow-x-auto scrollbar-hide"
                    style={{
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      WebkitOverflowScrolling: 'touch',
                      scrollBehavior: 'smooth'
                    }}
                  >
                      {displayPromotions.map((promo, index) => {
                        const daysLeft = getDaysRemaining(promo.end_date)
                        const isHighlighted = promo.id === highlightId
                        const isEndingSoon = daysLeft <= 3
                        const isNew = (() => {
                          const created = new Date(promo.created_at || promo.start_date)
                          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          return created >= sevenDaysAgo
                        })()
                        const colors = getCardColor(parseInt(promo.id) || index)
                        
                        // Определяем, является ли это реальной карточкой (не клоном)
                        const isRealCard = basePromotions.length > 1 
                          ? (index >= realStartIndex && index < realEndIndex)
                          : true
                        const realIndex = basePromotions.length > 1 
                          ? (index % basePromotions.length)
                          : index
                        const isRealHero = realIndex === 0 && isRealCard
                        
                        return (
                          <div
                            key={`${promo.id}-${index}-clone`}
                            data-index={index}
                            data-real-index={realIndex}
                            data-hero={isRealHero ? 'true' : 'false'}
                            onClick={() => {
                              hapticFeedback('light')
                              navigate(`/promotions/${promo.id}`)
                            }}
                            className={`relative flex-shrink-0 cursor-pointer active:scale-[0.98] transition-all duration-300 ${
                              isHighlighted ? 'ring-2 ring-white ring-offset-2' : ''
                            } ${isRealHero ? 'ring-2 ring-yellow-400 ring-offset-2' : ''} ${!promo.image_url ? colors.bg : ''}`}
                            style={{
                              width: '280px',
                              height: '380px',
                              borderRadius: '20px',
                              overflow: 'hidden',
                              boxShadow: isRealHero ? '0 8px 12px rgba(0, 0, 0, 0.2)' : '0 4px 6px rgba(0, 0, 0, 0.1)',
                              transform: isRealHero ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            {/* Фоновое изображение с градиентным overlay */}
                            {promo.image_url ? (
                              <>
                                <img
                                  src={promo.image_url}
                                  alt={promo.title}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  style={{ filter: 'blur(0px)' }}
                                />
                                <div 
                                  className="absolute inset-0"
                                  style={{
                                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))'
                                  }}
                                />
                              </>
                            ) : (
                              <div className={`absolute inset-0 ${colors.bg} opacity-90`} />
                            )}

                            {/* Иконка "подробнее" в правом верхнем углу */}
                            <div className="absolute top-3 right-3 z-20">
                              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                  <path d="M7 17L17 7M7 7h10v10" />
                                </svg>
                              </div>
                            </div>

                            {/* Название и бренд вверху */}
                            <div className="absolute top-0 left-0 right-0 z-10 p-5 pt-16">
                              <h3 
                                className="text-white font-bold mb-1 drop-shadow-lg"
                                style={{
                                  fontSize: '18px',
                                  fontWeight: 700,
                                  lineHeight: '1.2',
                                  color: '#FFFFFF'
                                }}
                              >
                                {promo.title}
                              </h3>
                              {promo.partner?.company_name && (
                                <p 
                                  className="text-white/90 drop-shadow-md"
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: 400,
                                    opacity: 0.9
                                  }}
                                >
                                  {promo.partner.company_name}
                                </p>
                              )}
                            </div>

                            {/* Бейджи статуса */}
                            <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
                              {isEndingSoon && (
                                <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-lg">
                                  🔥 {daysLeft}д
                                </div>
                              )}
                              {isNew && !isEndingSoon && (
                                <div className="bg-green-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-lg">
                                  ⚡ НОВАЯ
                                </div>
                              )}
                            </div>

                            {/* Цена в правом нижнем углу */}
                            <div className="absolute bottom-4 right-4 z-10">
                              <div 
                                className="text-white font-bold drop-shadow-lg"
                                style={{
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: '#FFFFFF'
                                }}
                              >
                                {promo.discount_value || (promo.required_points > 0 ? `${promo.required_points} баллов` : 'Бесплатно')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
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

