import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPromotionById, getClientBalance, redeemPromotion } from '../services/supabase'
import { getChatId, hapticFeedback, showAlert } from '../utils/telegram'

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

const TierProgressBar = ({ currentBalance, currentTier, requiredTier, language }) => {
  const currentThresh = TIER_THRESHOLDS[currentTier] ?? 0
  const requiredThresh = TIER_THRESHOLDS[requiredTier] ?? 0
  const remaining = Math.max(0, requiredThresh - currentBalance)
  const range = requiredThresh - currentThresh
  const progress = range > 0 ? Math.min(100, ((currentBalance - currentThresh) / range) * 100) : 0

  return (
    <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 8%, transparent)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--tg-theme-hint-color)' }}>
        {language === 'ru' ? 'Ещё' : 'Need'} {remaining} {language === 'ru' ? 'баллов до' : 'pts to'} {TIER_LABELS[requiredTier]}
      </p>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, backgroundColor: 'var(--tg-theme-button-color)' }}
        />
      </div>
    </div>
  )
}
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import QRCode from 'qrcode'

const PromotionDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const [promotion, setPromotion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isQrLoading, setIsQrLoading] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrError, setQrError] = useState(null)
  const [balance, setBalance] = useState(0)
  const [userTier, setUserTier] = useState('bronze')
  const [pointsToSpend, setPointsToSpend] = useState(0)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redeemData, setRedeemData] = useState(null)
  const [showFullScreenQr, setShowFullScreenQr] = useState(false)
  const chatId = getChatId()

  useEffect(() => {
    if (id) {
      loadPromotionDetail()
    } else {
      // Если id не передан, перенаправляем на список акций
      navigate('/promotions')
    }
  }, [id, navigate])

  const loadPromotionDetail = async () => {
    if (!id) {
      navigate('/promotions')
      return
    }

    try {
      setLoading(true)
      // ID акции - это UUID (строка)
      const promoId = id

      const [promoData, balanceData] = await Promise.all([
        getPromotionById(promoId),
        chatId ? getClientBalance(chatId) : Promise.resolve({ balance: 0 })
      ])

      if (!promoData) {
        console.log('No promotion data, redirecting to /promotions')
        navigate('/promotions')
        return
      }

      setPromotion(promoData)
      const bal = balanceData?.balance || 0
      setBalance(bal)
      setUserTier(getTierFromBalance(bal))

      // Устанавливаем максимальное количество баллов по умолчанию
      if (promoData.max_points_payment && promoData.points_to_dollar_rate) {
        const maxPoints = Math.floor(promoData.max_points_payment / promoData.points_to_dollar_rate)
        setPointsToSpend(Math.min(maxPoints, balanceData?.balance || 0))
      }
    } catch (error) {
      console.error('Error loading promotion detail:', error)
      navigate('/promotions')
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (endDate) => {
    const now = new Date()
    const end = new Date(endDate)
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  const handleBack = () => {
    hapticFeedback('light')
    navigate('/promotions')
  }

  const handleFavorite = () => {
    hapticFeedback('light')
    setIsFavorite(!isFavorite)
  }

  const handleActivatePromotion = async () => {
    if (!chatId) {
      showAlert('Авторизуйтесь через Telegram, чтобы получить QR-код.')
      return
    }

    try {
      setIsQrLoading(true)
      setQrError(null)

      // QR код содержит только chat_id (для обычной активации без оплаты баллами)
      const qrPayload = chatId
      const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 })
      setQrImage(dataUrl)
      setRedeemData(null) // Сбрасываем данные об оплате баллами
    } catch (error) {
      console.error('Error generating promotion QR:', error)
      setQrError('Не удалось сгенерировать QR-код. Попробуйте позже.')
    } finally {
      setIsQrLoading(false)
    }
  }

  const handlePayWithPoints = async () => {
    if (!chatId) {
      showAlert('Авторизуйтесь через Telegram, чтобы оплатить баллами.')
      return
    }

    if (!promotion || !promotion.max_points_payment) {
      showAlert('Эта акция не поддерживает оплату баллами.')
      return
    }

    if (pointsToSpend <= 0) {
      showAlert('Введите количество баллов для оплаты.')
      return
    }

    if (pointsToSpend > balance) {
      showAlert(`Недостаточно баллов. Доступно: ${balance}`)
      return
    }

    try {
      setIsRedeeming(true)
      setQrError(null)
      setQrImage('')

      const promoId = id
      const result = await redeemPromotion(chatId, promoId, pointsToSpend)

      if (result.success) {
        setRedeemData(result)

        // Генерируем QR-код с данными об акции и оплате баллами
        const qrPayload = result.qr_data
        const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 })
        setQrImage(dataUrl)

        // Обновляем баланс
        setBalance(result.current_balance)
        setUserTier(getTierFromBalance(result.current_balance))

        hapticFeedback('success')
      } else {
        setQrError(result.error || 'Ошибка при подготовке оплаты баллами')
        hapticFeedback('error')
        showAlert(result.error || 'Ошибка при подготовке оплаты баллами')
      }
    } catch (error) {
      console.error('Error redeeming promotion:', error)
      setQrError('Ошибка сети. Проверьте подключение к интернету.')
      hapticFeedback('error')
      showAlert('Ошибка сети. Проверьте подключение к интернету.')
    } finally {
      setIsRedeeming(false)
    }
  }

  const handleBookTime = () => {
    if (!promotion) {
      return
    }

    const bookingUrl = promotion.booking_url || promotion.partner?.booking_url

    if (!bookingUrl) {
      showAlert('Ссылка на бронирование не указана для этой акции.')
      return
    }

    // Открываем ссылку в новой вкладке
    window.open(bookingUrl, '_blank')
    hapticFeedback('medium')
  }

  const handleShowLocation = () => {
    if (!promotion) return

    const mapsLink = promotion.partner?.google_maps_link
    const city = promotion.partner?.city
    const district = promotion.partner?.district

    if (mapsLink) {
      window.open(mapsLink, '_blank')
    } else if (city || district) {
      // Fallback to search query if no direct link
      const query = encodeURIComponent(`${promotion.partner?.company_name || ''} ${city || ''} ${district || ''}`.trim())
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
    } else {
       showAlert(language === 'ru' ? 'Локация не указана' : 'Location not specified')
       return
    }
    hapticFeedback('medium')
  }

  if (loading) {
    return <Loader />
  }

  if (!promotion) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
        <div className="text-center">
          <span className="text-6xl leading-none mx-auto mb-4">⚠️</span>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>Акция не найдена</h2>
          <button onClick={handleBack} className="font-semibold"
            style={{ color: 'var(--tg-theme-button-color)' }}>
            ← Назад к акциям
          </button>
        </div>
      </div>
    )
  }

  const daysLeft = getDaysRemaining(promotion.end_date)
  const tierLocked = promotion.min_tier && !isTierSufficient(userTier, promotion.min_tier)

  // Рассчитываем быстрые варианты баллов
  const pointsRate = promotion.points_to_dollar_rate || 1
  const maxPointsAvailable = promotion.max_points_payment
    ? Math.min(balance, Math.floor(promotion.max_points_payment / pointsRate))
    : balance

  const quickPointsOptions = [
    { label: '100', value: 100 },
    { label: '200', value: 200 },
    { label: '500', value: 500 },
    { label: language === 'ru' ? 'ВСЕ' : 'ALL', value: maxPointsAvailable }
  ].filter(opt => opt.value <= maxPointsAvailable && opt.value > 0)

  // Полноэкранный QR режим
  if (showFullScreenQr && qrImage) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: 'var(--tg-theme-button-color)' }}
        onClick={() => setShowFullScreenQr(false)}
      >
        <div className="text-center mb-6" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
          <p className="text-lg font-semibold mb-1">
            {promotion.partner?.company_name || promotion.partner?.name}
          </p>
          <h2 className="text-xl font-bold">{promotion.title}</h2>
        </div>

        <div className="rounded-3xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
          <img src={qrImage} alt="QR Code" className="w-64 h-64 object-contain" />
        </div>

        {redeemData ? (
          <div className="text-center mt-6 space-y-2" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            <p className="text-2xl font-bold">
              -{redeemData.points_to_spend} {language === 'ru' ? 'баллов' : 'points'}
            </p>
            <p className="text-lg opacity-90">
              = ${redeemData.points_value_usd?.toFixed(2)}
            </p>
            {redeemData.cash_payment > 0 && (
              <p className="text-sm opacity-75">
                {language === 'ru' ? 'Доплата:' : 'Cash:'} ${redeemData.cash_payment.toFixed(2)}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center mt-6" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            <p className="text-lg font-semibold">
              {language === 'ru' ? 'Покажите мастеру' : 'Show to specialist'}
            </p>
            <p className="text-sm opacity-75 mt-1">ID: {chatId}</p>
          </div>
        )}

        <button
          className="mt-8 px-8 py-3 rounded-full font-semibold"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-text-color, #fff) 20%, transparent)',
            color: 'var(--tg-theme-button-text-color, #fff)',
            border: '1px solid color-mix(in srgb, var(--tg-theme-button-text-color, #fff) 30%, transparent)'
          }}
          onClick={() => setShowFullScreenQr(false)}
        >
          {language === 'ru' ? 'Закрыть' : 'Close'}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
      {/* Шапка с кнопкой назад и избранное */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between"
        style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
        }}>
        <div className="flex items-center">
          <button onClick={handleBack} className="mr-3 p-2 -ml-2"
            style={{ color: 'var(--tg-theme-text-color)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
            {promotion.partner?.company_name || promotion.partner?.name || t('partner_not_connected')}
          </span>
        </div>
        <button onClick={handleFavorite} className="p-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? '#e91e63' : 'none'} stroke={isFavorite ? '#e91e63' : 'currentColor'} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Изображение акции (hero) */}
      {promotion.image_url && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={promotion.image_url}
            alt={promotion.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Карточка баланса - всегда видна */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="rounded-2xl p-4 shadow-lg"
          style={{ backgroundColor: 'var(--tg-theme-button-color)' }}>
          <div className="flex items-center justify-between"
            style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            <div>
              <p className="text-xs opacity-75 uppercase tracking-wide">
                {language === 'ru' ? 'Ваш баланс' : 'Your balance'}
              </p>
              <p className="text-2xl font-bold">{balance} {language === 'ru' ? 'баллов' : 'pts'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">≈</p>
              <p className="text-xl font-semibold">${(balance * pointsRate).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 py-6">
        <div className="rounded-3xl shadow-lg p-6"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
          }}>
          <div className="space-y-5" style={{ color: 'var(--tg-theme-text-color)' }}>

            {/* Заголовок акции */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 text-xs font-semibold rounded-full"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)',
                    color: 'var(--tg-theme-button-color)'
                  }}>
                  {language === 'ru' ? 'АКЦИЯ' : 'PROMO'}
                </span>
                {daysLeft <= 3 && daysLeft > 0 && (
                  <span className="px-2 py-1 bg-sakura-accent/10 text-sakura-accent text-xs font-semibold rounded-full animate-pulse">
                    🔥 {language === 'ru' ? 'Скоро закончится!' : 'Ending soon!'}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold">{promotion.title}</h2>
            </div>

            {/* Скидка/Выгода */}
            <div className="flex items-center gap-4 bg-gradient-to-r from-sakura-cream to-sakura-surface border border-sakura-border/30 rounded-2xl p-4">
              <div className="w-14 h-14 bg-sakura-accent rounded-full flex items-center justify-center text-white text-2xl">
                🎁
              </div>
              <div className="flex-1">
                <p className="text-xs text-sakura-mid uppercase tracking-wide font-medium">
                  {language === 'ru' ? 'Ваша выгода' : 'Your benefit'}
                </p>
                <p className="text-2xl font-bold text-sakura-mid">
                  {promotion.discount_value || (promotion.service_price ? `$${promotion.service_price}` : (language === 'ru' ? 'Бесплатно' : 'Free'))}
                </p>
              </div>
            </div>

            {/* Описание */}
            {promotion.description && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {promotion.description}
              </p>
            )}

            {/* Срок действия */}
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }}>
                ⏰
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--tg-theme-text-color)' }}>
                  {language === 'ru' ? 'До' : 'Until'} {new Date(promotion.end_date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
                    day: 'numeric',
                    month: 'long'
                  })}
                </p>
                {daysLeft > 0 && (
                  <p className="text-xs">
                    {language === 'ru'
                      ? `Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
                      : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
                  </p>
                )}
              </div>
            </div>

            {/* Разделитель */}
            <div className="pt-5" style={{ borderTop: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4"
                style={{ color: 'var(--tg-theme-hint-color)' }}>
                {language === 'ru' ? '📱 Как использовать' : '📱 How to use'}
              </h3>

              {/* Главная кнопка - Показать партнёру */}
              <button
                onClick={() => {
                  if (!tierLocked) {
                    handleActivatePromotion()
                    hapticFeedback('medium')
                  }
                }}
                disabled={isQrLoading || !chatId || tierLocked}
                className="w-full py-4 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{
                  backgroundColor: tierLocked ? 'color-mix(in srgb, var(--tg-theme-hint-color) 30%, transparent)' : 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)'
                }}
              >
                {isQrLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {language === 'ru' ? 'Генерируем...' : 'Generating...'}
                  </span>
                ) : tierLocked ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-2xl">🔒</span>
                    {language === 'ru' ? 'Доступно от' : 'Available from'} {TIER_LABELS[promotion.min_tier]}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-2xl">📱</span>
                    {language === 'ru' ? 'ПОКАЗАТЬ ПАРТНЁРУ' : 'SHOW TO PARTNER'}
                  </span>
                )}
              </button>

              {tierLocked && (
                <TierProgressBar
                  currentBalance={balance}
                  currentTier={userTier}
                  requiredTier={promotion.min_tier}
                  language={language}
                />
              )}

              <p className="text-xs text-center mt-2" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {language === 'ru'
                  ? 'Партнёр сканирует ваш QR и применяет скидку'
                  : 'Partner scans your QR and applies discount'}
              </p>
            </div>

            {/* Оплата баллами (если доступна и не заблокировано по тиру) */}
            {promotion.max_points_payment && promotion.max_points_payment > 0 && balance > 0 && !tierLocked && (
              <div className="pt-5" style={{ borderTop: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--tg-theme-hint-color)' }}>
                    {language === 'ru' ? '💸 Оплатить баллами' : '💸 Pay with points'}
                  </h3>
                  <span className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                    {language === 'ru' ? `до $${promotion.max_points_payment}` : `up to $${promotion.max_points_payment}`}
                  </span>
                </div>

                {/* Быстрый выбор баллов */}
                <div className="flex gap-2 mb-3">
                  {quickPointsOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setPointsToSpend(opt.value)
                        hapticFeedback('light')
                      }}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold"
                      style={pointsToSpend === opt.value
                        ? { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
                        : { backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)', color: 'var(--tg-theme-text-color)', border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)' }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Ручной ввод */}
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="number"
                    min="0"
                    max={maxPointsAvailable}
                    value={pointsToSpend}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxPointsAvailable))
                      setPointsToSpend(value)
                    }}
                    className="flex-1 px-4 py-3 rounded-xl text-center text-lg font-semibold focus:outline-none"
                    style={{
                      backgroundColor: 'var(--tg-theme-bg-color)',
                      color: 'var(--tg-theme-text-color)',
                      border: '2px solid color-mix(in srgb, var(--tg-theme-hint-color) 25%, transparent)'
                    }}
                    placeholder="0"
                  />
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
                      = ${(pointsToSpend * pointsRate).toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600">
                      {language === 'ru' ? 'экономия' : 'savings'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePayWithPoints}
                  disabled={isRedeeming || pointsToSpend <= 0 || pointsToSpend > balance || !chatId}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRedeeming ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </span>
                  ) : (
                    <span>
                      💸 {language === 'ru'
                        ? `Оплатить ${pointsToSpend} баллов`
                        : `Pay ${pointsToSpend} points`}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* QR код (если сгенерирован) */}
            {qrImage && (
              <div
                className="rounded-2xl p-6 shadow-lg cursor-pointer"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
                }}
                onClick={() => {
                  setShowFullScreenQr(true)
                  hapticFeedback('medium')
                }}
              >
                <div className="flex flex-col items-center gap-4">
                  <img src={qrImage} alt="QR Code" className="w-40 h-40 object-contain" />

                  {redeemData ? (
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
                        -{redeemData.points_to_spend} {language === 'ru' ? 'баллов' : 'points'}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
                        = ${redeemData.points_value_usd?.toFixed(2)}
                        {redeemData.cash_payment > 0 && (
                          <span> + ${redeemData.cash_payment.toFixed(2)} {language === 'ru' ? 'наличными' : 'cash'}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-center" style={{ color: 'var(--tg-theme-hint-color)' }}>
                      {language === 'ru' ? 'Покажите мастеру' : 'Show to specialist'}
                    </p>
                  )}

                  <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)',
                      color: 'var(--tg-theme-text-color)'
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                    {language === 'ru' ? 'На весь экран' : 'Full screen'}
                  </button>
                </div>
              </div>
            )}

            {/* Ошибка */}
            {qrError && (
              <div className="text-sm text-red-500 bg-red-100/60 border border-red-200 rounded-2xl p-3">
                {qrError}
              </div>
            )}

            {/* Дополнительные кнопки */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleShowLocation}
                className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)',
                  color: 'var(--tg-theme-text-color)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
                }}
              >
                📍 {language === 'ru' ? 'На карте' : 'Map'}
              </button>

              <button
                onClick={handleBookTime}
                disabled={!promotion.booking_url && !promotion.partner?.booking_url}
                className="flex-1 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)'
                }}
              >
                📅 {language === 'ru' ? 'Записаться' : 'Book'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default PromotionDetail
