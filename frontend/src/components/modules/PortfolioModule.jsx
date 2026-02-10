/**
 * PortfolioModule - Галерея фото работ партнёра
 * 
 * Отображает:
 * - Сетку фотографий (2 колонки)
 * - Модалку просмотра фото
 * - Возможность свайпа между фото
 */

import { useState, useEffect } from 'react'
import useLanguageStore from '../../store/languageStore'
import { hapticFeedback } from '../../utils/telegram'
import { supabase } from '../../services/supabase'

const PortfolioModule = ({ 
  partnerId,
  photos: propPhotos,
  maxVisible = 4,
  title
}) => {
  const { language } = useLanguageStore()
  const [photos, setPhotos] = useState(propPhotos || [])
  const [loading, setLoading] = useState(!propPhotos)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null)
  const [showAll, setShowAll] = useState(false)
  
  // Загрузка фото, если не переданы через props
  useEffect(() => {
    if (!propPhotos && partnerId) {
      loadPhotos()
    }
  }, [partnerId, propPhotos])
  
  const loadPhotos = async () => {
    try {
      setLoading(true)
      // TODO: Когда будет таблица portfolio_photos
      // const { data, error } = await supabase
      //   .from('portfolio_photos')
      //   .select('*')
      //   .eq('partner_chat_id', partnerId)
      //   .order('created_at', { ascending: false })
      
      // Пока используем заглушку
      setPhotos([])
    } catch (error) {
      console.error('Error loading portfolio:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handlePhotoClick = (index) => {
    hapticFeedback('light')
    setSelectedPhotoIndex(index)
  }
  
  const handleCloseModal = () => {
    setSelectedPhotoIndex(null)
  }
  
  const handlePrevPhoto = (e) => {
    e.stopPropagation()
    hapticFeedback('light')
    setSelectedPhotoIndex((prev) => 
      prev > 0 ? prev - 1 : photos.length - 1
    )
  }
  
  const handleNextPhoto = (e) => {
    e.stopPropagation()
    hapticFeedback('light')
    setSelectedPhotoIndex((prev) => 
      prev < photos.length - 1 ? prev + 1 : 0
    )
  }
  
  const handleShowAll = () => {
    hapticFeedback('light')
    setShowAll(true)
  }
  
  // Placeholder при загрузке
  if (loading) {
    return (
      <div className="bg-sakura-surface px-4 py-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          🖼️ {title || (language === 'ru' ? 'Портфолио' : 'Portfolio')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i}
              className="aspect-square rounded-lg bg-sakura-cream animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }
  
  // Не показываем, если нет фото
  if (photos.length === 0) {
    return null
  }
  
  // Фото для отображения
  const visiblePhotos = showAll ? photos : photos.slice(0, maxVisible)
  const hiddenCount = photos.length - maxVisible

  return (
    <div className="bg-sakura-surface px-4 py-4">
      {/* Заголовок секции */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        🖼️ {title || (language === 'ru' ? 'Портфолио' : 'Portfolio')}
      </h2>
      
      {/* Сетка фото */}
      <div className="grid grid-cols-2 gap-2">
        {visiblePhotos.map((photo, index) => (
          <div
            key={photo.id || index}
            className="relative aspect-square rounded-lg overflow-hidden bg-sakura-cream cursor-pointer"
            onClick={() => handlePhotoClick(index)}
          >
            <img
              src={photo.url || photo.image_url}
              alt={photo.description || `Photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
            
            {/* Оверлей "Ещё N фото" на последнем */}
            {!showAll && index === maxVisible - 1 && hiddenCount > 0 && (
              <div 
                className="absolute inset-0 bg-black/50 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  handleShowAll()
                }}
              >
                <span className="text-white text-lg font-semibold">
                  +{hiddenCount}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Модалка просмотра */}
      {selectedPhotoIndex !== null && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={handleCloseModal}
        >
          {/* Кнопка закрытия */}
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white z-10"
            onClick={handleCloseModal}
          >
            ✕
          </button>
          
          {/* Фото */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={photos[selectedPhotoIndex]?.url || photos[selectedPhotoIndex]?.image_url}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>
          
          {/* Навигация */}
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white text-2xl"
                onClick={handlePrevPhoto}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white text-2xl"
                onClick={handleNextPhoto}
              >
                ›
              </button>
            </>
          )}
          
          {/* Счётчик */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 rounded-full text-white text-sm">
            {selectedPhotoIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  )
}

export default PortfolioModule
