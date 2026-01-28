import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientAnalytics, isApprovedPartner, supabase, updateUserCurrency } from '../services/supabase'
import { getTelegramUser, getChatId, hapticFeedback, closeApp } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import useCurrencyStore from '../store/currencyStore'
import { SUPPORTED_CURRENCIES } from '../utils/currency'
import Loader from '../components/Loader'
import Footer from '../components/Footer'

const Profile = () => {
  const navigate = useNavigate()
  const tgUser = getTelegramUser()
  const chatId = getChatId()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const { currency, setCurrency } = useCurrencyStore()
  
  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState(null)
  const [isPartner, setIsPartner] = useState(false)
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [chatId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await getClientAnalytics(chatId)
      setClientData(data)
      
      // Проверяем, является ли пользователь одобренным партнером
      if (chatId) {
        try {
          const partnerStatus = await isApprovedPartner(chatId)
          console.log('[Profile] Partner status check result:', partnerStatus)
          setIsPartner(partnerStatus)
        } catch (error) {
          console.error('[Profile] Error checking partner status:', error)
          setIsPartner(false)
        }
      }
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

  const handleOpenDashboard = () => {
    hapticFeedback('medium')
    navigate(`/partner/analytics?partner_id=${chatId}`)
  }

  const handleCurrencySelect = async (currencyCode) => {
    hapticFeedback('light')
    setCurrency(currencyCode)
    setIsCurrencyModalOpen(false)
    
    // Сохраняем в Supabase (если пользователь авторизован)
    if (chatId) {
      try {
        await updateUserCurrency(chatId, currencyCode)
      } catch (error) {
        console.error('Error saving currency preference:', error)
      }
    }
  }

  const getCurrentCurrencyInfo = () => {
    return SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0]
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
      <div className="bg-gradient-to-br from-jewelry-brown-dark via-jewelry-burgundy to-jewelry-gold px-4 pt-6 pb-16">
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
          <div className="w-24 h-24 bg-jewelry-cream rounded-xl flex items-center justify-center mb-4 shadow-xl ring-2 ring-jewelry-gold/30">
            {tgUser?.photo_url ? (
              <img 
                src={tgUser.photo_url} 
                alt="Avatar" 
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 21C6 17 8.5 14 12 14C15.5 14 18 17 18 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        {/* Плашка для партнеров или для тех, кто хочет стать партнером */}
        {isPartner ? (
          /* Плашка для одобренных партнеров */
          <div className="bg-gradient-to-br from-jewelry-purple to-jewelry-pink-dark rounded-xl p-6 shadow-xl mb-4 relative overflow-hidden border border-jewelry-gold/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-jewelry-gold/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-jewelry-gold/10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold-light">
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                </svg>
                <h3 className="font-bold text-white text-lg">
                  {t('profile_you_are_partner')}
                </h3>
              </div>
              <p className="text-white/90 text-sm mb-4">
                {t('profile_partner_dashboard_description')}
              </p>
              <button
                onClick={handleOpenDashboard}
                className="w-full bg-white text-jewelry-purple py-3 rounded-lg font-semibold hover:bg-jewelry-lavender transition-colors shadow-lg border border-jewelry-purple/30"
              >
                {t('profile_open_dashboard')} →
              </button>
            </div>
          </div>
        ) : (
          /* Плашка для тех, кто хочет стать партнером */
          <div className="bg-gradient-to-br from-jewelry-brown-dark to-jewelry-burgundy rounded-xl p-6 shadow-xl mb-4 relative overflow-hidden border border-jewelry-gold/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-jewelry-gold/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-jewelry-gold/10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 8H16M8 12H16M8 16H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                className="w-full bg-jewelry-gold text-jewelry-cream py-3 rounded-lg font-semibold hover:bg-jewelry-gold-dark transition-colors shadow-lg border border-jewelry-gold-dark/30"
              >
                {t('profile_partner_button')} →
              </button>
            </div>
          </div>
        )}

        {/* Статистика */}
        <div className="bg-jewelry-cream rounded-xl p-4 shadow-lg mb-4 border border-jewelry-gold/20">
          <h3 className="font-bold text-jewelry-brown-dark mb-4">{t('profile_my_stats')}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-jewelry-cream rounded-lg border border-jewelry-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-jewelry-gold">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="text-2xl font-bold text-jewelry-gold">
                {clientData?.balance || 0}
              </div>
              <div className="text-xs text-jewelry-gray-elegant mt-1">{t('profile_balance')}</div>
            </div>
            
            <div className="text-center p-3 bg-jewelry-cream rounded-lg border border-jewelry-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-green-600">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M20 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="text-2xl font-bold text-green-600">
                {clientData?.analytics?.totalEarned || 0}
              </div>
              <div className="text-xs text-jewelry-gray-elegant mt-1">{t('profile_earned')}</div>
            </div>
            
            <div className="text-center p-3 bg-jewelry-cream rounded-lg border border-jewelry-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-jewelry-burgundy">
                <path d="M7 13L12 18L17 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 6L12 11L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-2xl font-bold text-jewelry-burgundy">
                {clientData?.analytics?.totalSpent || 0}
              </div>
              <div className="text-xs text-jewelry-gray-elegant mt-1">{t('profile_spent')}</div>
            </div>
            
            <div className="text-center p-3 bg-jewelry-cream rounded-lg border border-jewelry-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-jewelry-brown-light">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="6" r="1.5" fill="currentColor" />
                <circle cx="4" cy="12" r="1.5" fill="currentColor" />
              </svg>
              <div className="text-2xl font-bold text-jewelry-brown-light">
                {clientData?.analytics?.transactionCount || 0}
              </div>
              <div className="text-xs text-jewelry-gray-elegant mt-1">{t('profile_transactions')}</div>
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="bg-jewelry-cream rounded-xl overflow-hidden shadow-lg mb-4 border border-jewelry-gold/20">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/history')
            }}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-brown-dark">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-jewelry-brown-dark">{t('profile_history')}</span>
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
            className="w-full flex items-center justify-between p-4 border-b border-jewelry-gold/20 hover:bg-jewelry-gold/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-brown-dark">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 10H16M8 14H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-jewelry-brown-dark">{t('profile_support')}</span>
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
            className="w-full flex items-center justify-between p-4 border-b border-jewelry-gold/20 hover:bg-jewelry-gold/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-brown-dark">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-jewelry-brown-dark">{t('profile_about')}</span>
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

          {/* Выбор валюты */}
          <button
            onClick={() => {
              hapticFeedback('light')
              setIsCurrencyModalOpen(true)
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-jewelry-gold/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{getCurrentCurrencyInfo().flag}</span>
              <span className="font-semibold text-jewelry-brown-dark">
                {language === 'ru' ? 'Валюта' : 'Currency'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-jewelry-gray-elegant text-sm">
                {getCurrentCurrencyInfo().code}
              </span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M8 6L12 10L8 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </button>
        </div>

        {/* Статус клиента */}
        <div className="bg-gradient-to-br from-jewelry-gold-light to-jewelry-gold/20 rounded-xl p-4 mb-4 border border-jewelry-gold/40">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-jewelry-brown-dark mb-1">{t('profile_status')}</h3>
              <p className="text-jewelry-gold-dark font-semibold">
                {clientData?.status === 'active' ? `✓ ${t('profile_active')}` : t('profile_inactive')}
              </p>
            </div>
            <div>
              {clientData?.status === 'active' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.3" />
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
          <div className="bg-jewelry-cream rounded-xl p-4 mb-4 border border-jewelry-gold/20">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="15" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 21C6 17 8.5 14 12 14C15.5 14 18 17 18 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="font-bold text-jewelry-brown-dark">{t('profile_referral')}</h3>
            </div>
            <p className="text-sm text-jewelry-gray-elegant">
              {t('profile_referral_text')}
            </p>
          </div>
        )}

        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          className="w-full bg-jewelry-cream border border-jewelry-gold/30 text-jewelry-brown-dark py-4 rounded-lg font-semibold hover:bg-jewelry-gold/5 transition-colors"
        >
          {t('profile_logout')}
        </button>
      </div>

      {/* Модальное окно выбора валюты */}
      {isCurrencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsCurrencyModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-jewelry-cream rounded-t-3xl p-6 pb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-jewelry-brown-dark">
                {language === 'ru' ? 'Выберите валюту' : 'Select currency'}
              </h3>
              <button
                onClick={() => setIsCurrencyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-jewelry-gold/10 flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-jewelry-gray-elegant mb-4">
              {language === 'ru' 
                ? 'Цены будут отображаться в выбранной валюте'
                : 'Prices will be displayed in selected currency'}
            </p>
            <div className="space-y-2">
              {SUPPORTED_CURRENCIES.map((curr) => (
                <button
                  key={curr.code}
                  onClick={() => handleCurrencySelect(curr.code)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                    currency === curr.code 
                      ? 'bg-jewelry-gold/20 border-2 border-jewelry-gold'
                      : 'bg-white border border-jewelry-gold/20 hover:bg-jewelry-gold/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{curr.flag}</span>
                    <div className="text-left">
                      <div className="font-semibold text-jewelry-brown-dark">
                        {curr.code}
                      </div>
                      <div className="text-xs text-jewelry-gray-elegant">
                        {language === 'ru' ? curr.nameRu : curr.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-jewelry-gold">{curr.symbol}</span>
                    {currency === curr.code && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer with legal links */}
      <Footer />
    </div>
  )
}

export default Profile

