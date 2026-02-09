import { hapticFeedback } from '../../utils/telegram'

const EmptyCategoryModal = ({ isOpen, emptyCategoryCode, language, t, navigate, onClose }) => {
  if (!isOpen || !emptyCategoryCode) return null

  return (
    <div
      className="fixed inset-0 z-[100] animate-fade-in"
      onClick={() => {
        onClose()
        navigate('/')
      }}
      style={{ zIndex: 1000 }}
    >
      <div className="absolute inset-0 bg-sakura-deep/50 backdrop-blur-sm" />
      <div
        className="relative h-full flex items-center justify-center px-4 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-10 w-full max-w-md bg-sakura-surface/95 border border-sakura-border/60 rounded-3xl shadow-2xl p-6 animate-scale-in">
          <button
            onClick={() => {
              onClose()
              navigate('/')
            }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full border border-sakura-border/40 bg-sakura-surface/20 text-sakura-dark hover:bg-sakura-surface/30 transition-colors z-20"
            aria-label="Закрыть"
          >
            ×
          </button>
          <div className="space-y-4 text-sakura-dark text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold mb-2">
              {language === 'ru' ? 'Место свободно!' : 'Spot Available!'}
            </h2>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-gray-500">Category: {emptyCategoryCode}</p>
            )}
            <p className="text-sakura-dark/80 mb-6">
              {language === 'ru'
                ? 'В этой категории пока нет партнеров. Станьте первым и получите преимущество!'
                : 'There are no partners in this category yet. Be the first and get an advantage!'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  hapticFeedback('medium')
                  navigate('/partner/apply')
                  onClose()
                }}
                className="w-full py-3 rounded-full bg-gradient-to-r from-sakura-mid to-sakura-dark text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {language === 'ru' ? '🤝 Стать партнером' : '🤝 Become a Partner'}
              </button>
              <button
                onClick={() => {
                  hapticFeedback('light')
                  onClose()
                  navigate('/community')
                }}
                className="w-full py-3 rounded-full bg-sakura-accent/90 text-white font-semibold shadow-md border border-sakura-border hover:bg-sakura-accent transition-colors"
              >
                {t('spot_recommend_place')}
              </button>
              <button
                onClick={() => {
                  hapticFeedback('light')
                  onClose()
                  navigate('/')
                }}
                className="w-full py-3 rounded-full bg-white text-sakura-dark font-semibold shadow-md border border-sakura-border hover:bg-sakura-surface transition-colors"
              >
                {language === 'ru' ? 'Закрыть' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmptyCategoryModal
