import { useState } from 'react'

const LoyaltyProgress = ({ balance }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  // Определение уровней лояльности
  const loyaltyLevels = [
    { name: 'Новичок', emoji: '💎', min: 0, max: 99, color: 'from-pink-400 to-pink-500' },
    { name: 'Друг', emoji: '🌸', min: 100, max: 499, color: 'from-pink-500 to-purple-400' },
    { name: 'VIP', emoji: '💖', min: 500, max: 999, color: 'from-purple-400 to-purple-500' },
    { name: 'Платина', emoji: '⭐', min: 1000, max: Infinity, color: 'from-amber-400 to-pink-400' }
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
          <span className="text-xl">{currentLevel.emoji}</span>
          <span className="text-sm font-semibold text-gray-700">
            {currentLevel.name}
          </span>
        </div>
        {nextLevel && (
          <span className="text-xs text-gray-500">
            До {nextLevel.emoji} {nextLevel.name}: {pointsToNext}
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
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          {/* Заполненная часть */}
          <div
            className={`h-full bg-gradient-to-r ${currentLevel.color} rounded-full transition-all duration-500 ease-out`}
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
            const isCurrent = level.name === currentLevel.name
            
            return (
              <div
                key={level.name}
                className={`flex flex-col items-center transition-all ${
                  isCurrent ? 'scale-110' : 'scale-90'
                }`}
              >
                <span
                  className={`text-xs transition-all ${
                    isActive ? 'opacity-100 scale-110' : 'opacity-40 scale-90'
                  }`}
                >
                  {level.emoji}
                </span>
              </div>
            )
          })}
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              {nextLevel ? (
                <>
                  <p className="font-semibold mb-1">
                    {currentLevel.emoji} {currentLevel.name} → {nextLevel.emoji} {nextLevel.name}
                  </p>
                  <p>
                    Прогресс: {progress}% ({pointsToNext} баллов до следующего уровня)
                  </p>
                </>
              ) : (
                <p className="font-semibold">
                  🎉 Максимальный уровень! {currentLevel.emoji} {currentLevel.name}
                </p>
              )}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Мобильная подсказка (для тач-устройств) */}
      {!nextLevel && (
        <p className="text-center text-xs text-pink-500 font-semibold mt-1">
          ⭐ Вы достигли максимального уровня!
        </p>
      )}
    </div>
  )
}

export default LoyaltyProgress

