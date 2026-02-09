const ServiceModal = ({
  isOpen,
  selectedService,
  servicePromotions,
  balance,
  chatId,
  qrImage,
  qrError,
  isQrLoading,
  language,
  t,
  currency,
  rates,
  formatPriceWithPoints,
  serviceModalRef,
  onClose,
  onGetCashback,
  onRedeemViaPromotion,
  onBookTime,
  onContactPartner,
  onShowLocation
}) => {
  if (!isOpen || !selectedService) return null

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="service-modal-title">
      <div className="absolute inset-0 bg-sakura-deep/50 backdrop-blur-sm" />
      <div
        className="relative h-full flex items-center justify-center px-4 py-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: '80px', maxHeight: '100vh', overflow: 'hidden' }}
      >
        <div
          ref={serviceModalRef}
          className="relative z-10 w-full max-w-md bg-sakura-surface/85 border border-sakura-border/60 rounded-3xl shadow-2xl p-6 max-h-[calc(100vh-8rem)] overflow-y-auto animate-scale-in"
          style={{ maxHeight: 'calc(100vh - 8rem)', WebkitOverflowScrolling: 'touch' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full border border-sakura-border/40 bg-sakura-surface/20 text-sakura-dark hover:bg-sakura-surface/30 transition-colors z-20"
            aria-label="Закрыть"
          >
            ×
          </button>
          <div className="space-y-4 text-sakura-dark pb-8">
            <div>
              <p className="text-sm text-sakura-dark/60 mb-1 uppercase tracking-wide">Услуга</p>
              <h2 id="service-modal-title" className="text-xl font-bold">{selectedService.title}</h2>
              <p className="text-sm text-sakura-dark/70 mt-1">
                {selectedService.partner?.company_name || selectedService.partner?.name || t('partner_not_connected')}
              </p>
            </div>
            {selectedService.description && (
              <p className="text-sm text-sakura-dark/80 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
                {selectedService.description}
              </p>
            )}
            <div className="flex items-center gap-3 bg-sakura-surface/15 border border-sakura-border/30 rounded-2xl p-3">
              <span className="text-2xl">💸</span>
              <div className="flex-1">
                <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">
                  {language === 'ru' ? 'Стоимость' : 'Cost'}
                </p>
                <p className="text-lg font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                  {formatPriceWithPoints(selectedService.price_points, currency, rates, true, language)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-sakura-dark/60 uppercase tracking-wide">
                  {language === 'ru' ? 'Ваш баланс' : 'Your balance'}
                </p>
                <p className={`text-lg font-semibold ${
                  balance >= selectedService.price_points ? 'text-green-600' : 'text-red-500'
                }`}>
                  {formatPriceWithPoints(balance, currency, rates, false, language)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                const promotions = servicePromotions[selectedService.id] || []
                const redemptionPromotion = promotions.find(p =>
                  p.promotion_type === 'points_redemption' &&
                  p.max_points_payment &&
                  p.max_points_payment > 0
                )

                if (redemptionPromotion) {
                  return (
                    <button
                      onClick={onRedeemViaPromotion}
                      className="w-full py-3 rounded-full bg-gradient-to-r from-sakura-mid to-sakura-dark text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      {language === 'ru'
                        ? `🎁 Обменять по акции: ${redemptionPromotion.title}`
                        : `🎁 Redeem via promotion: ${redemptionPromotion.title}`}
                    </button>
                  )
                }
                return null
              })()}

              <button
                onClick={onGetCashback}
                disabled={isQrLoading}
                className="w-full py-3 rounded-full bg-sakura-accent text-white font-semibold shadow-md hover:bg-sakura-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isQrLoading ? 'Генерируем QR...' : (language === 'ru' ? 'Получить кэшбэк в баллах' : 'Get cashback points')}
              </button>

              <button
                onClick={onShowLocation}
                className="w-full py-3 rounded-full bg-white text-sakura-dark font-semibold shadow-md border border-sakura-border hover:bg-sakura-surface transition-colors"
              >
                {language === 'ru' ? '📍 Показать на карте' : '📍 Show on Map'}
              </button>

              <button
                onClick={onBookTime}
                disabled={!selectedService.booking_url && !selectedService.partner?.booking_url}
                className="w-full py-3 rounded-full bg-sakura-deep text-white font-semibold shadow-md hover:bg-sakura-deep/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={(!selectedService.booking_url && !selectedService.partner?.booking_url) ? (language === 'ru' ? 'Ссылка уточняется' : 'Link TBD') : ''}
              >
                {(!selectedService.booking_url && !selectedService.partner?.booking_url)
                  ? (language === 'ru' ? 'Забронировать (ссылка уточняется)' : 'Book (link TBD)')
                  : (language === 'ru' ? 'Забронировать время' : 'Book time')}
              </button>
              <button
                onClick={onContactPartner}
                className="w-full py-3 rounded-full bg-gradient-to-r from-sakura-accent to-sakura-mid text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {language === 'ru' ? '💬 Написать партнёру' : '💬 Contact Partner'}
              </button>
            </div>

            {qrError && (
              <div className="text-sm text-red-500 bg-red-100/60 border border-red-200 rounded-2xl p-3">
                {qrError}
              </div>
            )}

            {qrImage && (
              <div className="flex flex-col items-center gap-3 bg-white/90 border border-sakura-border/40 rounded-3xl p-4 mb-8 pb-8">
                <img src={qrImage} alt="QR для начисления" className="w-48 h-48 object-contain" />
                <p className="text-xs text-sakura-dark/70 text-center px-2">
                  {language === 'ru' ? 'Покажите код мастеру при оплате — он подтвердит начисление баллов.' : 'Show this code to the master at payment — they will confirm points.'}
                </p>
                {chatId && (
                  <p className="text-xs text-sakura-dark/50 text-center px-2 font-mono">
                    ID: {chatId}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceModal
