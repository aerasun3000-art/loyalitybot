/**
 * MenuTemplate - Шаблон страницы партнёра для ресторанов/кафе
 * 
 * Используется для: food (restaurant, cafe, food_delivery, bakery, bar)
 * 
 * Модули:
 * - HeroModule (обязательный)
 * - HeaderModule (обязательный)
 * - MenuModule (обязательный) - с корзиной
 * - PortfolioModule (опциональный)
 * - LocationModule (обязательный)
 * - CTAFooterModule (обязательный) - генерация QR-кода
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  HeroModule,
  HeaderModule,
  MenuModule,
  PortfolioModule,
  LocationModule,
  CTAFooterModule
} from '../modules'
import { getModuleConfig } from '../../utils/templateConfig'
import { hapticFeedback } from '../../utils/telegram'
import useLanguageStore from '../../store/languageStore'
import useCurrencyStore from '../../store/currencyStore'
import { formatPriceWithPoints } from '../../utils/currency'

const MenuTemplate = ({ 
  partner, 
  services = [], // для ресторанов это блюда меню
  portfolioPhotos = [],
  rating,
  reviewsCount,
  distance
}) => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { currency, rates } = useCurrencyStore()
  
  // Состояние корзины: { [itemId]: { item, quantity } }
  const [cart, setCart] = useState({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [qrImage, setQrImage] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  
  // Получаем конфигурацию модулей
  const config = getModuleConfig(partner?.category_group, partner?.ui_config)
  
  // Категории меню из конфига партнёра
  const baseMenuCategories = config.base_menu_categories || []
  const customCategories = config.menu_categories || []
  const dietaryTags = config.dietary_tags || []
  
  // Подсчёт итогов корзины
  const cartSummary = useMemo(() => {
    const items = Object.values(cart)
    const totalItems = items.reduce((sum, { quantity }) => sum + quantity, 0)
    const totalPrice = items.reduce((sum, { item, quantity }) => {
      const price = item.price_local || item.price || 0
      return sum + (price * quantity)
    }, 0)
    return { totalItems, totalPrice, items }
  }, [cart])
  
  // Добавление в корзину
  const handleAddToCart = (item, delta = 1) => {
    hapticFeedback('light')
    setCart(prev => {
      const current = prev[item.id]
      const newQuantity = (current?.quantity || 0) + delta
      
      if (newQuantity <= 0) {
        const { [item.id]: removed, ...rest } = prev
        return rest
      }
      
      return {
        ...prev,
        [item.id]: { item, quantity: newQuantity }
      }
    })
  }
  
  // Генерация QR-кода
  const generateQR = async () => {
    if (cartSummary.totalItems === 0) return
    
    setQrLoading(true)
    try {
      // Формируем данные для QR
      const qrData = {
        v: 1, // версия формата
        p: partner?.chat_id,
        items: cartSummary.items.map(({ item, quantity }) => ({
          id: item.id,
          qty: quantity
        })),
        total: cartSummary.totalPrice,
        currency: currency,
        ts: Math.floor(Date.now() / 1000)
      }
      
      // Кодируем в base64 JSON
      const jsonString = JSON.stringify(qrData)
      const base64Data = btoa(unescape(encodeURIComponent(jsonString)))
      
      // Генерируем QR-код
      const qrDataUrl = await QRCode.toDataURL(`lb:${base64Data}`, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff'
        }
      })
      
      setQrImage(qrDataUrl)
      setIsQRModalOpen(true)
    } catch (error) {
      console.error('Error generating QR:', error)
    } finally {
      setQrLoading(false)
    }
  }
  
  // Обработка кнопки "Назад"
  const handleBack = () => {
    hapticFeedback('light')
    navigate(-1)
  }
  
  // Очистка корзины
  const handleClearCart = () => {
    hapticFeedback('medium')
    setCart({})
    setIsCartOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero изображение */}
      <HeroModule 
        partner={partner}
        height="35vh"
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
          
          {/* Кнопки действий */}
          <div className="flex gap-3 px-4 pb-4">
            {partner?.booking_url && (
              <button
                onClick={() => window.open(partner.booking_url, '_blank')}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-medium transition-colors active:bg-gray-200"
              >
                <span>🪑</span>
                <span>{language === 'ru' ? 'Забронировать' : 'Book table'}</span>
              </button>
            )}
            {cartSummary.totalItems > 0 && (
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sakura-accent text-white font-medium transition-colors active:bg-sakura-dark relative"
              >
                <span>🛒</span>
                <span>{cartSummary.totalItems}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Меню */}
      <MenuModule 
        items={services}
        baseMenuCategories={baseMenuCategories}
        customCategories={customCategories}
        dietaryTags={dietaryTags}
        onAddToCart={handleAddToCart}
        cartItems={cart}
      />
      
      {/* Портфолио (если включен модуль) */}
      {config.modules.portfolio && portfolioPhotos.length > 0 && (
        <>
          <div className="h-2 bg-gray-100" />
          <PortfolioModule 
            partnerId={partner?.chat_id}
            photos={portfolioPhotos}
            maxVisible={4}
            title={language === 'ru' ? 'Фото' : 'Photos'}
          />
        </>
      )}
      
      {/* Локация и контакты */}
      <div className="h-2 bg-gray-100" />
      <LocationModule 
        partner={partner}
        showMap={true}
        showWorkingHours={true}
        showContacts={true}
      />
      
      {/* Sticky CTA кнопка - QR или забронировать */}
      {cartSummary.totalItems > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 safe-area-bottom">
          <button
            onClick={generateQR}
            disabled={qrLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-sakura-accent to-sakura-dark shadow-lg shadow-sakura-accent/25 active:scale-[0.98] transition-transform"
          >
            {qrLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{language === 'ru' ? 'Генерация...' : 'Generating...'}</span>
              </>
            ) : (
              <>
                <span>📱</span>
                <span>{language === 'ru' ? 'Показать QR' : 'Show QR'}</span>
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-sm">
                  {formatPriceWithPoints(cartSummary.totalPrice, 'USD', currency, rates)}
                </span>
              </>
            )}
          </button>
        </div>
      ) : (
        <CTAFooterModule 
          action={config.cta.secondary || 'contact'}
          url={partner?.booking_url}
          partner={partner}
        />
      )}
      
      {/* Модалка корзины */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setIsCartOpen(false)}
        >
          <div 
            className="w-full bg-white rounded-t-3xl max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold">
                🛒 {language === 'ru' ? 'Корзина' : 'Cart'}
              </h3>
              <button 
                onClick={handleClearCart}
                className="text-sm text-red-500"
              >
                {language === 'ru' ? 'Очистить' : 'Clear'}
              </button>
            </div>
            
            {/* Список */}
            <div className="max-h-[50vh] overflow-y-auto">
              {cartSummary.items.map(({ item, quantity }) => (
                <div key={item.id} className="flex items-center gap-3 p-4 border-b border-gray-50">
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-gray-500">
                      {formatPriceWithPoints(item.price_local || item.price || 0, 'USD', currency, rates)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddToCart(item, -1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium">{quantity}</span>
                    <button
                      onClick={() => handleAddToCart(item, 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Итого */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">{language === 'ru' ? 'Итого' : 'Total'}</span>
                <span className="text-xl font-bold">
                  {formatPriceWithPoints(cartSummary.totalPrice, 'USD', currency, rates)}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false)
                  generateQR()
                }}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-sakura-accent to-sakura-dark"
              >
                📱 {language === 'ru' ? 'Показать QR' : 'Show QR'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка QR-кода */}
      {isQRModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsQRModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2">
              {language === 'ru' ? 'Ваш заказ' : 'Your order'}
            </h3>
            <p className="text-gray-500 mb-4">
              {language === 'ru' 
                ? 'Покажите этот QR-код официанту или на кассе'
                : 'Show this QR code to the waiter or at the checkout'}
            </p>
            
            {/* QR-код */}
            {qrImage && (
              <div className="flex justify-center mb-4">
                <img src={qrImage} alt="QR Code" className="w-56 h-56" />
              </div>
            )}
            
            {/* Итого */}
            <div className="text-2xl font-bold text-sakura-accent mb-4">
              {formatPriceWithPoints(cartSummary.totalPrice, 'USD', currency, rates)}
            </div>
            
            {/* Список */}
            <div className="text-left text-sm text-gray-600 bg-gray-50 rounded-xl p-3 mb-4 max-h-32 overflow-y-auto">
              {cartSummary.items.map(({ item, quantity }) => (
                <div key={item.id} className="flex justify-between py-1">
                  <span>{item.title} × {quantity}</span>
                  <span>{formatPriceWithPoints((item.price_local || item.price || 0) * quantity, 'USD', currency, rates)}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setIsQRModalOpen(false)}
              className="w-full py-3 rounded-xl font-medium bg-gray-100 text-gray-700"
            >
              {language === 'ru' ? 'Закрыть' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MenuTemplate
