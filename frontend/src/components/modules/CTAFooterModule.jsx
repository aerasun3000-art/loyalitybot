/**
 * CTAFooterModule - Sticky кнопка действия внизу экрана
 * 
 * Поддерживает типы действий:
 * - external_booking — переход на внешний сервис бронирования
 * - qr_order — показать QR-код с заказом
 * - contact — написать в чат
 */

import { useState } from 'react'
import useLanguageStore from '../../store/languageStore'
import { hapticFeedback } from '../../utils/telegram'
import { getCTALabel } from '../../utils/templateConfig'

const CTAFooterModule = ({ 
  action = 'contact',
  url,
  partner,
  secondaryAction,
  secondaryUrl,
  onQRRequest,
  disabled = false
}) => {
  const { language } = useLanguageStore()
  const [isLoading, setIsLoading] = useState(false)
  
  // Получаем данные о действии
  const primaryCTA = getCTALabel(action, language)
  const secondaryCTA = secondaryAction ? getCTALabel(secondaryAction, language) : null
  
  // Обработка основного действия
  const handlePrimaryAction = async () => {
    if (disabled || isLoading) return
    hapticFeedback('medium')
    
    switch (primaryCTA.type) {
      case 'external':
        // Открываем внешнюю ссылку
        const externalUrl = url || partner?.booking_url
        if (externalUrl) {
          window.open(externalUrl, '_blank')
        }
        break
        
      case 'modal':
        // QR-код — вызываем колбэк
        if (onQRRequest) {
          setIsLoading(true)
          try {
            await onQRRequest()
          } finally {
            setIsLoading(false)
          }
        }
        break
        
      case 'telegram':
        // Открываем Telegram чат
        const username = partner?.username
        if (username) {
          window.open(`https://t.me/${username.replace('@', '')}`, '_blank')
        }
        break
        
      case 'action':
        // Написать — открываем Telegram
        const contactUsername = partner?.username
        if (contactUsername) {
          window.open(`https://t.me/${contactUsername.replace('@', '')}`, '_blank')
        }
        break
        
      case 'tel':
        // Звонок
        const phone = partner?.phone
        if (phone) {
          window.open(`tel:${phone}`, '_self')
        }
        break
        
      default:
        console.warn('Unknown CTA action type:', primaryCTA.type)
    }
  }
  
  // Обработка вторичного действия
  const handleSecondaryAction = () => {
    if (!secondaryCTA) return
    hapticFeedback('light')
    
    switch (secondaryCTA.type) {
      case 'external':
        const extUrl = secondaryUrl || partner?.booking_url || partner?.website
        if (extUrl) {
          window.open(extUrl, '_blank')
        }
        break
        
      case 'telegram':
        const username = partner?.username
        if (username) {
          window.open(`https://t.me/${username.replace('@', '')}`, '_blank')
        }
        break
        
      case 'tel':
        const phone = partner?.phone
        if (phone) {
          window.open(`tel:${phone}`, '_self')
        }
        break
        
      default:
        console.warn('Unknown secondary CTA type:', secondaryCTA.type)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 safe-area-bottom">
      <div className="flex gap-3 max-w-lg mx-auto">
        {/* Вторичная кнопка (если есть) */}
        {secondaryCTA && (
          <button
            onClick={handleSecondaryAction}
            className="flex-shrink-0 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gray-100 text-gray-700 font-medium transition-colors active:bg-gray-200"
          >
            <span>{secondaryCTA.icon}</span>
            <span className="hidden sm:inline">{secondaryCTA.label}</span>
          </button>
        )}
        
        {/* Основная кнопка */}
        <button
          onClick={handlePrimaryAction}
          disabled={disabled || isLoading}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-white transition-all active:scale-[0.98] ${
            disabled || isLoading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-sakura-accent to-sakura-dark shadow-lg shadow-sakura-accent/25'
          }`}
        >
          {isLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{language === 'ru' ? 'Загрузка...' : 'Loading...'}</span>
            </>
          ) : (
            <>
              <span>{primaryCTA.icon}</span>
              <span>{primaryCTA.label}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default CTAFooterModule
