/**
 * MenuModule - Меню с категориями для ресторанов
 * 
 * Отображает:
 * - Табы категорий
 * - Список блюд с фото, описанием, ценой
 * - Диетические теги
 * - Кнопку добавления в корзину
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import useLanguageStore from '../../store/languageStore'
import useCurrencyStore from '../../store/currencyStore'
import { formatPriceWithPoints } from '../../utils/currency'
import { getMenuCategories, getDietaryTags } from '../../utils/templateConfig'
import { hapticFeedback } from '../../utils/telegram'

const MenuModule = ({ 
  items = [],
  menuCategories = [],
  baseMenuCategories = [],
  customCategories = [],
  dietaryTags = [],
  onAddToCart,
  cartItems = {}
}) => {
  const { language } = useLanguageStore()
  const { currency, rates } = useCurrencyStore()
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeDietaryFilter, setActiveDietaryFilter] = useState(null)
  const tabsRef = useRef(null)
  
  // Получаем категории с локализацией
  const categories = useMemo(() => {
    return getMenuCategories(baseMenuCategories, customCategories, language)
  }, [baseMenuCategories, customCategories, language])
  
  // Группируем items по категориям
  const itemsByCategory = useMemo(() => {
    const grouped = {}
    items.forEach(item => {
      const cat = item.menu_category || 'other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    })
    return grouped
  }, [items])
  
  // Устанавливаем первую категорию по умолчанию
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      // Находим первую категорию, в которой есть items
      const firstWithItems = categories.find(cat => 
        itemsByCategory[cat.code]?.length > 0
      )
      setActiveCategory(firstWithItems?.code || categories[0]?.code)
    }
  }, [categories, itemsByCategory, activeCategory])
  
  // Фильтруем items
  const filteredItems = useMemo(() => {
    let result = activeCategory 
      ? (itemsByCategory[activeCategory] || [])
      : items
    
    if (activeDietaryFilter) {
      result = result.filter(item => 
        item.tags?.some(tag => tag.code === activeDietaryFilter)
      )
    }
    
    return result.sort((a, b) => (a.display_order || 999) - (b.display_order || 999))
  }, [activeCategory, activeDietaryFilter, itemsByCategory, items])
  
  // Диетические теги с локализацией
  const availableDietaryTags = useMemo(() => {
    return getDietaryTags(dietaryTags, language)
  }, [dietaryTags, language])
  
  const handleCategoryChange = (code) => {
    hapticFeedback('light')
    setActiveCategory(code)
    // Скроллим таб в видимую область
    const tabElement = document.getElementById(`menu-tab-${code}`)
    if (tabElement && tabsRef.current) {
      tabElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }
  
  const handleDietaryFilterToggle = (code) => {
    hapticFeedback('light')
    setActiveDietaryFilter(prev => prev === code ? null : code)
  }
  
  const handleAddToCart = (item) => {
    hapticFeedback('medium')
    if (onAddToCart) {
      onAddToCart(item)
    }
  }
  
  const getItemQuantity = (itemId) => {
    return cartItems[itemId]?.quantity || 0
  }

  return (
    <div className="bg-white">
      {/* Табы категорий */}
      {categories.length > 0 && (
        <div 
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.code
            const hasItems = (itemsByCategory[cat.code]?.length || 0) > 0
            
            return (
              <button
                key={cat.code}
                id={`menu-tab-${cat.code}`}
                onClick={() => handleCategoryChange(cat.code)}
                disabled={!hasItems}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sakura-accent text-white'
                    : hasItems
                      ? 'bg-gray-100 text-gray-700 active:bg-gray-200'
                      : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
              >
                {cat.emoji} {cat.name}
              </button>
            )
          })}
        </div>
      )}
      
      {/* Диетические фильтры */}
      {availableDietaryTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2 bg-gray-50">
          {availableDietaryTags.map((tag) => {
            const isActive = activeDietaryFilter === tag.code
            
            return (
              <button
                key={tag.code}
                onClick={() => handleDietaryFilterToggle(tag.code)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-100'
                }`}
              >
                {tag.emoji} {tag.name}
              </button>
            )
          })}
        </div>
      )}
      
      {/* Список блюд */}
      <div className="divide-y divide-gray-100">
        {filteredItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            {language === 'ru' ? 'Ничего не найдено' : 'Nothing found'}
          </div>
        ) : (
          filteredItems.map((item) => {
            const quantity = getItemQuantity(item.id)
            const price = item.price_local || item.price || 0
            
            return (
              <div 
                key={item.id}
                className="flex gap-3 p-4"
              >
                {/* Фото блюда */}
                {item.image_url && (
                  <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                
                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 leading-tight">
                    {item.title}
                  </h3>
                  
                  {/* Описание */}
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  
                  {/* Теги */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.map((tag, index) => (
                        <span 
                          key={index}
                          className="text-xs"
                          title={language === 'ru' ? tag.name_ru : tag.name_en}
                        >
                          {tag.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Цена и кнопка */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-gray-900">
                      {formatPriceWithPoints(price, item.currency || 'USD', currency, rates)}
                    </span>
                    
                    {/* Кнопка добавления */}
                    {onAddToCart && (
                      <div className="flex items-center gap-2">
                        {quantity > 0 ? (
                          <div className="flex items-center gap-2 bg-sakura-accent rounded-full">
                            <button
                              onClick={() => onAddToCart(item, -1)}
                              className="w-8 h-8 flex items-center justify-center text-white font-bold"
                            >
                              −
                            </button>
                            <span className="text-white font-medium min-w-[20px] text-center">
                              {quantity}
                            </span>
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="w-8 h-8 flex items-center justify-center text-white font-bold"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(item)}
                            className="px-4 py-2 bg-sakura-accent text-white text-sm font-medium rounded-full active:scale-95 transition-transform"
                          >
                            {language === 'ru' ? 'Добавить' : 'Add'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default MenuModule
