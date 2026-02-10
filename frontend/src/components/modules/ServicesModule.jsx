/**
 * ServicesModule - Список услуг партнёра
 * 
 * Отображает:
 * - Список услуг с ценой и длительностью
 * - Фото услуги (если есть)
 * - Теги услуги
 * - Возможность выбора услуги
 */

import { useState, useMemo } from 'react'
import useLanguageStore from '../../store/languageStore'
import useCurrencyStore from '../../store/currencyStore'
import { formatPriceWithPoints } from '../../utils/currency'
import { useTranslation } from '../../utils/i18n'

const ServicesModule = ({ 
  services = [],
  partner,
  onServiceSelect,
  showDuration = true,
  showImage = true,
  showTags = true,
  selectedServiceId = null
}) => {
  const { language } = useLanguageStore()
  const { currency, rates } = useCurrencyStore()
  const { t } = useTranslation(language)
  const [expandedServiceId, setExpandedServiceId] = useState(null)
  
  // Сортировка услуг по display_order
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      const orderA = a.display_order ?? 999
      const orderB = b.display_order ?? 999
      return orderA - orderB
    })
  }, [services])
  
  // Форматирование длительности
  const formatDuration = (minutes) => {
    if (!minutes) return null
    if (minutes < 60) {
      return `${minutes} ${language === 'ru' ? 'мин' : 'min'}`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours} ${language === 'ru' ? 'ч' : 'h'}`
    }
    return `${hours} ${language === 'ru' ? 'ч' : 'h'} ${mins} ${language === 'ru' ? 'мин' : 'min'}`
  }
  
  const handleServiceClick = (service) => {
    if (onServiceSelect) {
      onServiceSelect(service)
    } else {
      // Toggle expand
      setExpandedServiceId(
        expandedServiceId === service.id ? null : service.id
      )
    }
  }
  
  if (sortedServices.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500">
        {language === 'ru' ? 'Услуги не найдены' : 'No services found'}
      </div>
    )
  }

  return (
    <div className="bg-sakura-surface">
      {/* Заголовок секции */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-gray-900">
          💼 {language === 'ru' ? 'Услуги' : 'Services'}
        </h2>
      </div>
      
      {/* Список услуг */}
      <div className="divide-y divide-sakura-border/20">
        {sortedServices.map((service) => {
          const isExpanded = expandedServiceId === service.id
          const isSelected = selectedServiceId === service.id
          const price = service.price_local || service.price || 0
          const duration = service.duration_minutes || service.duration
          
          return (
            <div 
              key={service.id}
              className="px-4 py-3"
              style={isSelected
                ? { backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)' }
                : {}
              }
              onClick={() => handleServiceClick(service)}
            >
              <div className="flex gap-3">
                {/* Фото услуги */}
                {showImage && service.image_url && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-sakura-cream">
                    <img
                      src={service.image_url}
                      alt={service.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                
                {/* Информация об услуге */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    {/* Название */}
                    <h3 className="font-medium text-gray-900 leading-tight">
                      {service.title}
                    </h3>
                    
                    {/* Стрелка */}
                    <svg 
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </div>
                  
                  {/* Цена и длительность */}
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    {showDuration && duration && (
                      <>
                        <span className="text-gray-500">
                          {formatDuration(duration)}
                        </span>
                        <span className="text-gray-300">•</span>
                      </>
                    )}
                    <span className="font-medium text-gray-900">
                      {formatPriceWithPoints(price, service.currency || 'USD', currency, rates)}
                    </span>
                  </div>
                  
                  {/* Теги */}
                  {showTags && service.tags && service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {service.tags.map((tag, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-sakura-cream text-sakura-muted"
                        >
                          {tag.emoji} {language === 'ru' ? tag.name_ru : tag.name_en}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Развёрнутое описание */}
              {isExpanded && service.description && (
                <div className="mt-3 pt-3 border-t border-sakura-border/20">
                  <p className="text-sm text-gray-600">
                    {service.description}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ServicesModule
