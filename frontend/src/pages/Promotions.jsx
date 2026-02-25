import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getActivePromotions, getClientBalance, getReferralPartnerInfo, isApprovedPartner } from '../services/supabase'
import { filterCompetitors } from '../utils/categoryHelpers'
import { getChatId, hapticFeedback } from '../utils/telegram'
import { useTranslation, translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import Layout from '../components/Layout'
import { Search, X, Gift } from 'lucide-react'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond']
const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond' }
const TIER_THRESHOLDS = { bronze: 0, silver: 500, gold: 2000, platinum: 5000, diamond: 10000 }

const getTierFromBalance = (balance) => {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    if ((balance || 0) >= TIER_THRESHOLDS[TIER_ORDER[i]]) return TIER_ORDER[i]
  }
  return 'bronze'
}

const isTierSufficient = (userTier, requiredTier) =>
  !requiredTier || TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier)

const Promotions = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('id')
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const [loading, setLoading] = useState(true)
  const [userTier, setUserTier] = useState('bronze')
  const [promotions, setPromotions] = useState([])
  const [translatedPromotions, setTranslatedPromotions] = useState([])
  const [translating, setTranslating] = useState(false)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRemaining, setTimeRemaining] = useState({})
  const [referralPartnerInfo, setReferralPartnerInfo] = useState(null)
  const [isPartnerUser, setIsPartnerUser] = useState(false)

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

  const applyPromotionFilters = (data, referralInfo, isPartner, userChatId) => {
    let result = filterCompetitors(data, referralInfo, isPartner, isPartner ? String(userChatId) : null)
    if (isPartner && referralInfo) {
      result = result.filter(promo => {
        if (promo.partner_chat_id === String(userChatId)) return true
        const isCompetitorPartner = promo.partner?.business_type === referralInfo.businessType
        if (isCompetitorPartner && promo.visibility_mode === 'hide_competitors') return false
        return true
      })
    }
    return result
  }

  const loadPromotions = async () => {
    try {
      const [balance, referralInfo, partnerStatus] = await Promise.all([
        chatId ? getClientBalance(chatId) : Promise.resolve(null),
        getReferralPartnerInfo(chatId),
        chatId ? isApprovedPartner(chatId) : Promise.resolve(false),
      ])

      const tier = getTierFromBalance(balance?.balance)
      setUserTier(tier)
      setReferralPartnerInfo(referralInfo)
      setIsPartnerUser(!!partnerStatus)

      const cacheKey = `promotions_cache_${tier}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed)) {
            setPromotions(applyPromotionFilters(parsed, referralInfo, !!partnerStatus, chatId))
            setLoading(false)
          }
        } catch {}
      }

      const data = await getActivePromotions(tier)
      sessionStorage.setItem(cacheKey, JSON.stringify(data))
      setPromotions(applyPromotionFilters(data, referralInfo, !!partnerStatus, chatId))
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
      <Layout>
        <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4 pt-2">
          <div className="h-7 w-40 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }} />
          <div className="flex gap-2">
            <div className="h-10 w-24 rounded-full animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }} />
            <div className="h-10 w-32 rounded-full animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }} />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl h-[280px] animate-pulse" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }} />
          ))}
        </div>
      </Layout>
    )
  }

  const filteredPromotions = getFilteredPromotions()
  const featuredPromotions = filteredPromotions.slice(0, Math.min(filteredPromotions.length, 3))

  return (
    <Layout>
      <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4">
        {/* Заголовок */}
        <h1 className="text-xl font-bold pt-2">{t('promo_title')}</h1>

        {/* Поиск */}
        <div
          className="flex items-center gap-3 h-11 px-4 rounded-xl"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          <Search size={18} style={{ color: 'var(--tg-theme-hint-color)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('promo_search')}
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: 'var(--tg-theme-text-color)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-full active:scale-90 transition-transform"
            >
              <X size={16} style={{ color: 'var(--tg-theme-hint-color)' }} />
            </button>
          )}
        </div>

        {/* Фильтры */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: t('promo_all') },
            { id: 'active', label: t('promo_active') },
            { id: 'ending', label: t('promo_ending') }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95"
              style={{
                backgroundColor: filter === cat.id
                  ? 'var(--tg-theme-button-color)'
                  : 'var(--tg-theme-secondary-bg-color)',
                color: filter === cat.id
                  ? 'var(--tg-theme-button-text-color, #fff)'
                  : 'var(--tg-theme-text-color)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredPromotions.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <Gift size={48} className="mx-auto mb-3" style={{ color: 'var(--tg-theme-hint-color)' }} />
            <h3 className="text-lg font-bold mb-2">{t('promo_no_items')}</h3>
            <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {language === 'ru'
                ? 'Следите за обновлениями — новые акции появятся здесь.'
                : 'Stay tuned — new promotions will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Hero карусель */}
            {featuredPromotions.length > 0 && (
              <div
                className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4"
                style={{
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {featuredPromotions.map((item) => {
                  const daysLeft = getDaysRemaining(item.end_date)
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/promotions/${item.id}`)}
                      className="flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-[0.98]"
                      style={{
                        scrollSnapAlign: 'start',
                        width: 'min(280px, 78vw)',
                        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                      }}
                    >
                      <div className="relative h-[160px] overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sakura-deep to-sakura-mid"
                          >
                            <Gift size={40} className="text-white/40" />
                          </div>
                        )}
                        {daysLeft <= 3 && daysLeft > 0 && (
                          <div className="absolute top-2 right-2 bg-sakura-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {timeRemaining[item.id] || `${daysLeft}д`}
                          </div>
                        )}
                        {item.min_tier && !isTierSufficient(userTier, item.min_tier) && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white">
                            🔒 {language === 'ru' ? 'От' : 'From'} {TIER_LABELS[item.min_tier]}
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <p className="text-[11px] mb-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                          {t('promo_until')} {formatShortDate(item.end_date)}
                        </p>
                        <h3 className="text-sm font-bold leading-tight line-clamp-2">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Список */}
            <div>
              <h2 className="text-base font-bold mb-3">{t('promo_all_promotions')}</h2>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
              >
                {filteredPromotions.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/promotions/${item.id}`)}
                    className="flex items-center gap-3 p-3 cursor-pointer transition-all active:bg-black/5"
                    style={{
                      borderBottom: index < filteredPromotions.length - 1
                        ? '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 12%, transparent)'
                        : 'none',
                    }}
                  >
                    <div className="flex-shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                        ) : (
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br from-sakura-deep to-sakura-mid"
                        >
                          <Gift size={24} className="text-white/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                          {item.partner?.company_name || t('promo_promotion')}
                        </p>
                        {item.min_tier && !isTierSufficient(userTier, item.min_tier) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10" style={{ color: 'var(--tg-theme-hint-color)' }}>
                            🔒 {TIER_LABELS[item.min_tier]}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold leading-tight line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>
                        {t('promo_until')} {formatShortDate(item.end_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
    </Layout>
  )
}

export default Promotions
