/**
 * CatalogTemplate - Шаблон страницы партнёра для каталога товаров/услуг
 * 
 * Используется для: retail, services, travel, automotive
 * 
 * Модули:
 * - HeroModule (обязательный)
 * - HeaderModule (обязательный)
 * - ServicesModule (обязательный) - отображает товары/услуги
 * - AboutModule (опциональный)
 * - LocationModule (обязательный)
 * - CTAFooterModule (обязательный)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HeroModule,
  HeaderModule,
  ServicesModule,
  LocationModule,
  CTAFooterModule
} from '../modules'
import { getModuleConfig } from '../../utils/templateConfig'
import { hapticFeedback } from '../../utils/telegram'
import useLanguageStore from '../../store/languageStore'

const CatalogTemplate = ({ 
  partner, 
  services = [],
  rating,
  reviewsCount,
  distance
}) => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const [isAboutExpanded, setIsAboutExpanded] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  
  // Получаем конфигурацию модулей
  const config = getModuleConfig(partner?.category_group, partner?.ui_config)
  
  // Описание партнёра
  const description = partner?.description || partner?.about
  
  // Обработка выбора товара/услуги
  const handleServiceSelect = (service) => {
    hapticFeedback('light')
    setSelectedService(service)
    // Можно добавить логику открытия детальной карточки
  }
  
  // Обработка кнопки "Назад"
  const handleBack = () => {
    hapticFeedback('light')
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero изображение (меньше для каталога) */}
      <HeroModule 
        partner={partner}
        height="25vh"
        showBackButton={true}
        onBack={handleBack}
      />
      
      {/* Заголовок */}
      <div className="-mt-6 relative z-10">
        <div className="bg-white rounded-t-3xl">
          <HeaderModule 
            partner={partner}
            rating={rating}
            reviewsCount={reviewsCount}
            distance={distance}
            showCategory={true}
          />
        </div>
      </div>
      
      {/* О компании (если включен модуль и есть описание) */}
      {config.modules.about && description && (
        <div className="bg-white px-4 py-4 border-t border-gray-100">
          <button
            onClick={() => {
              hapticFeedback('light')
              setIsAboutExpanded(!isAboutExpanded)
            }}
            className="flex items-center justify-between w-full"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              ℹ️ {language === 'ru' ? 'О компании' : 'About'}
            </h2>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isAboutExpanded ? 'rotate-180' : ''
              }`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 9l-7 7-7-7" 
              />
            </svg>
          </button>
          
          {isAboutExpanded && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Разделитель */}
      <div className="h-2 bg-gray-100" />
      
      {/* Каталог товаров/услуг */}
      <ServicesModule 
        services={services}
        partner={partner}
        onServiceSelect={handleServiceSelect}
        selectedServiceId={selectedService?.id}
        showDuration={false} // Для каталога обычно не нужна длительность
        showImage={true}
        showTags={config.modules.tags}
      />
      
      {/* Локация и контакты */}
      <div className="h-2 bg-gray-100" />
      <LocationModule 
        partner={partner}
        showMap={true}
        showWorkingHours={true}
        showContacts={true}
      />
      
      {/* Sticky CTA кнопка */}
      <CTAFooterModule 
        action={config.cta.primary}
        partner={partner}
        secondaryAction={config.cta.secondary}
        secondaryUrl={partner?.website}
      />
      
      {/* Модалка детали товара (опционально) */}
      {selectedService && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setSelectedService(null)}
        >
          <div 
            className="w-full bg-white rounded-t-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Изображение */}
            {selectedService.image_url && (
              <div className="h-48 overflow-hidden">
                <img
                  src={selectedService.image_url}
                  alt={selectedService.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* Контент */}
            <div className="p-4">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedService.title}
              </h3>
              
              {selectedService.description && (
                <p className="mt-2 text-gray-600">
                  {selectedService.description}
                </p>
              )}
              
              {/* Теги */}
              {selectedService.tags && selectedService.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedService.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                    >
                      {tag.emoji} {language === 'ru' ? tag.name_ru : tag.name_en}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Цена и статус */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ${selectedService.price_local || selectedService.price || 0}
                  </p>
                  <p className="text-sm text-green-600">
                    ✅ {language === 'ru' ? 'В наличии' : 'In stock'}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    hapticFeedback('medium')
                    // Связаться по поводу товара
                    const username = partner?.username
                    if (username) {
                      window.open(`https://t.me/${username.replace('@', '')}?text=${encodeURIComponent(selectedService.title)}`, '_blank')
                    }
                    setSelectedService(null)
                  }}
                  className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-sakura-accent to-sakura-dark"
                >
                  💬 {language === 'ru' ? 'Связаться' : 'Contact'}
                </button>
              </div>
            </div>
            
            {/* Кнопка закрытия */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setSelectedService(null)}
                className="w-full py-3 rounded-xl font-medium bg-gray-100 text-gray-700"
              >
                {language === 'ru' ? 'Закрыть' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CatalogTemplate
