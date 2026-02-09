import Loader from '../Loader'

const HomeNews = ({ translatedNews, translating, language, t, navigate, onNewsClick, formatDate }) => {
  const gradients = [
    'from-sakura-deep to-sakura-accent',
    'from-sakura-accent to-sakura-surface',
    'from-sakura-mid to-sakura-accent',
    'from-sakura-deep to-sakura-mid',
    'from-sakura-accent to-sakura-mid'
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-4 fade-in-up delay-200">
        <h2 className="text-2xl font-bold text-sakura-deep flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t('news_latest')}
        </h2>
        {translatedNews.length > 0 && (
          <button
            onClick={() => navigate('/news')}
            className="bg-sakura-accent/15 text-sakura-deep font-semibold text-sm px-3 py-1 rounded-lg border border-sakura-accent/30 hover:bg-sakura-accent/25 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
          >
            {t('home_see_all')} →
          </button>
        )}
        {translating && (
          <div className="flex items-center gap-2 text-xs text-sakura-mid">
            <Loader size="sm" />
            <span>{t('translating') || 'Перевод...'}</span>
          </div>
        )}
      </div>

      {/* Карусель новостей */}
      <div className="overflow-x-auto flex gap-3 pb-4 scrollbar-hide mb-6 snap-x snap-mandatory">
        {translatedNews.length > 0 ? (
          translatedNews.map((item, index) => {
            const gradient = gradients[index % gradients.length]

            return (
              <div
                key={item.id}
                onClick={() => onNewsClick(item.id)}
                className="group flex-shrink-0 w-64 bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
              >
                {item.image_url ? (
                  <div className="h-24 relative overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover opacity-65 transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg border border-sakura-border/50">
                      <span className="text-xs font-semibold text-sakura-deep">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                    <div className="absolute inset-0 bg-sakura-accent/10" />
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-sakura-bg">
                      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg border border-sakura-border/50">
                      <span className="text-xs font-semibold text-sakura-deep">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-sakura-deep mb-2 flex items-center gap-2 line-clamp-2 min-h-[3rem]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-sakura-mid line-clamp-2">
                    {item.preview_text || item.content.substring(0, 80) + '...'}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm transition-transform duration-300 group-hover:translate-x-0.5 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                    <span>Подробнее</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <>
            {/* Карточка 1: Добро пожаловать */}
            <div className="flex-shrink-0 w-64 bg-sakura-bg rounded-xl overflow-hidden border border-sakura-border shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
              onClick={() => navigate('/news')}>
              <div className="h-24 bg-gradient-to-br from-sakura-mid to-sakura-accent flex items-center justify-center relative">
                <div className="absolute inset-0 bg-sakura-accent/10" />
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-sakura-bg">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 10H16M8 14H16M8 6H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sakura-dark mb-2 flex items-center gap-2">
                  Добро пожаловать!
                </h3>
                <p className="text-sm text-sakura-muted">
                  Накапливайте баллы за каждую покупку у наших партнёров и обменивайте на услуги!
                </p>
                <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  <span>Перейти к новостям</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>

            {/* Карточка 2: Акции месяца */}
            <div className="flex-shrink-0 w-64 bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
              onClick={() => navigate('/promotions')}>
              <div className="h-24 bg-gradient-to-br from-sakura-accent to-sakura-mid flex items-center justify-center relative">
                <div className="absolute inset-0 bg-sakura-accent/10" />
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-sakura-bg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21L12 17.77L5.82 21L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sakura-dark mb-2 flex items-center gap-2">
                  Акции месяца
                </h3>
                <p className="text-sm text-sakura-muted">
                  Специальные предложения от партнёров - скидки до 50%!
                </p>
                <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  <span>Открыть акции</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>

            {/* Карточка 3: Реферальная программа */}
            <div className="flex-shrink-0 w-64 bg-gradient-to-br from-white/30 to-sakura-surface/28 backdrop-blur-sm rounded-xl overflow-hidden border border-sakura-border/40 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer snap-start active:scale-[0.985]"
              onClick={() => navigate('/profile')}>
              <div className="h-24 bg-gradient-to-br from-sakura-mid to-sakura-deep flex items-center justify-center relative">
                <div className="absolute inset-0 bg-sakura-accent/10" />
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="relative z-10 text-sakura-bg">
                  <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="17" cy="11" r="1" fill="currentColor" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sakura-dark mb-2 flex items-center gap-2">
                  Реферальная программа
                </h3>
                <p className="text-sm text-sakura-muted">
                  Приглашайте друзей и получайте бонусные баллы за каждого!
                </p>
                <div className="mt-3 inline-flex items-center gap-1 text-sakura-deep font-semibold text-sm drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  <span>Открыть рефералы</span>
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
