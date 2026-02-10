import Loader from '../Loader'

const HomeNews = ({ translatedNews, translating, language, t, navigate, onNewsClick, formatDate }) => {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--tg-theme-text-color)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--tg-theme-text-color)' }}>
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t('news_latest')}
        </h2>
        {translatedNews.length > 0 && (
          <button onClick={() => navigate('/news')}
            className="font-semibold text-sm px-3 py-1 rounded-lg"
            style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)', color: 'var(--tg-theme-button-color)' }}
          >
            {t('home_see_all')} →
          </button>
        )}
        {translating && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
            <Loader size="sm" />
            <span>{t('translating') || 'Перевод...'}</span>
          </div>
        )}
      </div>

      {/* Карусель новостей */}
      <div className="overflow-x-auto flex gap-3 pb-4 scrollbar-hide mb-6 snap-x snap-mandatory">
        {translatedNews.length > 0 ? (
          translatedNews.map((item) => (
            <div
              key={item.id}
              onClick={() => onNewsClick(item.id)}
              className="group flex-shrink-0 w-64 rounded-xl overflow-hidden shadow-sm cursor-pointer snap-start active:scale-[0.985]"
              style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
            >
              {item.image_url ? (
                <div className="h-24 relative overflow-hidden">
                  <img src={item.image_url} alt={item.title} loading="lazy" decoding="async"
                    className="w-full h-full object-cover opacity-65" />
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg"
                    style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center relative"
                  style={{ backgroundColor: 'var(--tg-theme-button-color)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                    style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
                    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg"
                    style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold mb-2 flex items-center gap-2 line-clamp-2 min-h-[3rem]"
                  style={{ color: 'var(--tg-theme-text-color)' }}>
                  {item.title}
                </h3>
                <p className="text-sm line-clamp-2" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {item.preview_text || item.content.substring(0, 80) + '...'}
                </p>
                <div className="mt-3 inline-flex items-center gap-1 font-semibold text-sm"
                  style={{ color: 'var(--tg-theme-button-color)' }}>
                  <span>{language === 'ru' ? 'Подробнее' : 'Read more'}</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Карточка 1: Добро пожаловать */}
            <div className="flex-shrink-0 w-64 rounded-xl overflow-hidden shadow-sm cursor-pointer snap-start active:scale-[0.985]"
              onClick={() => navigate('/news')}
              style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
              <div className="h-24 flex items-center justify-center"
                style={{ backgroundColor: 'var(--tg-theme-button-color)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                  style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                  {language === 'ru' ? 'Добро пожаловать!' : 'Welcome!'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {language === 'ru' ? 'Накапливайте баллы за каждую покупку у наших партнёров и обменивайте на услуги!' : 'Earn points for every purchase from our partners and redeem for services!'}
                </p>
                <div className="mt-3 inline-flex items-center gap-1 font-semibold text-sm"
                  style={{ color: 'var(--tg-theme-button-color)' }}>
                  <span>{language === 'ru' ? 'Перейти к новостям' : 'Go to news'}</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>

            {/* Карточка 2: Акции месяца */}
            <div className="flex-shrink-0 w-64 rounded-xl overflow-hidden shadow-sm cursor-pointer snap-start active:scale-[0.985]"
              onClick={() => navigate('/promotions')}
              style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
              <div className="h-24 flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 80%, #000)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                  style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                  {language === 'ru' ? 'Акции месяца' : 'Monthly deals'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {language === 'ru' ? 'Специальные предложения от партнёров - скидки до 50%!' : 'Special offers from partners - up to 50% off!'}
                </p>
                <div className="mt-3 inline-flex items-center gap-1 font-semibold text-sm"
                  style={{ color: 'var(--tg-theme-button-color)' }}>
                  <span>{language === 'ru' ? 'Открыть акции' : 'View deals'}</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>

            {/* Карточка 3: Реферальная программа */}
            <div className="flex-shrink-0 w-64 rounded-xl overflow-hidden shadow-sm cursor-pointer snap-start active:scale-[0.985]"
              onClick={() => navigate('/profile')}
              style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
              <div className="h-24 flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 60%, #000)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                  style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
                  <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="17" cy="11" r="1" fill="currentColor" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                  {language === 'ru' ? 'Реферальная программа' : 'Referral program'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {language === 'ru' ? 'Приглашайте друзей и получайте бонусные баллы за каждого!' : 'Invite friends and earn bonus points!'}
                </p>
                <div className="mt-3 inline-flex items-center gap-1 font-semibold text-sm"
                  style={{ color: 'var(--tg-theme-button-color)' }}>
                  <span>{language === 'ru' ? 'Открыть рефералы' : 'View referrals'}</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default HomeNews
