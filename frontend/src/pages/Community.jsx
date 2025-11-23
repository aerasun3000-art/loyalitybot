import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReferralStats, getOrCreateReferralCode } from '../services/supabase'
import { getChatId, getTelegramUser, hapticFeedback } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'

function Community() {
  const navigate = useNavigate()
  const chatId = getChatId()
  const tgUser = getTelegramUser()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const [loading, setLoading] = useState(true)
  const [referralStats, setReferralStats] = useState(null)
  const [referralCode, setReferralCode] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (chatId) {
      loadReferralData()
    } else {
      setLoading(false)
    }
  }, [chatId])

  const loadReferralData = async () => {
    try {
      setLoading(true)
      const stats = await getReferralStats(chatId)
      setReferralStats(stats)
      
      // Получаем реферальный код
      const code = stats?.referral_code || await getOrCreateReferralCode(chatId)
      setReferralCode(code)
    } catch (error) {
      console.error('Error loading referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReferralLink = () => {
    if (!referralCode) return ''
    // Получаем username бота из переменной окружения
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'mindbeatybot'
    return `https://t.me/${botUsername.replace('@', '')}?start=ref_${referralCode}`
  }

  const handleCopyLink = async () => {
    hapticFeedback('light')
    const link = getReferralLink()
    if (link && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Error copying link:', error)
      }
    }
  }

  const getLevelInfo = (level) => {
    const levels = {
      bronze: { emoji: '🥉', name: t('referral_level_bronze'), color: 'text-amber-600' },
      silver: { emoji: '🥈', name: t('referral_level_silver'), color: 'text-gray-400' },
      gold: { emoji: '🥇', name: t('referral_level_gold'), color: 'text-yellow-500' },
      platinum: { emoji: '💎', name: t('referral_level_platinum'), color: 'text-blue-400' }
    }
    return levels[level] || levels.bronze
  }

  const getAchievementProgress = () => {
    if (!referralStats) return []
    const total = referralStats.total_referrals || 0
    return [
      { threshold: 5, bonus: 200, reached: total >= 5 },
      { threshold: 10, bonus: 500, reached: total >= 10 },
      { threshold: 25, bonus: 1500, reached: total >= 25 },
      { threshold: 50, bonus: 3000, reached: total >= 50 }
    ]
  }

  if (loading) {
    return <Loader text={t('loading')} />
  }

  if (!chatId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">{t('referral_auth_required')}</p>
        </div>
      </div>
    )
  }

  const levelInfo = referralStats ? getLevelInfo(referralStats.referral_level) : getLevelInfo('bronze')
  const achievements = getAchievementProgress()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-gradient-to-br from-jewelry-brown-dark via-jewelry-burgundy to-jewelry-gold px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
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
          <h1 className="text-xl font-bold text-white">{t('referral_title')}</h1>
          <div className="w-6" />
        </div>

        {/* Уровень и статистика */}
        {referralStats && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{levelInfo.emoji}</span>
                <div>
                  <div className="text-white/80 text-sm">{t('referral_your_level')}</div>
                  <div className={`text-white font-bold text-lg ${levelInfo.color}`}>
                    {levelInfo.name}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {referralStats.total_referrals || 0}
                </div>
                <div className="text-white/70 text-xs mt-1">{t('referral_total')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {referralStats.active_referrals || 0}
                </div>
                <div className="text-white/70 text-xs mt-1">{t('referral_active')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-jewelry-gold">
                  {referralStats.total_earnings || 0} 💸
                </div>
                <div className="text-white/70 text-xs mt-1">{t('referral_earned')}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Основной контент */}
      <div className="px-4 -mt-4 pb-20">
        {/* Реферальная ссылка */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-4 border border-jewelry-gold/20">
          <div className="flex items-center gap-3 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-lg font-bold text-jewelry-brown-dark">{t('referral_your_link')}</h2>
          </div>
          
          {referralCode ? (
            <>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{t('referral_code')}</p>
                <p className="text-lg font-mono font-bold text-jewelry-brown-dark break-all">
                  {referralCode}
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{t('referral_link')}</p>
                <p className="text-sm text-gray-700 break-all">
                  {getReferralLink() || t('referral_link_generating')}
                </p>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full bg-jewelry-gold text-white py-3 rounded-lg font-semibold hover:bg-jewelry-gold-dark transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('referral_copied')}
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    {t('referral_copy_link')}
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">{t('referral_code_loading')}</p>
            </div>
          )}
        </div>

        {/* Как это работает */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-4 border border-jewelry-gold/20">
          <h2 className="text-lg font-bold text-jewelry-brown-dark mb-4 flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t('referral_how_it_works')}
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-jewelry-gold/10 rounded-full p-2 flex-shrink-0">
                <span className="text-jewelry-gold font-bold">1</span>
              </div>
              <div>
                <p className="font-semibold text-jewelry-brown-dark">{t('referral_step1_title')}</p>
                <p className="text-sm text-gray-600">{t('referral_step1_desc')}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-jewelry-gold/10 rounded-full p-2 flex-shrink-0">
                <span className="text-jewelry-gold font-bold">2</span>
              </div>
              <div>
                <p className="font-semibold text-jewelry-brown-dark">{t('referral_step2_title')}</p>
                <p className="text-sm text-gray-600">{t('referral_step2_desc')}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-jewelry-gold/10 rounded-full p-2 flex-shrink-0">
                <span className="text-jewelry-gold font-bold">3</span>
              </div>
              <div>
                <p className="font-semibold text-jewelry-brown-dark">{t('referral_step3_title')}</p>
                <p className="text-sm text-gray-600">{t('referral_step3_desc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Бонусы */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-4 border border-jewelry-gold/20">
          <h2 className="text-lg font-bold text-jewelry-brown-dark mb-4 flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1" />
            </svg>
            {t('referral_bonuses')}
          </h2>
          
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-jewelry-gold/10 to-jewelry-gold/5 rounded-lg p-4 border border-jewelry-gold/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-jewelry-brown-dark">{t('referral_bonus_registration')}</span>
                <span className="text-jewelry-gold font-bold">+100 💸</span>
              </div>
              <p className="text-sm text-gray-600">{t('referral_bonus_registration_desc')}</p>
            </div>
            
            <div className="bg-gradient-to-r from-jewelry-gold/10 to-jewelry-gold/5 rounded-lg p-4 border border-jewelry-gold/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-jewelry-brown-dark">{t('referral_bonus_transaction')}</span>
                <span className="text-jewelry-gold font-bold">8%</span>
              </div>
              <p className="text-sm text-gray-600">{t('referral_bonus_transaction_desc')}</p>
            </div>
            
            <div className="bg-gradient-to-r from-jewelry-gold/10 to-jewelry-gold/5 rounded-lg p-4 border border-jewelry-gold/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-jewelry-brown-dark">{t('referral_bonus_level2')}</span>
                <span className="text-jewelry-gold font-bold">+25 💸 + 4%</span>
              </div>
              <p className="text-sm text-gray-600">{t('referral_bonus_level2_desc')}</p>
            </div>
            
            <div className="bg-gradient-to-r from-jewelry-gold/10 to-jewelry-gold/5 rounded-lg p-4 border border-jewelry-gold/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-jewelry-brown-dark">{t('referral_bonus_level3')}</span>
                <span className="text-jewelry-gold font-bold">+10 💸 + 2%</span>
              </div>
              <p className="text-sm text-gray-600">{t('referral_bonus_level3_desc')}</p>
            </div>
          </div>
        </div>

        {/* Достижения */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-4 border border-jewelry-gold/20">
          <h2 className="text-lg font-bold text-jewelry-brown-dark mb-4 flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('referral_achievements')}
          </h2>
          
          <div className="space-y-3">
            {achievements.map((achievement, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 border ${
                  achievement.reached
                    ? 'bg-gradient-to-r from-jewelry-gold/20 to-jewelry-gold/10 border-jewelry-gold/40'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {achievement.reached ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-jewelry-gold">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                    )}
                    <div>
                      <p className="font-semibold text-jewelry-brown-dark">
                        {t('referral_achievement').replace('{count}', achievement.threshold)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('referral_achievement_bonus').replace('{bonus}', achievement.bonus)}
                      </p>
                    </div>
                  </div>
                  <span className="text-jewelry-gold font-bold">+{achievement.bonus} 💸</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Последние награды */}
        {referralStats?.recent_rewards && referralStats.recent_rewards.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-lg mb-4 border border-jewelry-gold/20">
            <h2 className="text-lg font-bold text-jewelry-brown-dark mb-4">{t('referral_recent_rewards')}</h2>
            
            <div className="space-y-2">
              {referralStats.recent_rewards.slice(0, 5).map((reward, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-jewelry-brown-dark">
                      {reward.description || t('referral_reward')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(reward.created_at).toLocaleDateString(language === 'ru' ? 'ru' : 'en')}
                    </p>
                  </div>
                  <span className="text-jewelry-gold font-bold">+{reward.points} 💸</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Community
