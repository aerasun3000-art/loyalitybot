// Skeleton loaders в розовой теме для разных типов карточек

// Skeleton для карточки акции (большой)
export const PromotionSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
    {/* Изображение */}
    <div className="h-48 bg-gradient-to-br from-pink-100 via-pink-200 to-rose-100" />
    
    {/* Контент */}
    <div className="p-4 space-y-3">
      {/* Заголовок */}
      <div className="h-6 bg-pink-100 rounded-lg w-3/4" />
      
      {/* Партнёр и баллы */}
      <div className="flex items-center gap-2">
        <div className="h-4 bg-pink-100 rounded w-1/3" />
        <div className="h-5 bg-pink-100 rounded-full w-16" />
      </div>
      
      {/* Описание */}
      <div className="space-y-2">
        <div className="h-3 bg-pink-50 rounded w-full" />
        <div className="h-3 bg-pink-50 rounded w-5/6" />
      </div>
      
      {/* Дата и кнопка */}
      <div className="flex items-center justify-between pt-2">
        <div className="h-4 bg-pink-50 rounded w-1/4" />
        <div className="h-4 bg-pink-100 rounded w-1/5" />
      </div>
    </div>
  </div>
)

// Skeleton для карточки услуги (маленький)
export const ServiceSkeleton = () => (
  <div className="flex flex-col items-center animate-pulse">
    <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl mb-2" />
    <div className="h-3 bg-pink-100 rounded w-12" />
  </div>
)

// Skeleton для карточки в карусели
export const CarouselCardSkeleton = () => (
  <div className="flex-shrink-0 w-72 animate-pulse">
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
      {/* Изображение */}
      <div className="h-40 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-200" />
      
      {/* Контент */}
      <div className="p-4 space-y-3">
        <div className="h-5 bg-pink-100 rounded w-3/4" />
        <div className="h-4 bg-pink-50 rounded w-1/2" />
        <div className="flex items-center justify-between">
          <div className="h-6 bg-pink-100 rounded w-1/4" />
          <div className="h-4 bg-pink-50 rounded w-1/4" />
        </div>
      </div>
    </div>
  </div>
)

// Skeleton для новостной карточки
export const NewsCardSkeleton = () => (
  <div className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
    {/* Заголовок */}
    <div className="h-24 bg-gradient-to-br from-pink-100 to-pink-200" />
    
    {/* Контент */}
    <div className="p-4 space-y-2">
      <div className="h-4 bg-pink-100 rounded w-3/4" />
      <div className="h-3 bg-pink-50 rounded w-full" />
      <div className="h-3 bg-pink-50 rounded w-5/6" />
    </div>
  </div>
)

// Skeleton для прогресс-бара
export const ProgressSkeleton = () => (
  <div className="animate-pulse space-y-2">
    <div className="flex items-center justify-between">
      <div className="h-4 bg-pink-100 rounded w-1/3" />
      <div className="h-3 bg-pink-50 rounded w-1/4" />
    </div>
    <div className="h-2 bg-pink-100 rounded-full w-full" />
    <div className="flex justify-between">
      <div className="h-3 bg-pink-50 rounded-full w-6" />
      <div className="h-3 bg-pink-50 rounded-full w-6" />
      <div className="h-3 bg-pink-50 rounded-full w-6" />
      <div className="h-3 bg-pink-50 rounded-full w-6" />
    </div>
  </div>
)

// Skeleton для баланса
export const BalanceSkeleton = () => (
  <div className="bg-white rounded-3xl p-4 shadow-lg animate-pulse space-y-4">
    <div className="h-4 bg-pink-100 rounded w-3/4" />
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-pink-100 rounded-full" />
        <div className="h-5 bg-pink-100 rounded w-24" />
      </div>
      <div className="w-5 h-5 bg-pink-50 rounded" />
    </div>
  </div>
)

export default {
  PromotionSkeleton,
  ServiceSkeleton,
  CarouselCardSkeleton,
  NewsCardSkeleton,
  ProgressSkeleton,
  BalanceSkeleton
}

