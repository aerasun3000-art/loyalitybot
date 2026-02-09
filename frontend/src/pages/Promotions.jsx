import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getActivePromotions } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation, translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import { PromotionSkeleton } from '../components/SkeletonCard'

const Promotions = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('id')
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  
  const [loading, setLoading] = useState(true)
  const [promotions, setPromotions] = useState([])
  const [translatedPromotions, setTranslatedPromotions] = useState([])
  const [translating, setTranslating] = useState(false)
  const [filter, setFilter] = useState('all') // all, active, ending
  const [searchQuery, setSearchQuery] = useState('')
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

  const formatShortDate = (dateString) => {
    const date = new Date(dateString)
    const options = { year: 'numeric', month: 'short', day: 'numeric' }
    const locale = language === 'ru' ? 'ru-RU' : 'en-US'
    return date.toLocaleDateString(locale, options)
  }

  // Автоматический перевод акций при изменении языка
  useEffect(() => {
    if (promotions.length === 0 || language === 'ru') {
      setTranslatedPromotions(promotions)
      return
    }

    const checkApiAndTranslate = async () => {
      // Если в БД уже есть предзаполненные английские поля, используем их без обращения к API
      if (language === 'en' && promotions.some(item => item.title_en || item.description_en)) {
        const mapped = promotions.map(item => ({
          ...item,
          title: item.title_en || item.title,
          description: item.description_en || item.description
        }))
        setTranslatedPromotions(mapped)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.warn('⚠️ VITE_API_URL не установлен. Переводы отключены. Показываем оригинальный текст.')
        setTranslatedPromotions(promotions)
        return
      }

      setTranslating(true)
      try {
        const translated = await Promise.all(
          promotions.map(async (item) => {
            try {
              return {
                ...item,
                title: await translateDynamicContent(item.title, language, 'ru'),
                description: item.description
                  ? await translateDynamicContent(item.description, language, 'ru')
                  : null,
              }
            } catch (error) {
              console.warn(`Translation failed for promotion ${item.id}:`, error)
              return item
            }
          })
        )
        setTranslatedPromotions(translated)
      } catch (error) {
        console.error('Error translating promotions:', error)
        setTranslatedPromotions(promotions)
      } finally {
        setTranslating(false)
      }
    }

    checkApiAndTranslate()
  }, [promotions, language])

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

    const displayPromotions = translatedPromotions.length > 0 ? translatedPromotions : promotions
    let result = displayPromotions
    switch (filter) {
      case 'ending':
        result = result.filter(p => new Date(p.end_date) <= threeDaysFromNow)
        break
      case 'active':
        result = result.filter(p => new Date(p.end_date) > threeDaysFromNow)
        break
      default:
        break
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.partner?.company_name?.toLowerCase().includes(q)
      )
    }

    return result
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
      <div className="min-h-screen bg-gray-50 dark:bg-sakura-cream">
        <div className="bg-gradient-to-r from-sakura-deep to-sakura-mid px-4 pt-6 pb-8">
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
  const featuredPromotions = filteredPromotions.slice(0, Math.min(filteredPromotions.length, 3))
  const listPromotions = filteredPromotions

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 text-sakura-surface">
      <div className="absolute inset-0 -z-20">
        <img
          src="/bg/sakura.jpg"
          alt="Sakura background"
          className="w-full h-full object-cover opacity-85"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-sakura-deep/90 backdrop-blur-xl border-b border-sakura-border/40">
        <div className="px-4 pt-14 pb-4">
          <h1 className="text-[28px] font-bold text-white leading-tight">{t('promo_title')}</h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sticky top-[70px] z-10 px-4 pt-4 pb-2 bg-sakura-deep/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 h-12 px-4 bg-white/85 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-sakura-border/20">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('promo_search')}
            className="flex-1 text-base text-sakura-deep/95 placeholder:text-sakura-mid outline-none bg-transparent"
          />
          <button
            onClick={() => setSearchQuery('')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6B7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-[134px] z-10 px-4 pt-2 pb-3 bg-sakura-deep/90 backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            { id: 'all', label: t('promo_all') },
            { id: 'active', label: t('promo_active') },
            { id: 'ending', label: t('promo_ending') }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
              className={`flex-shrink-0 h-10 px-4 rounded-[20px] text-sm font-medium transition-all duration-200 ${
                filter === cat.id ? 'bg-sakura-accent/90 text-white' : 'bg-white/80 text-sakura-deep/90'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 pt-6 pb-6">
        {filteredPromotions.length === 0 ? (
          <div className="bg-white/20 backdrop-blur-xl rounded-3xl p-8 text-center border border-sakura-border/30 shadow-lg mx-4">
            <span className="text-6xl leading-none mx-auto mb-4 block">🌸</span>
            <h3 className="text-xl font-bold mb-2 text-[#111827]">{t('promo_no_items')}</h3>
            <p className="text-sm text-[#6B7280]">
              {language === 'ru' 
                ? 'Следите за обновлениями — новые акции появятся здесь.'
                : 'Stay tuned — new promotions will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Hero carousel with peek effect */}
            {featuredPromotions.length > 0 && (
              <div className="mb-6">
                <div
                  className="flex gap-4 overflow-x-auto scrollbar-hide px-4"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {featuredPromotions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/promotions/${item.id}`)}
                      className="flex-shrink-0 bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-sakura-border/20 overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.98]"
                      style={{
                        scrollSnapAlign: 'start',
                        minWidth: '85%',
                        maxWidth: '85%'
                      }}
                    >
                      <div className="relative h-[280px] overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-sakura-accent/45 via-sakura-mid/35 to-sakura-deep/45 flex items-center justify-center">
                            <span className="text-6xl text-white/40">🎁</span>
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '16px' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-sakura-mid leading-[1.4] font-normal">
                            {t('promo_until')} {formatShortDate(item.end_date)}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-sakura-deep/95 leading-[1.4] line-clamp-3">
                          {item.title}
                        </h3>

                        {item.description && (
                          <p className="text-sm text-sakura-mid leading-[1.5] mt-2 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List with thumbnails */}
            {listPromotions.length > 0 && (
              <div className="px-4 mt-6">
                <div className="mb-4">
                  <h2 className="text-[20px] font-bold text-sakura-deep/95 leading-[1.3]">
                    {t('promo_all_promotions')}
                  </h2>
                </div>
                <div className="bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-sakura-border/20">
                  {listPromotions.map((item, index) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/promotions/${item.id}`)}
                      className="flex items-start cursor-pointer transition-all duration-200 hover:bg-white/70 active:bg-white/80"
                      style={{
                        padding: '16px',
                        gap: '16px',
                        borderBottom: index < listPromotions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                        minHeight: '100px'
                      }}
                    >
                      <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <p className="text-sm font-medium text-sakura-deep/90 leading-[1.5]" style={{ fontSize: '14px', fontWeight: 500 }}>
                          {item.partner?.company_name || t('promo_promotion')}
                        </p>

                        <h3 className="text-base font-semibold text-sakura-deep/95 leading-[1.5] line-clamp-2" style={{ fontSize: '16px', fontWeight: 600 }}>
                          {item.title}
                        </h3>

                        <p className="text-xs text-sakura-mid leading-[1.4]" style={{ fontSize: '12px', fontWeight: 400 }}>
                          {`${t('promo_until')} ${formatShortDate(item.end_date)}`}
                        </p>
                      </div>

                      <div className="flex-shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="object-cover"
                            style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '8px'
                            }}
                          />
                        ) : (
                          <div
                            className="bg-gradient-to-br from-sakura-accent/45 via-sakura-mid/35 to-sakura-deep/45 flex items-center justify-center"
                            style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '8px'
                            }}
                          >
                            <span className="text-2xl text-white/40">🎁</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

