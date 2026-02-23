import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReferralStats, getOrCreateReferralCode } from '../services/supabase'
import { getChatId, getTelegramUser, hapticFeedback } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'
import Layout from '../components/Layout'
import { Link2, Clock, Star, Copy, Check, Users, Trophy, Zap } from 'lucide-react'

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
    const botUsername = import.meta.env.VITE_CLIENT_BOT_USERNAME || 'mindbeatybot'
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
      bronze: { emoji: '🥉', name: t('referral_level_bronze') },
      silver: { emoji: '🥈', name: t('referral_level_silver') },
      gold: { emoji: '🥇', name: t('referral_level_gold') },
      platinum: { emoji: '💎', name: t('referral_level_platinum') }
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
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>{t('referral_auth_required')}</p>
        </div>
      </Layout>
    )
  }

  const levelInfo = referralStats ? getLevelInfo(referralStats.referral_level) : getLevelInfo('bronze')
  const achievements = getAchievementProgress()

  return (
    <Layout>
      <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-4">
        {/* Заголовок */}
        <h1 className="text-xl font-bold pt-2">{t('referral_title')}</h1>

        {/* Уровень и статистика */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, var(--tg-theme-button-color), color-mix(in srgb, var(--tg-theme-button-color) 60%, rgb(var(--sakura-deep))))',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{levelInfo.emoji}</span>
            <div>
              <div className="text-white/80 text-sm">{t('referral_your_level')}</div>
              <div className="text-white font-bold text-lg">{levelInfo.name}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-xl font-bold text-white">
                {referralStats?.total_referrals ?? 0}
              </div>
              <div className="text-white/70 text-[11px] mt-0.5">{t('referral_total')}</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-xl font-bold text-white">
                {referralStats?.active_referrals ?? 0}
              </div>
              <div className="text-white/70 text-[11px] mt-0.5">{t('referral_active')}</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-xl font-bold text-white">
                {referralStats?.total_earnings ?? 0}
              </div>
              <div className="text-white/70 text-[11px] mt-0.5">{t('referral_earned')}</div>
            </div>
          </div>
        </div>

        {/* Реферальная ссылка */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={18} style={{ color: 'var(--tg-theme-button-color)' }} />
            <h2 className="font-bold">{t('referral_your_link')}</h2>
          </div>

          {(referralStats?.total_referrals ?? 0) === 0 && (
            <p
              className="text-sm mb-3 rounded-xl p-3"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)',
                color: 'var(--tg-theme-text-color)',
              }}
            >
              {t('referral_empty_state')}
            </p>
          )}

          {referralCode ? (
            <>
              <div
                className="rounded-xl p-3 mb-3"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)',
                }}
              >
                <p className="text-[11px] mb-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('referral_code')}</p>
                <p className="text-base font-mono font-bold break-all">{referralCode}</p>
              </div>

              <div
                className="rounded-xl p-3 mb-3"
                style={{
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)',
                }}
              >
                <p className="text-[11px] mb-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('referral_link')}</p>
                <p className="text-sm break-all" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {getReferralLink() || t('referral_link_generating')}
                </p>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)',
                }}
              >
                {copied ? (
                  <>
                    <Check size={18} />
                    {t('referral_copied')}
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    {t('referral_copy_link')}
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p style={{ color: 'var(--tg-theme-hint-color)' }}>{t('referral_code_loading')}</p>
            </div>
          )}
        </div>

        {/* Как это работает */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} style={{ color: 'var(--tg-theme-button-color)' }} />
            <h2 className="font-bold">{t('referral_how_it_works')}</h2>
          </div>

          <div className="space-y-3">
            {[
              { num: 1, title: t('referral_step1_title'), desc: t('referral_step1_desc') },
              { num: 2, title: t('referral_step2_title'), desc: t('referral_step2_desc') },
              { num: 3, title: t('referral_step3_title'), desc: t('referral_step3_desc') },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)',
                    color: 'var(--tg-theme-button-color)',
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--tg-theme-hint-color)' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Бонусы */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} style={{ color: 'var(--tg-theme-button-color)' }} />
            <h2 className="font-bold">{t('referral_bonuses')}</h2>
          </div>

          <div className="space-y-2">
            {[
              { title: t('referral_bonus_registration'), value: '+100', desc: t('referral_bonus_registration_desc') },
              { title: t('referral_bonus_transaction'), value: '8%', desc: t('referral_bonus_transaction_desc') },
              { title: t('referral_bonus_level2'), value: '+25 + 4%', desc: t('referral_bonus_level2_desc') },
              { title: t('referral_bonus_level3'), value: '+10 + 2%', desc: t('referral_bonus_level3_desc') },
            ].map((bonus, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 8%, transparent)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{bonus.title}</span>
                  <span className="font-bold text-sm" style={{ color: 'var(--tg-theme-button-color)' }}>
                    {bonus.value}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>{bonus.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Достижения */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} style={{ color: 'var(--tg-theme-button-color)' }} />
            <h2 className="font-bold">{t('referral_achievements')}</h2>
          </div>

          <div className="space-y-2">
            {achievements.map((achievement, index) => (
              <div
                key={index}
                className="rounded-xl p-3 flex items-center justify-between"
                style={{
                  backgroundColor: achievement.reached
                    ? 'color-mix(in srgb, var(--tg-theme-button-color) 12%, transparent)'
                    : 'var(--tg-theme-bg-color)',
                  border: achievement.reached
                    ? '1px solid color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)'
                    : '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)',
                }}
              >
                <div className="flex items-center gap-3">
                  {achievement.reached ? (
                    <Check size={20} style={{ color: 'var(--tg-theme-button-color)' }} />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{ border: '2px solid color-mix(in srgb, var(--tg-theme-hint-color) 30%, transparent)' }}
                    />
                  )}
                  <div>
                    <p className="font-semibold text-sm">
                      {t('referral_achievement').replace('{count}', achievement.threshold)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                      {t('referral_achievement_bonus').replace('{bonus}', achievement.bonus)}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-sm" style={{ color: 'var(--tg-theme-button-color)' }}>
                  +{achievement.bonus}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Последние награды */}
        {referralStats?.recent_rewards && referralStats.recent_rewards.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <h2 className="font-bold mb-3">{t('referral_recent_rewards')}</h2>

            <div className="space-y-2">
              {referralStats.recent_rewards.slice(0, 5).map((reward, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {reward.description || t('referral_reward')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                      {new Date(reward.created_at).toLocaleDateString(language === 'ru' ? 'ru' : 'en')}
                    </p>
                  </div>
                  <span className="font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>+{reward.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Список приглашённых */}
        {referralStats?.referrals_list && referralStats.referrals_list.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
          >
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Users size={16} />
              {t('referral_list_title')}
            </h2>
            <div className="space-y-2">
              {referralStats.referrals_list.map((ref, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
                >
                  <div>
                    <p className="text-sm font-semibold">{ref.referred_name}</p>
                    <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
                      {ref.registered_at
                        ? new Date(ref.registered_at).toLocaleDateString(language === 'ru' ? 'ru' : 'en')
                        : '—'}
                      {ref.level > 1 && (
                        <span className="ml-2">
                          {t('referral_level_short').replace('{n}', ref.level)}
                        </span>
                      )}
                    </p>
                  </div>
                  {ref.total_earned_points > 0 && (
                    <span className="text-sm font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>
                      {t('referral_earned_points').replace('{n}', ref.total_earned_points)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Community
