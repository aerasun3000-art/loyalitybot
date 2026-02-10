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
    <div className="fixed inset-0 z-[100]" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="service-modal-title"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative h-full flex items-center justify-center px-4 py-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: '80px', maxHeight: '100vh', overflow: 'hidden' }}
      >
        <div
          ref={serviceModalRef}
          className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl p-5 max-h-[calc(100vh-8rem)] overflow-y-auto"
          style={{ backgroundColor: 'var(--tg-theme-bg-color)', WebkitOverflowScrolling: 'touch' }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-hint-color)' }}
            aria-label="Закрыть"
          >
            ×
          </button>

          <div className="space-y-4 pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {ru ? 'Услуга' : 'Service'}
              </p>
              <h2 id="service-modal-title" className="text-xl font-bold pr-10" style={{ color: 'var(--tg-theme-text-color)' }}>
                {selectedService.title}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {selectedService.partner?.company_name || selectedService.partner?.name || t('partner_not_connected')}
              </p>
            </div>

            {selectedService.description && (
              <p className="text-sm rounded-xl p-3" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                {selectedService.description}
              </p>
            )}

            <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
              <span className="text-2xl">💸</span>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {ru ? 'Стоимость' : 'Cost'}
                </p>
                <p className="text-lg font-semibold" style={{ color: 'var(--tg-theme-button-color)' }}>
                  {formatPriceWithPoints(selectedService.price_points, currency, rates, true, language)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {ru ? 'Баланс' : 'Balance'}
                </p>
                <p className={`text-lg font-semibold ${balance >= selectedService.price_points ? 'text-green-600' : 'text-red-500'}`}>
                  {formatPriceWithPoints(balance, currency, rates, false, language)}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {(() => {
                const promotions = servicePromotions[selectedService.id] || []
                const redemptionPromotion = promotions.find(p =>
                  p.promotion_type === 'points_redemption' &&
                  p.max_points_payment &&
                  p.max_points_payment > 0
                )
                if (redemptionPromotion) {
                  return (
                    <button onClick={onRedeemViaPromotion} className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98]" style={btnPrimary}>
                      {ru ? `🎁 Обменять: ${redemptionPromotion.title}` : `🎁 Redeem: ${redemptionPromotion.title}`}
                    </button>
                  )
                }
                return null
              })()}

              <button onClick={onGetCashback} disabled={isQrLoading}
                className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98] disabled:opacity-50"
                style={btnPrimary}
              >
                {isQrLoading ? '...' : (ru ? 'Получить кэшбэк' : 'Get cashback')}
              </button>

              <button onClick={onShowLocation} className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98]" style={btnSecondary}>
                {ru ? '📍 На карте' : '📍 Show on map'}
              </button>

              <button onClick={onBookTime}
                disabled={!selectedService.booking_url && !selectedService.partner?.booking_url}
                className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98] disabled:opacity-40"
                style={btnSecondary}
              >
                {(!selectedService.booking_url && !selectedService.partner?.booking_url)
                  ? (ru ? 'Забронировать (уточняется)' : 'Book (TBD)')
                  : (ru ? 'Забронировать время' : 'Book time')}
              </button>

              <button onClick={onContactPartner} className="w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.98]" style={btnPrimary}>
                {ru ? '💬 Написать партнёру' : '💬 Contact partner'}
              </button>
            </div>

            {qrError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{qrError}</div>
            )}

            {qrImage && (
              <div className="flex flex-col items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
                <img src={qrImage} alt="QR" className="w-48 h-48 object-contain" />
                <p className="text-xs text-center" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  {ru ? 'Покажите код мастеру при оплате' : 'Show this code to the master at payment'}
                </p>
                {chatId && (
                  <p className="text-xs text-center font-mono" style={{ color: 'var(--tg-theme-hint-color)', opacity: 0.6 }}>
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
