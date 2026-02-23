import KarmaIndicator from '../KarmaIndicator'

const HomeBalance = ({ balance, pointsToNextReward, language, t, navigate, declinePoints, karmaScore = 50, karmaLevel = 'reliable' }) => {
  return (
    <div className="rounded-xl p-4 shadow-sm"
      style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
    >
      <p className="font-bold text-base mb-3" style={{ color: 'var(--tg-theme-text-color)' }}>
        {t('home_value_title')}
      </p>

      {/* Баланс */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)' }}>
            <span className="text-base leading-none">💸</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
              {balance} {t('home_points')}
            </span>
            {pointsToNextReward !== null && (
              <span className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
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
        <button onClick={() => navigate('/history')} style={{ color: 'var(--tg-theme-hint-color)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 10L11 14L15 10" strokeWidth="2" />
          </svg>
        </button>
      </div>

      <KarmaIndicator karmaScore={karmaScore} karmaLevel={karmaLevel} />

      <p className="text-xs mt-3" style={{ color: 'var(--tg-theme-hint-color)' }}>
        {t('home_balance_slogan')}
      </p>
    </div>
  )
}

export default HomeBalance
