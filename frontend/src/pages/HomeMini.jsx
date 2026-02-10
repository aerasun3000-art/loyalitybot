import React from 'react'
import Layout from '../components/Layout'
import LoyaltyCard from '../components/LoyaltyCard'
import CategoryGridNeo from '../components/CategoryGridNeo'
import NewsCarouselNeo from '../components/NewsCarouselNeo'
// BottomNav теперь глобально в App.jsx

// Черновой экран с новым дизайном главной страницы.
// Использует только мок‑данные, чтобы не трогать существующую бизнес‑логику.
const HomeMini = () => {
  // В дальнейшем сюда можно пробросить реальные данные и i18n.
  const mockBalance = 2450
  const mockNextTierPoints = 3000

  return (
    <Layout>
      <div className="max-w-screen-sm mx-auto px-4 flex flex-col gap-6 pb-4">
        {/* Шапка пользователя (пока статичная) */}
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tg-secondary-bg flex items-center justify-center text-sm font-semibold">
              AS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Alex Smith</span>
              <span className="text-[11px] uppercase tracking-wide text-tg-hint">
                Premium member
              </span>
            </div>
          </div>
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-tg-secondary-bg flex items-center justify-center text-lg"
          >
            🔔
          </button>
        </header>

        {/* Карта лояльности нового дизайна */}
        <LoyaltyCard
          balance={mockBalance}
          nextTierPoints={mockNextTierPoints}
          currentTier="Silver"
          nextTierName="Gold"
        />

        {/* Новости / акции */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Последние новости</h2>
            <button type="button" className="text-xs text-tg-link">
              Смотреть все
            </button>
          </div>
          <NewsCarouselNeo />
        </section>

        {/* Категории */}
        <section className="space-y-3 pb-20">
          <h2 className="text-sm font-semibold">Категории</h2>
          <CategoryGridNeo />
        </section>
      </div>

    </Layout>
  )
}

export default HomeMini

