/**
 * SpecialistsModule - Список специалистов/мастеров партнёра
 * 
 * Отображает:
 * - Горизонтальный скролл с карточками специалистов
 * - Фото, имя, специализация, рейтинг
 * - Возможность выбора специалиста
 */

import { useState, useEffect } from 'react'
import useLanguageStore from '../../store/languageStore'
import { hapticFeedback } from '../../utils/telegram'
import { supabase } from '../../services/supabase'

const SpecialistsModule = ({ 
  partnerId,
  specialists: propSpecialists,
  onSpecialistSelect,
  selectedSpecialistId
}) => {
  const { language } = useLanguageStore()
  const [specialists, setSpecialists] = useState(propSpecialists || [])
  const [loading, setLoading] = useState(!propSpecialists)
  
  // Загрузка специалистов, если не переданы через props
  useEffect(() => {
    if (!propSpecialists && partnerId) {
      loadSpecialists()
    }
  }, [partnerId, propSpecialists])
  
  const loadSpecialists = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('specialists')
        .select('*')
        .eq('partner_chat_id', partnerId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setSpecialists(data || [])
    } catch (error) {
      console.error('Error loading specialists:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSelect = (specialist) => {
    hapticFeedback('light')
    if (onSpecialistSelect) {
      onSpecialistSelect(specialist)
    }
  }
  
  // Placeholder при загрузке
  if (loading) {
    return (
      <div className="bg-sakura-surface px-4 py-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          👩‍🎨 {language === 'ru' ? 'Специалисты' : 'Specialists'}
        </h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {[1, 2, 3].map((i) => (
            <div 
              key={i}
              className="flex-shrink-0 w-20 animate-pulse"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-200" />
              <div className="h-3 bg-gray-200 rounded mt-2 mx-auto w-14" />
              <div className="h-2 bg-sakura-cream rounded mt-1 mx-auto w-10" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  // Не показываем, если нет специалистов
  if (specialists.length === 0) {
    return null
  }

  return (
    <div className="bg-sakura-surface px-4 py-4">
      {/* Заголовок секции */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        👩‍🎨 {language === 'ru' ? 'Специалисты' : 'Specialists'}
      </h2>
      
      {/* Горизонтальный скролл */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {specialists.map((specialist) => {
          const isSelected = selectedSpecialistId === specialist.id
          
          return (
            <div
              key={specialist.id}
              className={`flex-shrink-0 w-20 text-center cursor-pointer transition-transform active:scale-95 ${
                isSelected ? 'scale-105' : ''
              }`}
              onClick={() => handleSelect(specialist)}
            >
              {/* Аватар */}
              <div className={`relative w-16 h-16 mx-auto rounded-full overflow-hidden ${
                isSelected
                  ? 'ring-2 ring-offset-2'
                  : 'ring-1'
              }`}
                style={isSelected
                  ? { '--tw-ring-color': 'var(--tg-theme-button-color)' }
                  : { '--tw-ring-color': 'color-mix(in srgb, var(--tg-theme-hint-color) 30%, transparent)' }
                }>
                {specialist.photo_url ? (
                  <img
                    src={specialist.photo_url}
                    alt={specialist.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl"
                    style={{ background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent), color-mix(in srgb, var(--tg-theme-button-color) 60%, transparent))' }}>
                    👤
                  </div>
                )}
                
                {/* Badge рейтинга */}
                {specialist.rating > 0 && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-sakura-surface rounded-full shadow-sm text-xs font-medium flex items-center gap-0.5">
                    <span className="text-sakura-gold text-[10px]">⭐</span>
                    <span>{specialist.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              
              {/* Имя */}
              <p className="mt-2 text-sm font-medium text-gray-900 truncate">
                {specialist.name}
              </p>
              
              {/* Специализация */}
              {specialist.specialization && (
                <p className="text-xs text-gray-500 truncate">
                  {specialist.specialization}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SpecialistsModule
