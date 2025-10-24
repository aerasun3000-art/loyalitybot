import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientAnalytics } from '../services/supabase'
import { getTelegramUser, getChatId, hapticFeedback, closeApp } from '../utils/telegram'
import Loader from '../components/Loader'

const Profile = () => {
  const navigate = useNavigate()
  const tgUser = getTelegramUser()
  const chatId = getChatId()
  
  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState(null)
  const [language, setLanguage] = useState('ru')

  useEffect(() => {
    loadProfile()
  }, [chatId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await getClientAnalytics(chatId)
      setClientData(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleLanguage = () => {
    hapticFeedback('light')
    setLanguage(prev => prev === 'ru' ? 'en' : 'ru')
    // TODO: Применить изменение языка ко всему приложению
  }

  const handleLogout = () => {
    hapticFeedback('medium')
    closeApp()
  }

  if (loading) {
    return <Loader text="Загрузка профиля..." />
  }

  const memberSince = clientData?.reg_date 
    ? new Date(clientData.reg_date).toLocaleDateString('ru', {
        month: 'long',
        year: 'numeric'
      })
    : 'Неизвестно'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка с градиентом */}
      <div className="bg-gradient-to-br from-pink-400 to-rose-500 px-4 pt-6 pb-16">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Профиль</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Аватар и имя */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
            {tgUser?.photo_url ? (
              <img 
                src={tgUser.photo_url} 
                alt="Avatar" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-5xl">👤</span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {clientData?.name || tgUser?.first_name || 'Гость'}
          </h2>
          <p className="text-white/80 text-sm">
            {clientData?.phone || 'Телефон не указан'}
          </p>
          <div className="mt-2 bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full">
            <span className="text-white text-sm">
              С {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 -mt-8 pb-20">
        {/* Статистика */}
        <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
          <h3 className="font-bold text-gray-800 mb-4">Моя статистика</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl mb-1">💰</div>
              <div className="text-2xl font-bold text-pink-500">
                {clientData?.balance || 0}
              </div>
              <div className="text-xs text-gray-500">Баллов на счёте</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl mb-1">📈</div>
              <div className="text-2xl font-bold text-green-500">
                {clientData?.analytics?.totalEarned || 0}
              </div>
              <div className="text-xs text-gray-500">Всего получено</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl mb-1">🎯</div>
              <div className="text-2xl font-bold text-blue-500">
                {clientData?.analytics?.totalSpent || 0}
              </div>
              <div className="text-xs text-gray-500">Потрачено</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl mb-1">🔄</div>
              <div className="text-2xl font-bold text-purple-500">
                {clientData?.analytics?.transactionCount || 0}
              </div>
              <div className="text-xs text-gray-500">Транзакций</div>
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <span className="font-semibold text-gray-800">Язык</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">
                {language === 'ru' ? 'Русский' : 'English'}
              </span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M7 8L10 11L13 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </button>

          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/history')
            }}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <span className="font-semibold text-gray-800">История транзакций</span>
            </div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 6L12 10L8 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            onClick={() => {
              hapticFeedback('light')
              // TODO: Открыть раздел помощи
            }}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <span className="font-semibold text-gray-800">Помощь и поддержка</span>
            </div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 6L12 10L8 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            onClick={() => {
              hapticFeedback('light')
              // TODO: Открыть раздел "О приложении"
            }}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">ℹ️</span>
              <span className="font-semibold text-gray-800">О приложении</span>
            </div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 6L12 10L8 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Статус клиента */}
        <div className="bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Статус</h3>
              <p className="text-pink-600 font-semibold">
                {clientData?.status === 'active' ? '✓ Активный' : 'Неактивный'}
              </p>
            </div>
            <div className="text-5xl">
              {clientData?.status === 'active' ? '⭐' : '❌'}
            </div>
          </div>
        </div>

        {/* Информация о реферальной программе */}
        {clientData?.referrer_chat_id && (
          <div className="bg-purple-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🤝</span>
              <h3 className="font-bold text-gray-800">Реферальная программа</h3>
            </div>
            <p className="text-sm text-gray-600">
              Вы были приглашены другом! Приглашайте своих друзей и получайте бонусы.
            </p>
          </div>
        )}

        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border-2 border-red-200 text-red-500 py-4 rounded-xl font-semibold hover:bg-red-50 transition-colors"
        >
          Выйти из приложения
        </button>
      </div>
    </div>
  )
}

export default Profile

