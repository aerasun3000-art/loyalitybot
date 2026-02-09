const HomeOnboarding = ({ showOnboarding, onboardingStep, language, t, onNext, onDismiss }) => {
  if (!showOnboarding) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-sakura-deep/90 p-4 animate-fade-in">
      <div className="bg-white dark:bg-sakura-dark rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-sakura-deep mb-4">
          {onboardingStep === 1 ? t('onboarding_screen1_title') : t('home_referral_title')}
        </h2>
        <p className="text-sakura-mid text-sm mb-6 whitespace-pre-line">
          {onboardingStep === 1 ? t('onboarding_screen1_text') : t('onboarding_screen2_text')}
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {onboardingStep === 2 ? (
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 py-3 rounded-xl bg-sakura-accent text-white font-semibold"
              >
                {t('onboarding_start')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onNext}
                  className="flex-1 py-3 rounded-xl bg-sakura-accent text-white font-semibold"
                >
                  {language === 'ru' ? 'Далее' : 'Next'}
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="py-3 px-4 rounded-xl border border-sakura-border text-sakura-deep font-medium"
                >
                  {t('onboarding_start')}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 text-xs text-sakura-mid hover:underline"
          >
            {t('onboarding_dont_show_again')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomeOnboarding
