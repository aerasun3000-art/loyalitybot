import { hapticFeedback } from '../../utils/telegram'

const EmptyCategoryModal = ({ isOpen, emptyCategoryCode, language, t, navigate, onClose }) => {
  if (!isOpen || !emptyCategoryCode) return null
  const ru = language === 'ru'

  const btnPrimary = {
    backgroundColor: 'var(--tg-theme-button-color)',
    color: 'var(--tg-theme-button-text-color, #fff)',
  }
  const btnSecondary = {
    backgroundColor: 'var(--tg-theme-secondary-bg-color)',
    color: 'var(--tg-theme-text-color)',
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      onClick={() => { onClose(); navigate('/') }}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div className="relative h-full flex items-center justify-center px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl p-6"
          style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
        >
          <button
            onClick={() => { onClose(); navigate('/') }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-hint-color)' }}
            aria-label="Закрыть"
          >
            ×
          </button>
          <div className="space-y-4 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {ru ? 'Место свободно!' : 'Spot Available!'}
            </h2>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>Category: {emptyCategoryCode}</p>
            )}
            <p style={{ color: 'var(--tg-theme-hint-color)' }}>
              {ru
                ? 'В этой категории пока нет партнеров. Станьте первым и получите преимущество!'
                : 'There are no partners in this category yet. Be the first and get an advantage!'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { hapticFeedback('medium'); navigate('/partner/apply'); onClose() }}
                className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98]"
                style={btnPrimary}
              >
                {ru ? '🤝 Стать партнером' : '🤝 Become a Partner'}
              </button>
              <button
                onClick={() => { hapticFeedback('light'); onClose(); navigate('/community') }}
                className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98]"
                style={btnSecondary}
              >
                {t('spot_recommend_place')}
              </button>
              <button
                onClick={() => { hapticFeedback('light'); onClose(); navigate('/') }}
                className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98]"
                style={btnSecondary}
              >
                {ru ? 'Закрыть' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmptyCategoryModal
