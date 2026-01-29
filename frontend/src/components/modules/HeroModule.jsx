/**
 * HeroModule - Главное изображение/видео партнёра
 * 
 * Отображает:
 * - Обложку партнёра (фото или видео)
 * - Градиент для читаемости текста
 * - Кнопку "назад" (опционально)
 */

import { useState } from 'react'

const HeroModule = ({ 
  partner, 
  height = '40vh',
  showBackButton = true,
  onBack,
  children // для оверлей-контента
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  // Получаем URL изображения
  const imageUrl = partner?.hero_image_url || partner?.image_url || partner?.photo_url
  
  // Placeholder с градиентом, если нет изображения
  const placeholderGradient = 'linear-gradient(135deg, #f5e6d3 0%, #e8d4c4 50%, #d4c4b0 100%)'
  
  const handleImageLoad = () => {
    setImageLoaded(true)
  }
  
  const handleImageError = () => {
    setImageError(true)
    setImageLoaded(true)
  }

  return (
    <div 
      className="relative w-full overflow-hidden"
      style={{ height }}
    >
      {/* Фоновое изображение или плейсхолдер */}
      {imageUrl && !imageError ? (
        <>
          {/* Skeleton loader */}
          {!imageLoaded && (
            <div 
              className="absolute inset-0 animate-pulse"
              style={{ background: placeholderGradient }}
            />
          )}
          <img
            src={imageUrl}
            alt={partner?.company_name || partner?.name || 'Partner'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="eager"
          />
        </>
      ) : (
        // Placeholder gradient
        <div 
          className="absolute inset-0"
          style={{ background: placeholderGradient }}
        >
          {/* Декоративный паттерн */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/20" />
            <div className="absolute bottom-1/3 right-1/4 w-24 h-24 rounded-full bg-white/15" />
          </div>
        </div>
      )}
      
      {/* Градиент для читаемости */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)'
        }}
      />
      
      {/* Кнопка назад */}
      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center transition-transform active:scale-95"
          aria-label="Go back"
        >
          <svg 
            className="w-5 h-5 text-gray-700" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
        </button>
      )}
      
      {/* Слот для дополнительного контента (например, кнопка share) */}
      {children}
    </div>
  )
}

export default HeroModule
