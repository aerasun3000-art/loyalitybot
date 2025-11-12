import { useState } from 'react'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
// import LuxuryIcon from './LuxuryIcons'

const LoyaltyProgress = ({ balance }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  // Определение уровней лояльности
  const loyaltyLevels = [
    { nameKey: 'loyalty_level_newbie', icon: 'diamond', emoji: '💎', min: 0, max: 99, color: 'from-sakura-border to-sakura-mid' },
    { nameKey: 'loyalty_level_friend', icon: 'flower', emoji: '🌸', min: 100, max: 499, color: 'from-sakura-accent to-sakura-mid' },
    { nameKey: 'loyalty_level_vip', icon: 'heart', emoji: '❤️', min: 500, max: 999, color: 'from-sakura-mid to-sakura-deep' },
    { nameKey: 'loyalty_level_platinum', icon: 'star', emoji: '⭐', min: 1000, max: Infinity, color: 'from-sakura-deep to-sakura-dark' }
  ]

  // Определение текущего статуса
  const getCurrentLevel = () => {
    return loyaltyLevels.find(level => balance >= level.min && balance <= level.max) || loyaltyLevels[0]
  }

  // Определение следующего статуса
  const getNextLevel = () => {
    const currentIndex = loyaltyLevels.findIndex(level => balance >= level.min && balance <= level.max)
    return currentIndex < loyaltyLevels.length - 1 ? loyaltyLevels[currentIndex + 1] : null
  }

  const currentLevel = getCurrentLevel()
  const nextLevel = getNextLevel()

  // Расчет прогресса
  const calculateProgress = () => {
    if (!nextLevel) return 100 // Максимальный уровень
    
    const pointsInCurrentLevel = balance - currentLevel.min
    const totalPointsNeeded = nextLevel.min - currentLevel.min
    return Math.min(Math.round((pointsInCurrentLevel / totalPointsNeeded) * 100), 100)
  }

  const progress = calculateProgress()
  const pointsToNext = nextLevel ? nextLevel.min - balance : 0

  return (
    <div className="relative">
      {/* Заголовок статуса */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none text-sakura-accent">{currentLevel.emoji}</span>
          <span className="text-sm font-semibold text-sakura-deep">
            {t(currentLevel.nameKey)}
          </span>
        </div>
        {nextLevel && (
          <span className="text-xs text-sakura-mid flex items-center gap-1">
            {t('loyalty_to')} <span className="text-sm leading-none">{nextLevel.emoji}</span> {t(nextLevel.nameKey)}: {pointsToNext}
          </span>
        )}
      </div>

      {/* Прогресс-бар */}
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {/* Фон прогресс-бара */}
        <div className="h-2 bg-sakura-border/30 rounded-lg overflow-hidden">
          {/* Заполненная часть */}
          <div
            className={`h-full bg-gradient-to-r ${currentLevel.color} rounded-lg transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>

        {/* Метки уровней */}
        <div className="flex justify-between mt-1">
          {loyaltyLevels.map((level, index) => {
            const isActive = balance >= level.min
            const isCurrent = level.nameKey === currentLevel.nameKey
            
            return (
              <div
                key={level.nameKey}
                className={`flex flex-col items-center transition-all ${
                  isCurrent ? 'scale-110' : 'scale-90'
                }`}
              >
                <div
                className={`transition-all ${
                    isActive ? 'opacity-100 scale-110 text-sakura-accent' : 'opacity-60 scale-90 text-sakura-border'
                  }`}
                >
                  <span className="text-lg leading-none">{level.emoji}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
            <div className="bg-sakura-deep text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              {nextLevel ? (
                <>
                  <p className="font-semibold mb-1 flex items-center gap-1">
                    <span className="text-sm leading-none">{currentLevel.emoji}</span> {t(currentLevel.nameKey)} → <span className="text-sm leading-none">{nextLevel.emoji}</span> {t(nextLevel.nameKey)}
                  </p>
                  <p>
                    {t('loyalty_progress')}: {progress}% ({pointsToNext} {t('loyalty_points_to_next')})
                  </p>
                </>
              ) : (
                <p className="font-semibold flex items-center gap-1">
                  <span className="text-sm leading-none">🎉</span> {t('loyalty_max_level')} <span className="text-sm leading-none">{currentLevel.emoji}</span> {t(currentLevel.nameKey)}
                </p>
              )}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-2 h-2 bg-sakura-deep rotate-45" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Мобильная подсказка (для тач-устройств) */}
      {!nextLevel && (
        <p className="text-center text-xs text-sakura-accent font-semibold mt-1 flex items-center justify-center gap-1">
          <span className="text-sm leading-none">⭐</span> {t('loyalty_max_reached')}
        </p>
      )}
    </div>
  )
}

export default LoyaltyProgress

