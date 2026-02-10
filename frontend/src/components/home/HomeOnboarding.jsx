const HomeOnboarding = ({ showOnboarding, onboardingStep, language, t, onNext, onDismiss }) => {
  if (!showOnboarding) return null

  const btnPrimary = {
    backgroundColor: 'var(--tg-theme-button-color)',
    color: 'var(--tg-theme-button-text-color, #fff)',
  }
  const btnSecondary = {
    backgroundColor: 'var(--tg-theme-secondary-bg-color)',
    color: 'var(--tg-theme-text-color)',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div className="rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6"
        style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--tg-theme-text-color)' }}>
          {onboardingStep === 1 ? t('onboarding_screen1_title') : t('home_referral_title')}
        </h2>
        <p className="text-sm mb-6 whitespace-pre-line" style={{ color: 'var(--tg-theme-hint-color)' }}>
          {onboardingStep === 1 ? t('onboarding_screen1_text') : t('onboarding_screen2_text')}
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {onboardingStep === 2 ? (
              <button type="button" onClick={onDismiss}
                className="flex-1 py-3 rounded-xl font-semibold text-sm" style={btnPrimary}>
                {t('onboarding_start')}
              </button>
            ) : (
              <>
                <button type="button" onClick={onNext}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm" style={btnPrimary}>
                  {language === 'ru' ? 'Далее' : 'Next'}
                </button>
                <button type="button" onClick={onDismiss}
                  className="py-3 px-4 rounded-xl font-medium text-sm" style={btnSecondary}>
                  {t('onboarding_start')}
                </button>
              </>
            )}
          </div>
          <button type="button" onClick={onDismiss}
            className="mt-2 text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {t('onboarding_dont_show_again')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomeOnboarding
