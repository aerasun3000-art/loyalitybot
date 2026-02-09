const QuickRatingModal = ({ quickRatingModal, quickRatingSubmitting, language, onClose, onSubmit, onRatingChange }) => {
  if (!quickRatingModal.open || !quickRatingModal.group) return null

  return (
    <div className="fixed inset-0 z-[99] animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-sakura-deep/50 backdrop-blur-sm" />
      <div className="relative h-full flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative z-10 w-full max-w-sm bg-sakura-surface/95 border border-sakura-border/60 rounded-3xl shadow-2xl p-6 animate-scale-in">
          <h3 className="text-lg font-bold text-sakura-dark mb-2 text-center">
            {language === 'ru' ? 'Оцените мастера' : 'Rate this master'}
          </h3>
          <p className="text-sm text-sakura-dark/70 text-center mb-4">{quickRatingModal.group.companyName}</p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => onRatingChange(n)}
                className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${
                  quickRatingModal.rating === n ? 'bg-sakura-accent text-white' : 'bg-sakura-surface/30 text-sakura-dark'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full bg-sakura-surface/30 text-sakura-dark font-semibold"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              onClick={onSubmit}
              disabled={quickRatingModal.rating < 1 || quickRatingSubmitting}
              className="flex-1 py-2.5 rounded-full bg-sakura-accent text-white font-semibold disabled:opacity-50"
            >
              {quickRatingSubmitting ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? 'Отправить' : 'Submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickRatingModal
