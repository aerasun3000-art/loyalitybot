// Skeleton loaders using Telegram theme variables

// Skeleton для карточки акции (большой)
export const PromotionSkeleton = () => (
  <div className="rounded-2xl overflow-hidden shadow-sm animate-pulse"
    style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
    <div className="h-48" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
    <div className="p-4 space-y-3">
      <div className="h-6 rounded-lg w-3/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      <div className="flex items-center gap-2">
        <div className="h-4 rounded w-1/3" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
        <div className="h-5 rounded-full w-16" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      </div>
      <div className="space-y-2">
        <div className="h-3 rounded w-full" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
        <div className="h-3 rounded w-5/6" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="h-4 rounded w-1/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
        <div className="h-4 rounded w-1/5" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      </div>
    </div>
  </div>
)

// Skeleton для карточки услуги (маленький)
export const ServiceSkeleton = () => (
  <div className="flex flex-col items-center animate-pulse">
    <div className="w-16 h-16 rounded-2xl mb-2" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
    <div className="h-3 rounded w-12" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
  </div>
)

// Skeleton для карточки в карусели
export const CarouselCardSkeleton = () => (
  <div className="flex-shrink-0 w-72 animate-pulse">
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
      <div className="h-40" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      <div className="p-4 space-y-3">
        <div className="h-5 rounded w-3/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
        <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
        <div className="flex items-center justify-between">
          <div className="h-6 rounded w-1/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
          <div className="h-4 rounded w-1/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
        </div>
      </div>
    </div>
  </div>
)

// Skeleton для новостной карточки
export const NewsCardSkeleton = () => (
  <div className="flex-shrink-0 w-64 rounded-2xl overflow-hidden shadow-sm animate-pulse"
    style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
    <div className="h-24" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
    <div className="p-4 space-y-2">
      <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      <div className="h-3 rounded w-full" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
      <div className="h-3 rounded w-5/6" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
    </div>
  </div>
)

// Skeleton для карточки партнёра на странице «Мои мастера»
export const PartnerCardSkeleton = () => (
  <div className="rounded-2xl shadow-sm overflow-hidden animate-pulse"
    style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
    <div className="flex items-center gap-4 p-4">
      <div className="flex-shrink-0 w-16 h-16 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-5 rounded w-3/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
        <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
        <div className="h-3 rounded w-1/3" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
      </div>
      <div className="flex-shrink-0 w-10 h-10 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
    </div>
  </div>
)

// Skeleton для прогресс-бара
export const ProgressSkeleton = () => (
  <div className="animate-pulse space-y-2">
    <div className="flex items-center justify-between">
      <div className="h-4 rounded w-1/3" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      <div className="h-3 rounded w-1/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
    </div>
    <div className="h-2 rounded-full w-full" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
    <div className="flex justify-between">
      <div className="h-3 rounded-full w-6" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
      <div className="h-3 rounded-full w-6" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
      <div className="h-3 rounded-full w-6" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
      <div className="h-3 rounded-full w-6" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
    </div>
  </div>
)

// Skeleton для баланса
export const BalanceSkeleton = () => (
  <div className="rounded-3xl p-4 shadow-lg animate-pulse space-y-4"
    style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
    <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
        <div className="h-5 rounded w-24" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }} />
      </div>
      <div className="w-5 h-5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }} />
    </div>
  </div>
)

export default {
  PromotionSkeleton,
  ServiceSkeleton,
  CarouselCardSkeleton,
  NewsCardSkeleton,
  PartnerCardSkeleton,
  ProgressSkeleton,
  BalanceSkeleton
}
