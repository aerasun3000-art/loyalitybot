/**
 * HeaderModule - Заголовок страницы партнёра
 * 
 * Отображает:
 * - Название компании/партнёра
 * - Рейтинг и количество отзывов
 * - Категорию/тип бизнеса
 * - Расстояние до партнёра (если доступно)
 */

import { getCategoryByCode } from '../../utils/serviceIcons'
import useLanguageStore from '../../store/languageStore'

const HeaderModule = ({ 
  partner, 
  rating,
  reviewsCount,
  distance,
  showCategory = true 
}) => {
  const { language } = useLanguageStore()
  
  // Название
  const name = partner?.company_name || partner?.name || 'Partner'
  
  // Категория
  const categoryCode = partner?.business_type || partner?.category_group
  const categoryData = categoryCode ? getCategoryByCode(categoryCode) : null
  const categoryName = categoryData 
    ? (language === 'ru' ? categoryData.name : categoryData.nameEn) 
    : null
  const categoryEmoji = categoryData?.emoji || '💼'
  
  // Рейтинг
  const displayRating = rating || partner?.rating || 0
  const displayReviews = reviewsCount || partner?.reviews_count || 0
  
  // Форматирование расстояния
  const formatDistance = (dist) => {
    if (!dist) return null
    if (dist < 1) {
      return `${Math.round(dist * 1000)} м`
    }
    return `${dist.toFixed(1)} км`
  }

  return (
    <div className="px-4 py-4 bg-white">
      {/* Название */}
      <h1 className="text-2xl font-bold text-gray-900 leading-tight">
        {name}
      </h1>
      
      {/* Мета-информация */}
      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
        {/* Рейтинг */}
        {displayRating > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">⭐</span>
            <span className="font-medium text-gray-900">{displayRating.toFixed(1)}</span>
            {displayReviews > 0 && (
              <span className="text-gray-500">({displayReviews})</span>
            )}
          </div>
        )}
        
        {/* Разделитель */}
        {displayRating > 0 && (showCategory || distance) && (
          <span className="text-gray-300">•</span>
        )}
        
        {/* Категория */}
        {showCategory && categoryName && (
          <div className="flex items-center gap-1">
            <span>{categoryEmoji}</span>
            <span>{categoryName}</span>
          </div>
        )}
        
        {/* Разделитель */}
        {showCategory && categoryName && distance && (
          <span className="text-gray-300">•</span>
        )}
        
        {/* Расстояние */}
        {distance && (
          <div className="flex items-center gap-1">
            <span>📍</span>
            <span>{formatDistance(distance)}</span>
          </div>
        )}
      </div>
      
      {/* Работает онлайн badge */}
      {partner?.work_mode === 'online' && (
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            🌐 {language === 'ru' ? 'Работает онлайн' : 'Works online'}
          </span>
        </div>
      )}
      
      {/* Гибридный режим */}
      {partner?.work_mode === 'hybrid' && (
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            🌐 {language === 'ru' ? 'Онлайн + офлайн' : 'Online + offline'}
          </span>
        </div>
      )}
    </div>
  )
}

export default HeaderModule
