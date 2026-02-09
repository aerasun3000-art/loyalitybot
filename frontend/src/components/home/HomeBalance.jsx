import LoyaltyProgress from '../LoyaltyProgress'

const HomeBalance = ({ balance, pointsToNextReward, language, t, navigate, declinePoints }) => {
  return (
    <div className="fade-in-up bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-sakura-border/40 transition-shadow hover:shadow-2xl">
      <p className="text-sakura-deep font-bold text-base mb-3">
        {t('home_value_title')}
      </p>

      {/* Баланс */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-sakura-border/50 bg-gradient-to-br from-white/35 to-sakura-surface/38 backdrop-blur-sm shadow">
            <span className="text-sakura-deep text-base leading-none">💸</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sakura-dark">{balance} {t('home_points')}</span>
            {pointsToNextReward !== null && (
              <span className="text-xs text-sakura-dark/60">
                {pointsToNextReward > 0
                  ? t('home_points_to_next_reward', {
                      points: pointsToNextReward,
                      pointsWord: language === 'ru' ? declinePoints(pointsToNextReward) : 'points'
                    })
                  : t('home_points_ready')}
              </span>
            )}
          </div>
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

      {/* Прогресс-бар статуса лояльности */}
      <LoyaltyProgress balance={balance} />

      <p className="text-sakura-mid text-xs mt-3">
        {t('home_balance_slogan')}
      </p>
    </div>
  )
}

export default HomeBalance
