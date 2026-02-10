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
import Layout from '../components/Layout'
import { CheckCircle, Briefcase, Clock, MessageCircle, Info, ChevronRight, Copy, Link2, LogOut, Star, X } from 'lucide-react'

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
    <Layout>
      <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4">
        {/* Аватар и имя */}
        <div className="flex flex-col items-center pt-4 pb-2">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 overflow-hidden"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            {tgUser?.photo_url ? (
              <img
                src={tgUser.photo_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl">
                {(clientData?.name || tgUser?.first_name || '?')[0]}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold">
            {clientData?.name || tgUser?.first_name || t('profile_guest')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {clientData?.phone || t('profile_no_phone')}
          </p>
          <div
            className="mt-2 px-3 py-1 rounded-lg text-xs"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)',
              color: 'var(--tg-theme-button-color)',
            }}
          >
            {t('profile_member_since')} {memberSince}
          </div>
        </div>

        {/* Партнёрская плашка */}
        {isPartner ? (
          <div
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--tg-theme-button-color), color-mix(in srgb, var(--tg-theme-button-color) 60%, rgb(var(--sakura-deep))))',
            }}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={20} className="text-white" />
                <h3 className="font-bold text-white">{t('profile_you_are_partner')}</h3>
              </div>
              <p className="text-white/80 text-sm mb-3">{t('profile_partner_dashboard_description')}</p>
              <button
                onClick={handleOpenDashboard}
                className="w-full py-2.5 rounded-xl font-semibold transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                }}
              >
                {t('profile_open_dashboard')}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--tg-theme-button-color), color-mix(in srgb, var(--tg-theme-button-color) 60%, rgb(var(--sakura-deep))))',
            }}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={20} className="text-white" />
                <h3 className="font-bold text-white">{t('profile_become_partner')}</h3>
              </div>
              <p className="text-white/80 text-sm mb-3">{t('profile_partner_description')}</p>
              <button
                onClick={handleBecomePartner}
                className="w-full py-2.5 rounded-xl font-semibold transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  color: 'var(--tg-theme-text-color)',
                }}
              >
                {t('profile_partner_button')}
              </button>
            </div>
          </div>
        )}

        {/* Статистика */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          <h3 className="font-bold mb-3">{t('profile_my_stats')}</h3>

          <div className="grid grid-cols-2 gap-3">
            {[
              { value: clientData?.balance || 0, label: t('profile_balance'), accent: true },
              { value: clientData?.analytics?.totalEarned || 0, label: t('profile_earned'), accent: false },
              { value: clientData?.analytics?.totalSpent || 0, label: t('profile_spent'), accent: false },
              { value: clientData?.analytics?.transactionCount || 0, label: t('profile_transactions'), accent: false },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center p-3 rounded-xl"
                style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
              >
                <div
                  className="text-xl font-bold"
                  style={{ color: stat.accent ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-text-color)' }}
                >
                  {stat.value}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Реферальный блок */}
        {chatId && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={18} style={{ color: 'var(--tg-theme-button-color)' }} />
              <h3 className="font-bold">{t('profile_referral_block_title')}</h3>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {t('profile_referral_partner_hint')}
            </p>
            {referralStats && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{(() => {
                  const levels = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }
                  return levels[referralStats.referral_level] || levels.bronze
                })()}</span>
                <span className="text-sm font-medium">
                  {t('referral_your_level')}: {t(`referral_level_${referralStats.referral_level || 'bronze'}`)}
                </span>
              </div>
            )}
            {referralStats && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div
                  className="text-center p-2 rounded-xl"
                  style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
                >
                  <div className="text-lg font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>
                    {referralStats.total_referrals || 0}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('referral_invited')}</div>
                </div>
                <div
                  className="text-center p-2 rounded-xl"
                  style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
                >
                  <div className="text-lg font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>
                    {referralStats.total_earnings || 0}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('referral_earned')}</div>
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
                className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-3 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)',
                }}
              >
                <Copy size={16} />
                {t('home_referral_copy_btn')} / {t('home_referral_share_btn')}
              </button>
            ) : (
              <p className="text-sm italic mb-3" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {t('home_referral_link_soon')}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { hapticFeedback('light'); navigate('/partner/apply'); }}
                className="flex-1 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)',
                  color: 'var(--tg-theme-button-color)',
                }}
              >
                {t('referral_become_partner_btn')}
              </button>
              <button
                onClick={() => { hapticFeedback('light'); navigate('/community'); }}
                className="px-4 py-2 text-sm font-medium"
                style={{ color: 'var(--tg-theme-link-color)' }}
              >
                {t('home_referral_more')}
              </button>
            </div>
            {referralToast && (
              <div
                className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm shadow-lg z-50"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)',
                }}
              >
                {referralToast}
              </div>
            )}
          </div>
        )}

        {/* Настройки */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          {[
            {
              icon: <Clock size={18} />,
              label: t('profile_history'),
              onClick: () => { hapticFeedback('light'); navigate('/history') },
            },
            {
              icon: <MessageCircle size={18} />,
              label: t('profile_support'),
              onClick: () => {
                hapticFeedback('light')
                if (window.Telegram?.WebApp) {
                  window.Telegram.WebApp.close()
                }
              },
            },
            {
              icon: <Info size={18} />,
              label: t('profile_about'),
              onClick: () => { hapticFeedback('light'); navigate('/about') },
            },
            {
              icon: <span className="text-base">{getCurrentCurrencyInfo().flag}</span>,
              label: language === 'ru' ? 'Валюта' : 'Currency',
              rightText: getCurrentCurrencyInfo().code,
              onClick: () => { hapticFeedback('light'); setIsCurrencyModalOpen(true) },
            },
          ].map((item, i, arr) => (
            <button
              key={i}
              onClick={item.onClick}
              className="w-full flex items-center justify-between p-4 transition-all active:bg-black/5"
              style={{
                borderBottom: i < arr.length - 1
                  ? '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 12%, transparent)'
                  : 'none',
              }}
            >
              <div className="flex items-center gap-3" style={{ color: 'var(--tg-theme-text-color)' }}>
                <span style={{ color: 'var(--tg-theme-hint-color)' }}>{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.rightText && (
                  <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{item.rightText}</span>
                )}
                <ChevronRight size={16} style={{ color: 'var(--tg-theme-hint-color)' }} />
              </div>
            </button>
          ))}
        </div>

        {/* Статус */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 8%, transparent)',
          }}
        >
          <div>
            <h3 className="font-bold text-sm">{t('profile_status')}</h3>
            <p className="text-sm" style={{ color: 'var(--tg-theme-button-color)' }}>
              {clientData?.status === 'active' ? t('profile_active') : t('profile_inactive')}
            </p>
          </div>
          {clientData?.status === 'active' && (
            <Star size={24} style={{ color: 'var(--tg-theme-button-color)' }} />
          )}
        </div>

        {/* Реферер */}
        {clientData?.referrer_chat_id && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <h3 className="font-bold text-sm mb-1">{t('profile_referral')}</h3>
            <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {t('profile_referral_text')}
            </p>
          </div>
        )}

        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
          }}
        >
          <LogOut size={16} />
          {t('profile_logout')}
        </button>

        <Footer />
      </div>

      {/* Модальное окно выбора валюты */}
      {isCurrencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsCurrencyModalOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-t-2xl p-5 pb-8 shadow-2xl"
            style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {language === 'ru' ? 'Выберите валюту' : 'Select currency'}
              </h3>
              <button
                onClick={() => setIsCurrencyModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {language === 'ru'
                ? 'Цены будут отображаться в выбранной валюте'
                : 'Prices will be displayed in selected currency'}
            </p>
            <div className="space-y-2">
              {SUPPORTED_CURRENCIES.map((curr) => (
                <button
                  key={curr.code}
                  onClick={() => handleCurrencySelect(curr.code)}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all active:scale-[0.98]"
                  style={{
                    backgroundColor: currency === curr.code
                      ? 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)'
                      : 'var(--tg-theme-secondary-bg-color)',
                    border: currency === curr.code
                      ? '2px solid var(--tg-theme-button-color)'
                      : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{curr.flag}</span>
                    <div className="text-left">
                      <div className="font-semibold text-sm">{curr.code}</div>
                      <div className="text-[11px]" style={{ color: 'var(--tg-theme-hint-color)' }}>
                        {language === 'ru' ? curr.nameRu : curr.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--tg-theme-button-color)' }}>{curr.symbol}</span>
                    {currency === curr.code && (
                      <CheckCircle size={18} style={{ color: 'var(--tg-theme-button-color)' }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Profile
