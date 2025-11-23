import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPromotionById } from '../services/supabase'
import { getChatId, hapticFeedback, showAlert } from '../utils/telegram'
import Loader from '../components/Loader'
import QRCode from 'qrcode'

const PromotionDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [promotion, setPromotion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isQrLoading, setIsQrLoading] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrError, setQrError] = useState(null)
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
      // ID акции - это UUID (строка), передаем его как есть
      const promoData = await getPromotionById(id)
      
      if (!promoData) {
        console.log('No promotion data, redirecting to /promotions')
        navigate('/promotions')
        return
      }
      
      setPromotion(promoData)
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

      // QR код содержит только chat_id
      const qrPayload = chatId
      const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 })
      setQrImage(dataUrl)
    } catch (error) {
      console.error('Error generating promotion QR:', error)
      setQrError('Не удалось сгенерировать QR-код. Попробуйте позже.')
    } finally {
      setIsQrLoading(false)
    }
  }

  const handleBookTime = () => {
    if (!promotion) {
      return
    }

    const bookingUrl = promotion.partner?.booking_url
    
    if (!bookingUrl) {
      showAlert('Ссылка на бронирование не указана для этой акции.')
      return
    }

    // Открываем ссылку в новой вкладке
    window.open(bookingUrl, '_blank')
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
          {promotion.partner?.company_name || promotion.partner?.name || 'Акции'}
        </span>
      </div>

      {/* Карточка акции - похожа на карточку услуги */}
      <div className="px-4 py-6">
        <div className="bg-sakura-surface/85 border border-sakura-border/60 rounded-3xl shadow-2xl p-6">
          <div className="space-y-4 text-sakura-dark pb-8">
            <div>
              <p className="text-sm text-sakura-dark/60 mb-1 uppercase tracking-wide">Акция</p>
              <h2 className="text-xl font-bold">{promotion.title}</h2>
              {promotion.partner?.company_name && (
                <p className="text-sm text-sakura-dark/70 mt-1">{promotion.partner.company_name}</p>
              )}
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
              <div>
                <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">Скидка / Стоимость</p>
                <p className="text-lg font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  {promotion.discount_value || (promotion.required_points > 0 ? `${promotion.required_points} баллов` : 'Бесплатно')}
                </p>
              </div>
            </div>

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
                onClick={handleBookTime}
                disabled={!promotion.partner?.booking_url}
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
                <img src={qrImage} alt="QR для активации" className="w-48 h-48 object-contain" />
                <p className="text-xs text-sakura-dark/70 text-center px-2">
                  Покажите этот QR специалисту чтобы начислить или списать баллы
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromotionDetail

