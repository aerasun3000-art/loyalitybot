import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Title, Text, Button, Avatar } from '@telegram-apps/telegram-ui'
import { getTelegramUser, getChatId, hapticFeedback } from '../utils/telegram'
import { getClientBalance, getActivePromotions, getApprovedServices } from '../services/supabase'
import { getServiceIcon, defaultServiceIcons } from '../utils/serviceIcons'
import Loader from '../components/Loader'

const Home = () => {
  const navigate = useNavigate()
  const user = getTelegramUser()
  const chatId = getChatId()
  
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [userName, setUserName] = useState('')
  const [promotions, setPromotions] = useState([])
  const [services, setServices] = useState([])
  const [language, setLanguage] = useState('ru')

  useEffect(() => {
    loadData()
  }, [chatId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Загружаем данные параллельно
      const [balanceData, promotionsData, servicesData] = await Promise.all([
        getClientBalance(chatId),
        getActivePromotions(),
        getApprovedServices()
      ])
      
      setBalance(balanceData?.balance || 0)
      setUserName(balanceData?.name || user?.first_name || 'Гость')
      setPromotions(promotionsData.slice(0, 5)) // Первые 5 акций
      setServices(servicesData.slice(0, 8)) // Первые 8 услуг
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleServiceClick = (serviceId) => {
    hapticFeedback('light')
    navigate(`/services?id=${serviceId}`)
  }

  const handlePromotionClick = (promoId) => {
    hapticFeedback('light')
    navigate(`/promotions?id=${promoId}`)
  }

  const toggleLanguage = () => {
    hapticFeedback('light')
    setLanguage(prev => prev === 'ru' ? 'en' : 'ru')
  }

  if (loading) {
    return <Loader text="Загрузка данных..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-400 via-orange-300 to-white">
      {/* Шапка с приветствием */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            Hi {userName}
          </h1>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-white rounded-full px-3 py-2 shadow-sm"
          >
            <span className="text-lg">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-gray-600"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Карточка с балансом */}
        <div className="bg-white rounded-3xl p-4 shadow-lg">
          <p className="text-orange-500 font-semibold text-base mb-3">
            {language === 'ru' 
              ? 'Используйте баллы для получения услуг и скидок!'
              : 'Use points to get services and discounts!'}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-500 text-lg">💰</span>
              </div>
              <span className="font-bold text-gray-800">{balance} баллов</span>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-gray-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 10L11 14L15 10" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Карусель акций */}
      {promotions.length > 0 && (
        <div className="px-4 mb-6">
          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                onClick={() => handlePromotionClick(promo.id)}
                className="flex-shrink-0 w-[85vw] cursor-pointer"
              >
                <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-white font-bold text-xl mb-2">
                    {promo.title}
                  </h3>
                  <p className="text-white/90 text-sm mb-4">
                    {promo.description?.substring(0, 100)}...
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">
                      {promo.partner?.company_name || promo.partner?.name}
                    </span>
                    <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm">
                      До {new Date(promo.end_date).toLocaleDateString('ru')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-3">
            {promotions.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === 0 ? 'w-6 bg-orange-500' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Секция Services */}
      <div className="bg-white rounded-t-[2rem] px-4 pt-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {language === 'ru' ? 'Услуги' : 'Services'}
          </h2>
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1"
          >
            <span className="text-orange-500 font-semibold">
              {language === 'ru' ? 'Все' : 'See all'}
            </span>
            {services.length > 8 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                NEW
              </span>
            )}
          </button>
        </div>

        {/* Сетка услуг 4x2 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(services.length > 0 ? services.slice(0, 8) : defaultServiceIcons.slice(0, 8)).map((item, index) => {
            const isService = services.length > 0
            const serviceIcon = isService ? getServiceIcon(item.title || item.name) : item.icon
            const serviceName = isService ? (item.title || item.name) : (language === 'ru' ? item.name : item.nameEn)
            const serviceId = isService ? item.id : null
            
            return (
              <div
                key={serviceId || index}
                onClick={() => isService && handleServiceClick(serviceId)}
                className={`flex flex-col items-center ${isService ? 'cursor-pointer' : ''}`}
              >
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-2 relative hover:bg-orange-200 transition-colors">
                  <span className="text-3xl">
                    {serviceIcon}
                  </span>
                  {isService && index < 2 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-center text-gray-700 leading-tight">
                  {serviceName?.length > 15 
                    ? serviceName.substring(0, 15) + '...' 
                    : serviceName}
                </span>
              </div>
            )
          })}
        </div>

        {/* Секция bRewards (акции с баллами) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {language === 'ru' ? 'Награды' : 'bRewards'}
            </h2>
            <button
              onClick={() => navigate('/promotions')}
              className="text-orange-500 font-semibold"
            >
              {language === 'ru' ? 'Ещё ...' : 'More ...'}
            </button>
          </div>

          <div className="overflow-x-auto flex gap-4 pb-2 scrollbar-hide">
            {promotions.slice(0, 3).map((promo) => (
              <div
                key={promo.id}
                onClick={() => handlePromotionClick(promo.id)}
                className="flex-shrink-0 w-72 cursor-pointer"
              >
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl overflow-hidden shadow-lg">
                  <div className="h-40 flex items-center justify-center bg-orange-400/50">
                    <span className="text-6xl">🎁</span>
                  </div>
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-gray-800 mb-1 line-clamp-2">
                      {promo.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {promo.partner?.company_name || promo.partner?.name}
                    </p>
                    <div className="flex items-center gap-1 text-orange-500">
                      <span className="text-2xl font-bold">🪙</span>
                      <span className="text-xl font-bold">
                        {promo.required_points || 'Free'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Скрыть скроллбар */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

export default Home

