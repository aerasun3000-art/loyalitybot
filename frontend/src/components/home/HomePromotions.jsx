const HomePromotions = ({ translatedPromotions, carouselRef, t, navigate, onPromotionClick }) => {
  const allPromotions = translatedPromotions
  const displayPromotions = allPromotions.length > 1
    ? [...allPromotions, ...allPromotions, ...allPromotions]
    : allPromotions

  const cardColors = [
    { bg: 'bg-yellow-400', text: 'text-yellow-900' },
    { bg: 'bg-teal-500', text: 'text-teal-900' },
    { bg: 'bg-pink-400', text: 'text-pink-900' },
    { bg: 'bg-purple-400', text: 'text-purple-900' },
    { bg: 'bg-blue-400', text: 'text-blue-900' },
    { bg: 'bg-green-400', text: 'text-green-900' },
    { bg: 'bg-orange-400', text: 'text-orange-900' },
    { bg: 'bg-indigo-400', text: 'text-indigo-900' }
  ]

  const getDaysRemaining = (endDate) => {
    const now = new Date()
    const end = new Date(endDate)
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="mb-6 fade-in-up delay-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-sakura-deep flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
            <rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 7V5C8 3.895 8.895 3 10 3H14C15.105 3 16 3.895 16 5V7M8 12H16M8 16H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="17" cy="11" r="1" fill="currentColor" />
          </svg>
          {t('promo_title')}
        </h2>
        <button
          onClick={() => navigate('/promotions')}
          className="bg-sakura-accent/15 text-sakura-deep font-semibold text-sm px-3 py-1 rounded-lg border border-sakura-accent/30 hover:bg-sakura-accent/25 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
        >
          {t('home_see_all')} →
        </button>
      </div>

      {translatedPromotions.length > 0 ? (
        <div className="relative -mx-4 px-4">
          <div
            ref={(el) => { carouselRef.current = el }}
            className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth'
            }}
          >
            {displayPromotions.map((promo, index) => {
              const daysLeft = getDaysRemaining(promo.end_date)
              const isEndingSoon = daysLeft <= 3
              const isNew = (() => {
                const created = new Date(promo.created_at || promo.start_date)
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                return created >= sevenDaysAgo
              })()

              const colors = cardColors[(parseInt(promo.id) || index) % cardColors.length]

              return (
                <div
                  key={`${promo.id}-${index}`}
                  onClick={() => onPromotionClick(promo.id)}
                  className={`relative flex-shrink-0 cursor-pointer hover:scale-105 active:scale-[0.98] transition-all duration-300 rounded-2xl overflow-hidden shadow-lg ${
                    !promo.image_url ? colors.bg : ''
                  }`}
                  style={{
                    width: 'calc(50vw - 20px)',
                    maxWidth: '280px',
                    aspectRatio: '1 / 1.618',
                    marginLeft: index > 0 ? '-12px' : '0',
                    zIndex: allPromotions.length - (index % allPromotions.length)
                  }}
                >
                  {promo.image_url ? (
                    <>
                      <img
                        src={promo.image_url}
                        alt={promo.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))'
                        }}
                      />
                    </>
                  ) : (
                    <div className={`absolute inset-0 ${colors.bg} opacity-90`} />
                  )}

                  <div className="absolute top-3 right-3 z-20">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M7 17L17 7M7 7h10v10" />
                      </svg>
                    </div>
                  </div>

                  <div className="absolute top-0 left-0 right-0 z-10 p-4 pt-14">
                    <h3
                      className="text-white font-bold mb-1 drop-shadow-lg line-clamp-2"
                      style={{ fontSize: '16px', fontWeight: 700, lineHeight: '1.3', color: '#FFFFFF' }}
                    >
                      {promo.title}
                    </h3>
                    {promo.partner?.company_name && (
                      <p
                        className="text-white/90 drop-shadow-md line-clamp-1"
                        style={{ fontSize: '12px', fontWeight: 400, opacity: 0.9 }}
                      >
                        {promo.partner.company_name}
                      </p>
                    )}
                  </div>

                  <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
                    {isEndingSoon && (
                      <div className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg">
                        🔥 {daysLeft}д
                      </div>
                    )}
                    {isNew && !isEndingSoon && (
                      <div className="bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg">
                        ⚡ {t('promo_new')}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-4 right-4 z-10">
                    <div
                      className="text-white font-bold drop-shadow-lg"
                      style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}
                    >
                      {promo.discount_value || (promo.required_points > 0 ? `${promo.required_points} ${t('promo_points')}` : t('promo_free'))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-sakura-surface/15 rounded-xl p-8 text-center border border-sakura-border/30">
          <p className="text-sakura-mid">{t('no_promotions') || 'Нет активных акций'}</p>
        </div>
      )}
    </div>
  )
}

export default HomePromotions
