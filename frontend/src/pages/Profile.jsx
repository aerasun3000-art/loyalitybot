import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientAnalytics, isApprovedPartner, getReferralStats, getOrCreateReferralCode, updateUserCurrency } from '../services/supabase'
import { getTelegramUser, getChatId, hapticFeedback, closeApp } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import useCurrencyStore from '../store/currencyStore'
import { SUPPORTED_CURRENCIES } from '../utils/currency'
import { shareReferralLink, buildReferralLink } from '../utils/referralShare'
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
  const [referralStats, setReferralStats] = useState(null)
  const [referralCode, setReferralCode] = useState(null)
  const [referralToast, setReferralToast] = useState(null)

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
        try {
          const stats = await getReferralStats(chatId)
          setReferralStats(stats)
          const code = stats?.referral_code ?? await getOrCreateReferralCode(chatId)
          setReferralCode(code)
        } catch (err) {
          console.warn('[Profile] Referral data load failed:', err)
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
    <div className="min-h-screen bg-sakura-bg">
      {/* Шапка с градиентом */}
      <div className="bg-gradient-to-br from-sakura-deep via-sakura-mid to-sakura-accent px-4 pt-6 pb-16">
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
          <div className="w-24 h-24 bg-sakura-bg rounded-xl flex items-center justify-center mb-4 shadow-xl ring-2 ring-sakura-gold/30">
            {tgUser?.photo_url ? (
              <img 
                src={tgUser.photo_url} 
                alt="Avatar" 
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-sakura-gold">
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
          <div className="bg-gradient-to-br from-sakura-mid to-sakura-dark rounded-xl p-6 shadow-xl mb-4 relative overflow-hidden border border-sakura-gold/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sakura-gold/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-sakura-gold/10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-gold-light">
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
                className="w-full bg-white text-sakura-mid py-3 rounded-lg font-semibold hover:bg-sakura-surface transition-colors shadow-lg border border-sakura-mid/30"
              >
                {t('profile_open_dashboard')} →
              </button>
            </div>
          </div>
        ) : (
          /* Плашка для тех, кто хочет стать партнером */
          <div className="bg-gradient-to-br from-sakura-deep to-sakura-mid rounded-xl p-6 shadow-xl mb-4 relative overflow-hidden border border-sakura-gold/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sakura-gold/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-sakura-gold/10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-gold">
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
                className="w-full bg-sakura-gold text-sakura-bg py-3 rounded-lg font-semibold hover:bg-sakura-mid transition-colors shadow-lg border border-sakura-mid/30"
              >
                {t('profile_partner_button')} →
              </button>
            </div>
          </div>
        )}

        {/* Статистика */}
        <div className="bg-sakura-bg rounded-xl p-4 shadow-lg mb-4 border border-sakura-gold/20">
          <h3 className="font-bold text-sakura-deep mb-4">{t('profile_my_stats')}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-sakura-bg rounded-lg border border-sakura-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-sakura-gold">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="text-2xl font-bold text-sakura-gold">
                {clientData?.balance || 0}
              </div>
              <div className="text-xs text-sakura-muted mt-1">{t('profile_balance')}</div>
            </div>
            
            <div className="text-center p-3 bg-sakura-bg rounded-lg border border-sakura-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-green-600">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M20 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="text-2xl font-bold text-green-600">
                {clientData?.analytics?.totalEarned || 0}
              </div>
              <div className="text-xs text-sakura-muted mt-1">{t('profile_earned')}</div>
            </div>
            
            <div className="text-center p-3 bg-sakura-bg rounded-lg border border-sakura-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-sakura-mid">
                <path d="M7 13L12 18L17 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 6L12 11L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-2xl font-bold text-sakura-mid">
                {clientData?.analytics?.totalSpent || 0}
              </div>
              <div className="text-xs text-sakura-muted mt-1">{t('profile_spent')}</div>
            </div>
            
            <div className="text-center p-3 bg-sakura-bg rounded-lg border border-sakura-gold/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-sakura-muted">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="6" r="1.5" fill="currentColor" />
                <circle cx="4" cy="12" r="1.5" fill="currentColor" />
              </svg>
              <div className="text-2xl font-bold text-sakura-muted">
                {clientData?.analytics?.transactionCount || 0}
              </div>
              <div className="text-xs text-sakura-muted mt-1">{t('profile_transactions')}</div>
            </div>
          </div>
        </div>

        {/* Заработок на рекомендациях */}
        {chatId && (
          <div className="bg-sakura-bg rounded-xl p-4 shadow-lg mb-4 border border-sakura-gold/20">
            <div className="flex items-center gap-2 mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-gold">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="font-bold text-sakura-deep">{t('profile_referral_block_title')}</h3>
            </div>
            <p className="text-sm text-sakura-muted mb-3">{t('profile_referral_partner_hint')}</p>
            {referralStats && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{(() => {
                  const levels = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }
                  return levels[referralStats.referral_level] || levels.bronze
                })()}</span>
                <span className="text-sakura-deep text-sm font-medium">
                  {t('referral_your_level')}: {t(`referral_level_${referralStats.referral_level || 'bronze'}`)}
                </span>
              </div>
            )}
            {referralStats && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center p-2 bg-white rounded-lg border border-sakura-gold/20">
                  <div className="text-lg font-bold text-sakura-gold">{referralStats.total_referrals || 0}</div>
                  <div className="text-xs text-sakura-muted">{t('referral_invited')}</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-sakura-gold/20">
                  <div className="text-lg font-bold text-sakura-gold">{referralStats.total_earnings || 0} 💸</div>
                  <div className="text-xs text-sakura-muted">{t('referral_earned')}</div>
                </div>
              </div>
            )}
            {referralCode ? (
              <button
                onClick={async () => {
                  const link = buildReferralLink(referralCode)
                  await shareReferralLink(link, {
                    title: 'LoyaltyBot',
                    text: t('home_referral_subtitle'),
                    onSuccess: () => {
                      setReferralToast(t('toast_link_copied'))
                      setTimeout(() => setReferralToast(null), 2500)
                    },
                    onError: () => {
                      setReferralToast(t('toast_copy_failed'))
                      setTimeout(() => setReferralToast(null), 2500)
                    }
                  })
                }}
                className="w-full bg-sakura-gold text-sakura-bg py-2.5 rounded-lg font-semibold text-sm hover:bg-sakura-mid transition-colors flex items-center justify-center gap-2 mb-3"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
                </svg>
                {t('home_referral_copy_btn')} / {t('home_referral_share_btn')}
              </button>
            ) : (
              <p className="text-sm text-sakura-muted italic mb-3">{t('home_referral_link_soon')}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { hapticFeedback('light'); navigate('/partner/apply'); }}
                className="flex-1 min-w-[140px] bg-sakura-deep text-white py-2 rounded-lg font-semibold text-sm hover:bg-sakura-mid transition-colors"
              >
                {t('referral_become_partner_btn')} →
              </button>
              <button
                onClick={() => { hapticFeedback('light'); navigate('/community'); }}
                className="px-4 py-2 text-sakura-deep text-sm font-medium hover:underline"
              >
                {t('home_referral_more')} →
              </button>
            </div>
            {referralToast && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-sakura-deep text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
                {referralToast}
              </div>
            )}
          </div>
        )}

        {/* Настройки */}
        <div className="bg-sakura-bg rounded-xl overflow-hidden shadow-lg mb-4 border border-sakura-gold/20">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/history')
            }}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-deep">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-sakura-deep">{t('profile_history')}</span>
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
            className="w-full flex items-center justify-between p-4 border-b border-sakura-gold/20 hover:bg-sakura-gold/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-deep">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 10H16M8 14H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-sakura-deep">{t('profile_support')}</span>
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
            className="w-full flex items-center justify-between p-4 border-b border-sakura-gold/20 hover:bg-sakura-gold/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-deep">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-semibold text-sakura-deep">{t('profile_about')}</span>
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
            className="w-full flex items-center justify-between p-4 hover:bg-sakura-gold/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{getCurrentCurrencyInfo().flag}</span>
              <span className="font-semibold text-sakura-deep">
                {language === 'ru' ? 'Валюта' : 'Currency'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sakura-muted text-sm">
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
        <div className="bg-gradient-to-br from-sakura-gold-light to-sakura-accent/20 rounded-xl p-4 mb-4 border border-sakura-gold/40">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sakura-deep mb-1">{t('profile_status')}</h3>
              <p className="text-sakura-mid font-semibold">
                {clientData?.status === 'active' ? `✓ ${t('profile_active')}` : t('profile_inactive')}
              </p>
            </div>
            <div>
              {clientData?.status === 'active' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-sakura-gold">
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
          <div className="bg-sakura-bg rounded-xl p-4 mb-4 border border-sakura-gold/20">
            <div className="flex items-center gap-2 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-gold">
                <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="15" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 21C6 17 8.5 14 12 14C15.5 14 18 17 18 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="font-bold text-sakura-deep">{t('profile_referral')}</h3>
            </div>
            <p className="text-sm text-sakura-muted">
              {t('profile_referral_text')}
            </p>
          </div>
        )}

        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          className="w-full bg-sakura-bg border border-sakura-gold/30 text-sakura-deep py-4 rounded-lg font-semibold hover:bg-sakura-gold/5 transition-colors"
        >
          {t('profile_logout')}
        </button>
      </div>

      {/* Модальное окно выбора валюты */}
      {isCurrencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsCurrencyModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-sakura-bg rounded-t-3xl p-6 pb-8 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-sakura-deep">
                {language === 'ru' ? 'Выберите валюту' : 'Select currency'}
              </h3>
              <button
                onClick={() => setIsCurrencyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-sakura-gold/10 flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-sakura-muted mb-4">
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
                      ? 'bg-sakura-gold/20 border-2 border-sakura-gold'
                      : 'bg-white border border-sakura-gold/20 hover:bg-sakura-gold/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{curr.flag}</span>
                    <div className="text-left">
                      <div className="font-semibold text-sakura-deep">
                        {curr.code}
                      </div>
                      <div className="text-xs text-sakura-muted">
                        {language === 'ru' ? curr.nameRu : curr.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-sakura-gold">{curr.symbol}</span>
                    {currency === curr.code && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sakura-gold">
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

