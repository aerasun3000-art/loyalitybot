import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPromotionById, getClientBalance, redeemPromotion } from '../services/supabase'
import { getChatId, hapticFeedback, showAlert } from '../utils/telegram'
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
  const [pointsToSpend, setPointsToSpend] = useState(0)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redeemData, setRedeemData] = useState(null)
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
      // ID акции - это число, конвертируем
      const promoId = parseInt(id)
      if (isNaN(promoId)) {
        navigate('/promotions')
        return
      }
      
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
      setBalance(balanceData?.balance || 0)
      
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

      const promoId = parseInt(id)
      const result = await redeemPromotion(chatId, promoId, pointsToSpend)

      if (result.success) {
        setRedeemData(result)
        
        // Генерируем QR-код с данными об акции и оплате баллами
        const qrPayload = result.qr_data
        const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 })
        setQrImage(dataUrl)
        
        // Обновляем баланс
        setBalance(result.current_balance)
        
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl leading-none mx-auto mb-4 text-jewelry-gray-elegant">⚠️</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Акция не найдена</h2>
          <button
            onClick={handleBack}
            className="text-jewelry-gold font-semibold"
          >
            ← Назад к акциям
          </button>
        </div>
      </div>
    )
  }

  const daysLeft = getDaysRemaining(promotion.end_date)

  return (
    <div className="min-h-screen bg-sakura-surface/10 pb-24">
      {/* Шапка с кнопкой назад */}
      <div className="px-4 pt-6 pb-4 flex items-center bg-sakura-surface/85 border-b border-sakura-border/40">
        <button
          onClick={handleBack}
          className="text-sakura-dark mr-3 p-2 -ml-2"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sakura-dark font-semibold">
          {promotion.partner?.company_name || promotion.partner?.name || t('partner_not_connected')}
        </span>
      </div>

      {/* Карточка акции - похожа на карточку услуги */}
      <div className="px-4 py-6">
        <div className="bg-sakura-surface/85 border border-sakura-border/60 rounded-3xl shadow-2xl p-6">
          <div className="space-y-4 text-sakura-dark pb-8">
            <div>
              <p className="text-sm text-sakura-dark/60 mb-1 uppercase tracking-wide">Акция</p>
              <h2 className="text-xl font-bold">{promotion.title}</h2>
              <p className="text-sm text-sakura-dark/70 mt-1">
                {promotion.partner?.company_name || promotion.partner?.name || t('partner_not_connected')}
              </p>
            </div>

            {/* Изображение акции */}
            {promotion.image_url && (
              <div className="rounded-2xl overflow-hidden mb-4">
                <img
                  src={promotion.image_url}
                  alt={promotion.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {promotion.description && (
              <p className="text-sm text-sakura-dark/80 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                {promotion.description}
              </p>
            )}

            {/* Информация о стоимости/скидке */}
            <div className="flex items-center gap-3 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
              <span className="text-2xl">🎁</span>
              <div className="flex-1">
                <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">Скидка / Стоимость</p>
                <p className="text-lg font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  {promotion.discount_value || (promotion.service_price ? `$${promotion.service_price}` : (promotion.required_points > 0 ? `${promotion.required_points} баллов` : 'Бесплатно'))}
                </p>
              </div>
            </div>

            {/* Оплата баллами (если доступна) */}
            {promotion.max_points_payment && promotion.max_points_payment > 0 && (
              <div className="bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">💸</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-sakura-dark">
                      {language === 'ru' ? 'Оплата баллами' : 'Pay with points'}
                    </p>
                    <p className="text-xs text-sakura-dark/60">
                      {language === 'ru' 
                        ? `Можно оплатить до $${promotion.max_points_payment} баллами`
                        : `You can pay up to $${promotion.max_points_payment} with points`}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-sakura-dark/80">
                      {language === 'ru' ? 'Количество баллов:' : 'Points amount:'}
                    </label>
                    <span className="text-sm text-sakura-dark/60">
                      {language === 'ru' ? 'Баланс:' : 'Balance:'} <strong className={balance >= pointsToSpend ? 'text-green-600' : 'text-red-500'}>{balance}</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={Math.min(balance, Math.floor(promotion.max_points_payment / (promotion.points_to_dollar_rate || 1)))}
                    value={pointsToSpend}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(parseInt(e.target.value) || 0, balance, Math.floor(promotion.max_points_payment / (promotion.points_to_dollar_rate || 1))))
                      setPointsToSpend(value)
                    }}
                    className="w-full px-4 py-2 rounded-xl border-2 border-sakura-border/40 bg-white/50 text-sakura-dark focus:border-sakura-mid focus:outline-none"
                    placeholder="0"
                  />
                  {pointsToSpend > 0 && (
                    <p className="text-xs text-sakura-dark/60">
                      {language === 'ru' 
                        ? `= $${(pointsToSpend * (promotion.points_to_dollar_rate || 1)).toFixed(2)}`
                        : `= $${(pointsToSpend * (promotion.points_to_dollar_rate || 1)).toFixed(2)}`}
                      {promotion.service_price && (
                        <span className="ml-2">
                          {language === 'ru' 
                            ? `, доплата: $${(promotion.service_price - pointsToSpend * (promotion.points_to_dollar_rate || 1)).toFixed(2)}`
                            : `, cash payment: $${(promotion.service_price - pointsToSpend * (promotion.points_to_dollar_rate || 1)).toFixed(2)}`}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={handlePayWithPoints}
                  disabled={isRedeeming || pointsToSpend <= 0 || pointsToSpend > balance || !chatId}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-sakura-mid to-sakura-dark text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRedeeming ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {language === 'ru' ? 'Подготавливаем...' : 'Preparing...'}
                    </span>
                  ) : (
                    <span>
                      {language === 'ru' 
                        ? `💸 Оплатить ${pointsToSpend} баллов`
                        : `💸 Pay ${pointsToSpend} points`}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Дополнительная информация */}
            {promotion.required_points > 0 && (
              <div className="flex items-center gap-3 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">Требуется баллов</p>
                  <p className="text-lg font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                    {promotion.required_points}
                  </p>
                </div>
              </div>
            )}

            {/* Срок действия */}
            <div className="flex items-center gap-2 text-sakura-dark/70 text-sm bg-sakura-surface/10 border border-sakura-border/20 rounded-2xl p-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
                <path d="M8 4v4.5l3.5 2.1.7-1.2-3-1.8V4z"/>
              </svg>
              <span>
                Действует до {new Date(promotion.end_date).toLocaleDateString('ru', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
                {daysLeft > 0 && ` (осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})`}
              </span>
            </div>

            {/* Кнопки активации акции и бронирования */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleActivatePromotion}
                disabled={isQrLoading}
                className="w-full py-3 rounded-full bg-sakura-accent text-white font-semibold shadow-md hover:bg-sakura-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isQrLoading ? 'Генерируем QR...' : 'Активировать акцию'}
              </button>

              <button
                onClick={handleShowLocation}
                className="w-full py-3 rounded-full bg-white text-sakura-dark font-semibold shadow-md border border-sakura-border hover:bg-sakura-surface transition-colors"
              >
                {language === 'ru' ? '📍 Показать на карте' : '📍 Show on Map'}
              </button>

              <button
                onClick={handleBookTime}
                disabled={!promotion.booking_url && !promotion.partner?.booking_url}
                className="w-full py-3 rounded-full bg-sakura-deep text-white font-semibold shadow-md hover:bg-sakura-deep/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Забронировать время
              </button>
            </div>

            {/* Ошибка генерации QR */}
            {qrError && (
              <div className="text-sm text-red-500 bg-red-100/60 border border-red-200 rounded-2xl p-3">
                {qrError}
              </div>
            )}

            {/* QR код */}
            {qrImage && (
              <div className="flex flex-col items-center gap-3 bg-white/90 border border-sakura-border/40 rounded-3xl p-4 mb-8 pb-8">
                <img src={qrImage} alt="QR для оплаты" className="w-48 h-48 object-contain" />
                {redeemData ? (
                  <>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-sakura-dark">
                        {language === 'ru' ? 'Оплата баллами' : 'Pay with points'}
                      </p>
                      <p className="text-xs text-sakura-dark/70">
                        {language === 'ru' 
                          ? `Списать ${redeemData.points_to_spend} баллов ($${redeemData.points_value_usd?.toFixed(2)})`
                          : `Spend ${redeemData.points_to_spend} points ($${redeemData.points_value_usd?.toFixed(2)})`}
                      </p>
                      {redeemData.cash_payment > 0 && (
                        <p className="text-xs text-sakura-dark/70 font-semibold">
                          {language === 'ru' 
                            ? `Доплата наличными: $${redeemData.cash_payment.toFixed(2)}`
                            : `Cash payment: $${redeemData.cash_payment.toFixed(2)}`}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-sakura-dark/60 text-center px-2 mt-2">
                      {language === 'ru' 
                        ? 'Покажите QR-код мастеру. Мастер списывает баллы и начисляет новые за покупку.'
                        : 'Show QR code to master. Master will deduct points and award new points for purchase.'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-sakura-dark/70 text-center px-2">
                    {language === 'ru' 
                      ? 'Покажите этот QR специалисту чтобы начислить или списать баллы'
                      : 'Show this QR to specialist to add or deduct points'}
                  </p>
                )}
                {chatId && (
                  <p className="text-xs text-sakura-dark/50 text-center px-2 font-mono">
                    ID: {chatId}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromotionDetail

