const QuickRatingModal = ({ quickRatingModal, quickRatingSubmitting, language, onClose, onSubmit, onRatingChange }) => {
  if (!quickRatingModal.open || !quickRatingModal.group) return null
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
    <div className="fixed inset-0 z-[99]" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div className="relative h-full flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative z-10 w-full max-w-sm rounded-2xl shadow-2xl p-6"
          style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
        >
          <h3 className="text-lg font-bold mb-2 text-center" style={{ color: 'var(--tg-theme-text-color)' }}>
            {ru ? 'Оцените мастера' : 'Rate this master'}
          </h3>
          <p className="text-sm text-center mb-4" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {quickRatingModal.group.companyName}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => onRatingChange(n)}
                className="w-10 h-10 rounded-full font-bold text-sm"
                style={quickRatingModal.rating === n ? btnPrimary : btnSecondary}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={btnSecondary}>
              {ru ? 'Отмена' : 'Cancel'}
            </button>
            <button
              onClick={onSubmit}
              disabled={quickRatingModal.rating < 1 || quickRatingSubmitting}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              style={btnPrimary}
            >
              {quickRatingSubmitting ? (ru ? 'Сохранение...' : 'Saving...') : (ru ? 'Отправить' : 'Submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickRatingModal
