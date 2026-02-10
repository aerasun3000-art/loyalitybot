import { useState, useEffect } from 'react'
import { getCities } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import useLanguageStore from '../store/languageStore'

const EXCLUDED_CITIES = new Set(['Все', 'Online', 'online', 'ALL', 'все'])

const LocationSelector = ({ isOpen, onClose, onSelect }) => {
  const { language } = useLanguageStore()
  const ru = language === 'ru'
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) loadCities()
  }, [isOpen])

  const loadCities = async () => {
    setLoading(true)
    try {
      const data = await getCities()
      setCities((data || []).filter(c => c && !EXCLUDED_CITIES.has(c.trim())))
    } catch (e) {
      console.error('Error loading cities:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (city) => {
    hapticFeedback('medium')
    if (city) localStorage.setItem('selectedCity', city)
    onSelect({ city, district: '' })
    onClose()
  }

  const handleClear = () => {
    hapticFeedback('medium')
    localStorage.removeItem('selectedCity')
    onSelect({ city: null, district: null })
    onClose()
  }

  if (!isOpen) return null

  const savedCity = localStorage.getItem('selectedCity')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-h-[70vh] flex flex-col animate-slide-up rounded-t-2xl"
        style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
            {ru ? 'Выберите город' : 'Select city'}
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-xl active:scale-90" style={{ color: 'var(--tg-theme-hint-color)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* City list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="w-7 h-7 border-3 rounded-full animate-spin"
                style={{ borderColor: 'var(--tg-theme-secondary-bg-color)', borderTopColor: 'var(--tg-theme-button-color)' }}
              />
            </div>
          ) : (
            <>
              {cities.map((city) => (
                <button
                  key={city}
                  onClick={() => handleSelect(city)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left active:scale-[0.98]"
                  style={{
                    backgroundColor: savedCity === city
                      ? 'color-mix(in srgb, var(--tg-theme-button-color) 12%, transparent)'
                      : 'var(--tg-theme-secondary-bg-color)',
                    color: savedCity === city
                      ? 'var(--tg-theme-button-color)'
                      : 'var(--tg-theme-text-color)',
                  }}
                >
                  <span className="text-base">📍</span>
                  <span className="font-semibold text-[15px]">{city}</span>
                </button>
              ))}
              {cities.length === 0 && !loading && (
                <div className="text-center py-8" style={{ color: 'var(--tg-theme-hint-color)' }}>
                  <span className="text-4xl block mb-2">🏙️</span>
                  <p className="text-sm">{ru ? 'Города не найдены' : 'No cities found'}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Clear button */}
        {savedCity && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}>
            <button
              onClick={handleClear}
              className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98]"
              style={{
                border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)',
                color: 'var(--tg-theme-text-color)',
              }}
            >
              {ru ? 'Сбросить город' : 'Clear city'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </div>
  )
}

export default LocationSelector
