import React from 'react'
import { ShoppingBag, Zap, Handshake, Headset } from 'lucide-react'

const DEFAULT_CATEGORIES = [
  { id: 1, nameKey: 'rewards_store', nameEn: 'Rewards Store', icon: ShoppingBag, color: 'bg-orange-500/20 text-orange-400' },
  { id: 2, nameKey: 'activities', nameEn: 'Activities', icon: Zap, color: 'bg-sakura-gold/20 text-sakura-gold' },
  { id: 3, nameKey: 'partner_offers', nameEn: 'Partner Offers', icon: Handshake, color: 'bg-sakura-accent/20 text-sakura-accent' },
  { id: 4, nameKey: 'support', nameEn: 'Support', icon: Headset, color: 'bg-sakura-mid/20 text-sakura-mid' },
]

/**
 * Сетка 2×2 быстрых действий (neo design).
 * Макет: bg-[#1A1423], rounded-[24px], цветные иконки, active:scale-95.
 */
const QuickActionsGrid = ({ categories = DEFAULT_CATEGORIES, onSelect, getLabel }) => (
  <div className="grid grid-cols-2 gap-3">
    {categories.map((cat) => {
      const Icon = cat.icon
      const label = getLabel ? getLabel(cat) : (cat.name ?? cat.nameEn)
      return (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect && onSelect(cat)}
          className="p-4 rounded-[24px] border border-black/5 dark:border-white/5 active:scale-95 transition-all cursor-pointer flex flex-col items-start gap-3 text-left"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #1A1423)',
          }}
        >
          <div className={`p-3 rounded-xl ${cat.color}`}>
            <Icon size={24} />
          </div>
          <span className="font-semibold text-sm leading-tight" style={{ color: 'var(--tg-theme-text-color, #fff)' }}>
            {label}
          </span>
        </button>
      )
    })}
  </div>
)

export default QuickActionsGrid
export { DEFAULT_CATEGORIES }
