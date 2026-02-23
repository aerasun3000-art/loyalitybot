import { useState } from 'react'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const KARMA_LEVELS = [
  { key: 'sprout', nameKey: 'karma_level_sprout', emoji: '🌱', min: 0, max: 25, color: 'var(--tg-theme-hint-color)' },
  { key: 'reliable', nameKey: 'karma_level_reliable', emoji: '🌿', min: 26, max: 50, color: '#4CAF50' },
  { key: 'regular', nameKey: 'karma_level_regular', emoji: '🌳', min: 51, max: 75, color: '#2E7D32' },
  { key: 'golden', nameKey: 'karma_level_golden', emoji: '👑', min: 76, max: 100, color: '#F9A825' }
]

const KarmaIndicator = ({ karmaScore, karmaLevel }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const getCurrentLevel = () => {
    return KARMA_LEVELS.find(level => karmaScore >= level.min && karmaScore <= level.max) || KARMA_LEVELS[0]
  }

  const getNextLevel = () => {
    const currentIndex = KARMA_LEVELS.findIndex(level => karmaScore >= level.min && karmaScore <= level.max)
    return currentIndex < KARMA_LEVELS.length - 1 ? KARMA_LEVELS[currentIndex + 1] : null
  }

  const currentLevel = getCurrentLevel()
  const nextLevel = getNextLevel()

  const calculateProgress = () => {
    if (!nextLevel) return 100
    const pointsInCurrentLevel = karmaScore - currentLevel.min
    const totalPointsNeeded = nextLevel.min - currentLevel.min
    return Math.min(Math.round((pointsInCurrentLevel / totalPointsNeeded) * 100), 100)
  }

  const progress = calculateProgress()
  const pointsToNext = nextLevel ? nextLevel.min - karmaScore : 0

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{currentLevel.emoji}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
            {t(currentLevel.nameKey)}
          </span>
        </div>
        {nextLevel && (
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {t('karma_to')} <span className="text-sm leading-none">{nextLevel.emoji}</span> {t(nextLevel.nameKey)}: {pointsToNext}
          </span>
        )}
      </div>

      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <div className="h-2 rounded-lg overflow-hidden"
          style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)' }}>
          <div
            className="h-full rounded-lg"
            style={{ width: `${progress}%`, backgroundColor: currentLevel.color }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>

        <div className="flex justify-between mt-1">
          {KARMA_LEVELS.map((level) => {
            const isActive = karmaScore >= level.min
            const isCurrent = level.nameKey === currentLevel.nameKey

            return (
              <div
                key={level.nameKey}
                className={`flex flex-col items-center ${isCurrent ? 'scale-110' : 'scale-90'}`}
              >
                <div className={isActive ? 'opacity-100 scale-110' : 'opacity-40 scale-90'}>
                  <span className="text-lg leading-none">{level.emoji}</span>
                </div>
              </div>
            )
          })}
        </div>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
            <div className="text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
              style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }}>
              <p className="font-semibold mb-1">{t('karma_tooltip_title')}</p>
              {nextLevel ? (
                <>
                  <p className="mb-1 flex items-center gap-1">
                    <span className="text-sm leading-none">{currentLevel.emoji}</span> {t(currentLevel.nameKey)} → <span className="text-sm leading-none">{nextLevel.emoji}</span> {t(nextLevel.nameKey)}
                  </p>
                  <p>
                    {t('karma_progress')}: {progress}% ({pointsToNext} {t('karma_points_to_next')})
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-1">
                  <span className="text-sm leading-none">🎉</span> {t('karma_max_level')} <span className="text-sm leading-none">{currentLevel.emoji}</span> {t(currentLevel.nameKey)}
                </p>
              )}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-2 h-2 rotate-45" style={{ backgroundColor: 'var(--tg-theme-button-color)' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!nextLevel && (
        <p className="text-center text-xs font-semibold mt-1 flex items-center justify-center gap-1"
          style={{ color: 'var(--tg-theme-text-color)' }}>
          <span className="text-sm leading-none">👑</span> {t('karma_max_reached')}
        </p>
      )}
    </div>
  )
}

export default KarmaIndicator
