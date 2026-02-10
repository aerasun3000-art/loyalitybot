/**
 * LocationModule - Локация и контакты партнёра
 * 
 * Отображает:
 * - Адрес
 * - Мини-карту (ссылка на Google Maps)
 * - Часы работы
 * - Контактные кнопки
 */

import useLanguageStore from '../../store/languageStore'
import { hapticFeedback } from '../../utils/telegram'

const LocationModule = ({ 
  partner,
  showMap = true,
  showWorkingHours = true,
  showContacts = true
}) => {
  const { language } = useLanguageStore()
  
  // Данные партнёра
  const address = partner?.address || partner?.google_maps_link
  const city = partner?.city
  const district = partner?.district
  const phone = partner?.phone
  const username = partner?.username
  const googleMapsLink = partner?.google_maps_link
  const workingHours = partner?.working_hours
  
  // Форматирование адреса
  const formatAddress = () => {
    const parts = []
    if (address && !address.startsWith('http')) {
      parts.push(address)
    }
    if (district) parts.push(district)
    if (city) parts.push(city)
    return parts.join(', ') || null
  }
  
  const displayAddress = formatAddress()
  
  // Открыть карту
  const handleOpenMap = () => {
    hapticFeedback('light')
    if (googleMapsLink) {
      window.open(googleMapsLink, '_blank')
    } else if (displayAddress) {
      const query = encodeURIComponent(displayAddress)
      window.open(`https://maps.google.com/maps?q=${query}`, '_blank')
    }
  }
  
  // Позвонить
  const handleCall = () => {
    hapticFeedback('medium')
    if (phone) {
      window.open(`tel:${phone}`, '_self')
    }
  }
  
  // Написать в Telegram
  const handleMessage = () => {
    hapticFeedback('medium')
    if (username) {
      window.open(`https://t.me/${username.replace('@', '')}`, '_blank')
    }
  }
  
  // Проверка, есть ли что показывать
  const hasLocation = displayAddress || googleMapsLink
  const hasContacts = phone || username
  
  if (!hasLocation && !hasContacts && !workingHours) {
    return null
  }

  return (
    <div className="bg-sakura-surface px-4 py-4">
      {/* Заголовок секции */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        📍 {language === 'ru' ? 'Локация и контакты' : 'Location & Contacts'}
      </h2>
      
      {/* Карта / адрес */}
      {hasLocation && (
        <div 
          className="mb-4 cursor-pointer"
          onClick={handleOpenMap}
        >
          {/* Мини-карта placeholder */}
          {showMap && (
            <div className="relative h-32 rounded-xl overflow-hidden bg-gradient-to-br from-sakura-cream to-sakura-surface mb-3">
              {/* Декоративная карта */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-4xl">🗺️</div>
              </div>
              {/* Overlay с призывом */}
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <span className="px-3 py-1.5 bg-sakura-cream/95 rounded-full text-sm font-medium text-sakura-deep shadow-sm">
                  {language === 'ru' ? 'Открыть карту' : 'Open map'} →
                </span>
              </div>
            </div>
          )}
          
          {/* Адрес */}
          {displayAddress && (
            <div className="flex items-start gap-2 text-gray-700">
              <span className="text-lg">📍</span>
              <span className="text-sm leading-relaxed">{displayAddress}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Часы работы */}
      {showWorkingHours && workingHours && (
        <div className="flex items-start gap-2 mb-4 text-gray-700">
          <span className="text-lg">🕐</span>
          <span className="text-sm">{workingHours}</span>
        </div>
      )}
      
      {/* Работает онлайн (если нет физического адреса) */}
      {!hasLocation && partner?.work_mode === 'online' && (
        <div className="flex items-start gap-2 mb-4 text-gray-700">
          <span className="text-lg">🌐</span>
          <span className="text-sm">
            {language === 'ru' ? 'Работает онлайн по всему миру' : 'Works online worldwide'}
          </span>
        </div>
      )}
      
      {/* Контактные кнопки */}
      {showContacts && hasContacts && (
        <div className="flex gap-3 mt-4">
          {/* Написать */}
          {username && (
            <button
              onClick={handleMessage}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sakura-cream text-sakura-deep font-medium transition-colors active:bg-sakura-cream/80"
            >
              <span>💬</span>
              <span>{language === 'ru' ? 'Написать' : 'Message'}</span>
            </button>
          )}
          
          {/* Позвонить */}
          {phone && (
            <button
              onClick={handleCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sakura-cream text-sakura-deep font-medium transition-colors active:bg-sakura-cream/80"
            >
              <span>📞</span>
              <span>{language === 'ru' ? 'Позвонить' : 'Call'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default LocationModule
