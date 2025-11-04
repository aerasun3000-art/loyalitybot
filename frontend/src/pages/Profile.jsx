import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientAnalytics } from '../services/supabase'
import { getTelegramUser, getChatId, hapticFeedback, closeApp } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import Footer from '../components/Footer'

const Profile = () => {
  const navigate = useNavigate()
  const tgUser = getTelegramUser()
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  
  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState(null)

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

  const handleLogout = () => {
    hapticFeedback('medium')
    closeApp()
  }

  const handleBecomePartner = () => {
    hapticFeedback('medium')
    navigate('/partner/apply')
  }

  if (loading) {
    return <Loader text={t('loading_profile')} />
  }

  const memberSince = clientData?.reg_date 
    ? new Date(clientData.reg_date).toLocaleDateString(language === 'ru' ? 'ru' : 'en', {
        month: 'long',
        year: 'numeric'
      })
    : t('profile_unknown')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка с градиентом */}
      <div className="bg-gradient-to-br from-luxury-charcoal via-luxury-navy to-luxury-slate px-4 pt-6 pb-16">
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
          <h1 className="text-xl font-bold text-white">{t('profile_title')}</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Аватар и имя */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-xl flex items-center justify-center mb-4 shadow-lg ring-2 ring-luxury-gold-light">
            {tgUser?.photo_url ? (
              <img 
                src={tgUser.photo_url} 
                alt="Avatar" 
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
              </svg>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {clientData?.name || tgUser?.first_name || t('profile_guest')}
          </h2>
          <p className="text-white/80 text-sm">
            {clientData?.phone || t('profile_no_phone')}
          </p>
          <div className="mt-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-lg border border-white/20">
            <span className="text-white text-sm font-medium">
              {t('profile_member_since')} {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="px-4 -mt-8 pb-20">
        {/* Кнопка стать партнером */}
        <div className="bg-gradient-to-br from-luxury-charcoal to-luxury-navy rounded-xl p-6 shadow-lg mb-4 relative overflow-hidden border border-luxury-gold/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-luxury-gold/5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-luxury-gold/5 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2"/>
                <path d="M15 2v4M9 2v4M3 10h18" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <h3 className="font-bold text-white text-lg">
                {t('profile_become_partner')}
              </h3>
            </div>
            <p className="text-white/80 text-sm mb-4">
              {t('profile_partner_description')}
            </p>
            <button
              onClick={handleBecomePartner}
              className="w-full bg-luxury-gold text-luxury-charcoal py-3 rounded-lg font-semibold hover:bg-luxury-gold-dark transition-colors shadow-md"
            >
              {t('profile_partner_button')} →
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4 border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">{t('profile_my_stats')}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-luxury-gold">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" fill="currentColor"/>
              </svg>
              <div className="text-2xl font-bold text-luxury-gold">
                {clientData?.balance || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">{t('profile_balance')}</div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-green-600">
                <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" fill="currentColor"/>
              </svg>
              <div className="text-2xl font-bold text-green-600">
                {clientData?.analytics?.totalEarned || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">{t('profile_earned')}</div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-blue-600">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
              </svg>
              <div className="text-2xl font-bold text-blue-600">
                {clientData?.analytics?.totalSpent || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">{t('profile_spent')}</div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-luxury-bronze">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
              </svg>
              <div className="text-2xl font-bold text-luxury-bronze">
                {clientData?.analytics?.transactionCount || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">{t('profile_transactions')}</div>
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-4 border border-gray-100">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/history')
            }}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-600">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor"/>
              </svg>
              <span className="font-semibold text-gray-800">{t('profile_history')}</span>
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
              // Возвращаем в Telegram бот для получения поддержки
              if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.close()
              }
            }}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-600">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
              </svg>
              <span className="font-semibold text-gray-800">{t('profile_support')}</span>
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
              navigate('/about')
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-600">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
              </svg>
              <span className="font-semibold text-gray-800">{t('profile_about')}</span>
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
        <div className="bg-gradient-to-br from-luxury-gold-light to-luxury-gold/20 rounded-xl p-4 mb-4 border border-luxury-gold/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 mb-1">{t('profile_status')}</h3>
              <p className="text-luxury-gold-dark font-semibold">
                {clientData?.status === 'active' ? `✓ ${t('profile_active')}` : t('profile_inactive')}
              </p>
            </div>
            <div>
              {clientData?.status === 'active' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Информация о реферальной программе */}
        {clientData?.referrer_chat_id && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-luxury-gold">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
              </svg>
              <h3 className="font-bold text-gray-800">{t('profile_referral')}</h3>
            </div>
            <p className="text-sm text-gray-600">
              {t('profile_referral_text')}
            </p>
          </div>
        )}

        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-gray-300 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          {t('profile_logout')}
        </button>
      </div>

      {/* Footer with legal links */}
      <Footer />
    </div>
  )
}

export default Profile

