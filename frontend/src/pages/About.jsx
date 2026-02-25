import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import { hapticFeedback } from '../utils/telegram'
// import LuxuryIcon from '../components/LuxuryIcons'
import Footer from '../components/Footer'

const About = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const handleBecomePartner = () => {
    hapticFeedback('medium')
    navigate('/partner/apply')
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
      {/* Шапка */}
      <div className="px-4 pt-6 pb-8" style={{ backgroundColor: 'var(--tg-theme-button-color)' }}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { hapticFeedback('light'); navigate('/profile') }}
            style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            {t('about_title')}
          </h1>
          <div className="w-6" />
        </div>

        <div className="text-center" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
          <img src="/logo.svg" alt="" className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sarafano.io</h2>
          <p className="text-sm opacity-90">{t('about_subtitle')}</p>
        </div>
      </div>

      {/* Контент */}
      <div className="px-4 -mt-4">
        {/* О программе */}
        <div className="rounded-2xl p-6 shadow-lg mb-4" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-lg leading-none">ℹ️</span>
            <h3 className="font-bold text-lg" style={{ color: 'var(--tg-theme-text-color)' }}>{t('about_what_is')}</h3>
          </div>
          <p className="leading-relaxed mb-4" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {t('about_description')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: '💰', key: 'about_earn_points' },
              { emoji: '🎉', key: 'about_get_rewards' },
              { emoji: '⭐', key: 'about_vip_status' },
              { emoji: '🧠', key: 'about_partners' },
            ].map((item) => (
              <div key={item.key} className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)' }}>
                <span className="text-lg leading-none mx-auto mb-1">{item.emoji}</span>
                <div className="text-xs font-medium" style={{ color: 'var(--tg-theme-text-color)' }}>{t(item.key)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Как это работает */}
        <div className="rounded-2xl p-6 shadow-lg mb-4" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔄</span>
            <h3 className="font-bold text-lg" style={{ color: 'var(--tg-theme-text-color)' }}>{t('about_how_it_works')}</h3>
          </div>

          <div className="space-y-4">
            {[
              { num: 1, titleKey: 'about_step1_title', textKey: 'about_step1_text' },
              { num: 2, titleKey: 'about_step2_title', textKey: 'about_step2_text' },
              { num: 3, titleKey: 'about_step3_title', textKey: 'about_step3_text' },
            ].map((step) => (
              <div key={step.num} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }}>
                  {step.num}
                </div>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: 'var(--tg-theme-text-color)' }}>{t(step.titleKey)}</h4>
                  <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{t(step.textKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Призыв стать партнером */}
        <div className="rounded-2xl p-6 shadow-lg mb-4 relative overflow-hidden"
          style={{ backgroundColor: 'var(--tg-theme-button-color)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full -ml-12 -mb-12" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl leading-none">🧠</span>
              <h3 className="font-bold text-lg" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
                {t('profile_become_partner')}
              </h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--tg-theme-button-text-color, #fff)', opacity: 0.9 }}>
              {t('about_partner_cta')}
            </p>
            <button onClick={handleBecomePartner}
              className="w-full py-3 rounded-xl font-semibold active:scale-95 shadow-lg"
              style={{ backgroundColor: 'var(--tg-theme-bg-color)', color: 'var(--tg-theme-button-color)' }}
            >
              {t('profile_partner_button')} →
            </button>
          </div>
        </div>

        {/* Информация о приложении */}
        <div className="rounded-2xl p-6 shadow-sm mb-4" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--tg-theme-text-color)' }}>{t('about_app_info')}</h3>
          <div className="space-y-2 text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
            <div className="flex justify-between">
              <span>{t('about_version')}</span>
              <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>{t('about_platform')}</span>
              <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>Telegram Mini App</span>
            </div>
            <div className="flex justify-between">
              <span>{t('about_support')}</span>
              <span className="font-semibold" style={{ color: 'var(--tg-theme-button-color)' }}>support@sarafano.io</span>
            </div>
          </div>
        </div>

        {/* Социальные сети */}
        <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
          <h3 className="font-bold mb-4 text-center" style={{ color: 'var(--tg-theme-text-color)' }}>{t('about_follow_us')}</h3>
          <div className="flex justify-center gap-4">
            <button className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl active:scale-95">
              📘
            </button>
            <button className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white text-xl active:scale-95">
              📷
            </button>
            <button className="w-12 h-12 bg-sky-500 rounded-full flex items-center justify-center text-white text-xl active:scale-95">
              🐦
            </button>
          </div>
        </div>
      </div>

      {/* Footer with legal links */}
      <Footer />
    </div>
  )
}

export default About
