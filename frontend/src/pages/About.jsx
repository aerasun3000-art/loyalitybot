import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import { hapticFeedback } from '../utils/telegram'

const About = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  const handleBecomePartner = () => {
    hapticFeedback('medium')
    navigate('/partner/apply')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Шапка */}
      <div className="bg-gradient-to-br from-pink-400 to-rose-500 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/profile')
            }}
            className="text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">{t('about_title')}</h1>
          <div className="w-6" />
        </div>

        <div className="text-center">
          <div className="text-6xl mb-4">💖</div>
          <h2 className="text-2xl font-bold text-white mb-2">LoyaltyBot</h2>
          <p className="text-white/90 text-sm">{t('about_subtitle')}</p>
        </div>
      </div>

      {/* Контент */}
      <div className="px-4 -mt-4">
        {/* О программе */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">ℹ️</span>
            <h3 className="font-bold text-gray-800 text-lg">{t('about_what_is')}</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-4">
            {t('about_description')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-pink-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-xs text-gray-700 font-medium">{t('about_earn_points')}</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">🎁</div>
              <div className="text-xs text-gray-700 font-medium">{t('about_get_rewards')}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">⭐</div>
              <div className="text-xs text-gray-700 font-medium">{t('about_vip_status')}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">🤝</div>
              <div className="text-xs text-gray-700 font-medium">{t('about_partners')}</div>
            </div>
          </div>
        </div>

        {/* Как это работает */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔄</span>
            <h3 className="font-bold text-gray-800 text-lg">{t('about_how_it_works')}</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">{t('about_step1_title')}</h4>
                <p className="text-sm text-gray-600">{t('about_step1_text')}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">{t('about_step2_title')}</h4>
                <p className="text-sm text-gray-600">{t('about_step2_text')}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">{t('about_step3_title')}</h4>
                <p className="text-sm text-gray-600">{t('about_step3_text')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Призыв стать партнером */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 shadow-lg mb-4 relative overflow-hidden">
          {/* Декоративные элементы */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">🤝</span>
              <h3 className="font-bold text-white text-lg">
                {t('profile_become_partner')}
              </h3>
            </div>
            <p className="text-white/90 text-sm mb-4">
              {t('about_partner_cta')}
            </p>
            <button
              onClick={handleBecomePartner}
              className="w-full bg-white text-purple-600 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all transform hover:scale-105 shadow-lg"
            >
              {t('profile_partner_button')} →
            </button>
          </div>
        </div>

        {/* Информация о приложении */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h3 className="font-bold text-gray-800 mb-3">{t('about_app_info')}</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>{t('about_version')}</span>
              <span className="font-semibold text-gray-800">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>{t('about_platform')}</span>
              <span className="font-semibold text-gray-800">Telegram Mini App</span>
            </div>
            <div className="flex justify-between">
              <span>{t('about_support')}</span>
              <span className="font-semibold text-pink-500">support@loyaltybot.com</span>
            </div>
          </div>
        </div>

        {/* Социальные сети */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 text-center">{t('about_follow_us')}</h3>
          <div className="flex justify-center gap-4">
            <button className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl hover:scale-110 transition-transform">
              📘
            </button>
            <button className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white text-xl hover:scale-110 transition-transform">
              📷
            </button>
            <button className="w-12 h-12 bg-sky-500 rounded-full flex items-center justify-center text-white text-xl hover:scale-110 transition-transform">
              🐦
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default About

