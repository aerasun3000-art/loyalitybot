import { hapticFeedback } from '../../utils/telegram'
import { shareReferralLink, buildReferralLink } from '../../utils/referralShare'

const HomeReferral = ({ chatId, referralStats, referralCode, referralToast, referralLoading, language, t, navigate, setReferralToast }) => {
  if (!chatId) return null

  const handleShare = async () => {
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
  }

  return (
    <div className="mt-4 bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-sakura-border/40">
      <h3 className="font-bold text-sakura-deep text-sm mb-1">{t('home_referral_title')}</h3>
      <p className="text-sakura-mid text-xs mb-3">{t('home_referral_subtitle')}</p>
      {(referralStats?.total_referrals ?? 0) === 0 && (
        <p className="text-sakura-mid text-xs mb-3 rounded-lg bg-sakura-mid/10 p-2 border border-sakura-border/30">
          {t('referral_empty_state')}
        </p>
      )}
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
      <p className="text-sakura-mid text-xs mb-3">{t('referral_partner_cta')}</p>
      {referralLoading ? (
        <div className="space-y-2">
          <div className="h-10 bg-sakura-mid/20 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-sakura-mid/20 rounded animate-pulse" />
            <div className="h-8 w-16 bg-sakura-mid/20 rounded animate-pulse" />
          </div>
        </div>
      ) : referralCode ? (
        <div className="space-y-2">
          <button
            onClick={handleShare}
            className="w-full bg-sakura-accent/80 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-sakura-accent transition-colors flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="16 6 12 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t('home_referral_copy_btn')} / {t('home_referral_share_btn')}
          </button>
          <div className="flex items-center justify-between">
            <button
              onClick={() => { hapticFeedback('light'); navigate('/partner/apply'); }}
              className="text-sakura-deep font-semibold text-xs hover:underline"
            >
              {t('referral_become_partner_btn')} →
            </button>
            <button
              onClick={() => { hapticFeedback('light'); navigate('/community'); }}
              className="text-sakura-mid text-xs hover:underline"
            >
              {t('home_referral_more')} →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sakura-mid text-xs italic">{t('home_referral_link_soon')}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => { hapticFeedback('light'); navigate('/partner/apply'); }}
              className="text-sakura-deep font-semibold text-xs hover:underline"
            >
              {t('referral_become_partner_btn')} →
            </button>
            <button
              onClick={() => { hapticFeedback('light'); navigate('/community'); }}
              className="text-sakura-mid text-xs hover:underline"
            >
              {t('home_referral_more')} →
            </button>
          </div>
        </div>
      )}
      {referralToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-sakura-deep text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50 animate-pulse">
          {referralToast}
        </div>
      )}
    </div>
  )
}

export default HomeReferral
