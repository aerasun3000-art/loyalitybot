import { useState, useEffect } from 'react'
import { getCities, getDistrictsByCity } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
// import LuxuryIcon from './LuxuryIcons'

const LocationSelector = ({ isOpen, onClose, onSelect }) => {
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('city') // 'city' или 'district'

  useEffect(() => {
    if (isOpen) {
      loadCities()
      // Восстанавливаем сохраненные значения из localStorage
      const savedCity = localStorage.getItem('selectedCity')
      const savedDistrict = localStorage.getItem('selectedDistrict')
      if (savedCity) setSelectedCity(savedCity)
      if (savedDistrict) setSelectedDistrict(savedDistrict)
    }
  }, [isOpen])

  const loadCities = async () => {
    setLoading(true)
    try {
      const citiesData = await getCities()
      setCities(citiesData)
    } catch (error) {
      console.error('Error loading cities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCitySelect = async (city) => {
    hapticFeedback('light')
    setSelectedCity(city)
    setLoading(true)
    
    try {
      const districtsData = await getDistrictsByCity(city)
      setDistricts(districtsData)
      
      if (districtsData.length > 0) {
        setStep('district')
      } else {
        // Если нет районов, сразу применяем фильтр только по городу
        handleConfirm(city, '')
      }
    } catch (error) {
      console.error('Error loading districts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDistrictSelect = (district) => {
    hapticFeedback('light')
    setSelectedDistrict(district)
  }

  const handleConfirm = (city = selectedCity, district = selectedDistrict) => {
    hapticFeedback('medium')
    
    // Сохраняем выбор в localStorage
    if (city) localStorage.setItem('selectedCity', city)
    if (district) localStorage.setItem('selectedDistrict', district)
    
    onSelect({ city, district })
    handleClose()
  }

  const handleBack = () => {
    hapticFeedback('light')
    if (step === 'district') {
      setStep('city')
      setSelectedDistrict('')
      setDistricts([])
    }
  }

  const handleClearFilters = () => {
    hapticFeedback('medium')
    setSelectedCity('')
    setSelectedDistrict('')
    localStorage.removeItem('selectedCity')
    localStorage.removeItem('selectedDistrict')
    onSelect({ city: null, district: null })
    handleClose()
  }

  const handleClose = () => {
    setStep('city')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-xl w-full max-h-[80vh] flex flex-col animate-slide-up">
        {/* Заголовок */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {step === 'district' && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-gray-600"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800 flex-1 text-center">
              {step === 'city' ? t('location_select_city') : t('location_select_district')}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 -mr-2 text-gray-600"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Показываем выбранный город */}
          {step === 'district' && selectedCity && (
            <div className="mt-2 text-sm text-sakura-muted text-center flex items-center justify-center gap-1">
              <span className="text-lg leading-none">📍</span>
              <span>{selectedCity}</span>
            </div>
          )}
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-luxury-gold border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {step === 'city' && (
                <div className="space-y-2">
                  {/* Кнопка "Все города" */}
                  <button
                    onClick={() => handleConfirm('', '')}
                    className="w-full p-4 bg-gradient-to-r from-luxury-charcoal to-luxury-navy text-white rounded-xl font-semibold transition-colors duration-200 hover:opacity-90"
                  >
                    {t('location_all_cities')}
                  </button>
                  
                  {cities.filter(city => city !== 'Все').map((city, index) => (
                    <button
                      key={index}
                      onClick={() => handleCitySelect(city)}
                      className={`w-full p-4 rounded-xl font-semibold text-left transition-colors duration-200 ${
                        selectedCity === city
                          ? 'bg-luxury-gold text-luxury-charcoal'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">📍</span>
                        <span>{city}</span>
                      </div>
                    </button>
                  ))}
                  
                  {cities.length === 0 && (
                    <div className="text-center text-sakura-muted py-8">
                      <span className="text-5xl leading-none mx-auto mb-2">🏙️</span>
                      <p>{language === 'ru' ? 'Города не найдены' : 'No cities found'}</p>
                    </div>
                  )}
                </div>
              )}

              {step === 'district' && (
                <div className="space-y-2">
                  {/* Кнопка "Все районы города" */}
                  <button
                    onClick={() => handleConfirm(selectedCity, '')}
                    className="w-full p-4 bg-gradient-to-r from-luxury-charcoal to-luxury-navy text-white rounded-xl font-semibold transition-colors duration-200 hover:opacity-90"
                  >
                    {t('location_all_districts')}
                  </button>
                  
                  {districts.filter(district => district !== 'Все').map((district, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        handleDistrictSelect(district)
                        handleConfirm(selectedCity, district)
                      }}
                      className={`w-full p-4 rounded-xl font-semibold text-left transition-colors duration-200 ${
                        selectedDistrict === district
                          ? 'bg-luxury-gold text-luxury-charcoal'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">📌</span>
                        <span>{district}</span>
                      </div>
                    </button>
                  ))}
                  
                  {districts.length === 0 && (
                    <div className="text-center text-sakura-muted py-8">
                      <span className="text-5xl leading-none mx-auto mb-2">🌆</span>
                      <p>{language === 'ru' ? 'Районы не найдены' : 'No districts found'}</p>
                      <button
                        onClick={() => handleConfirm(selectedCity, '')}
                        className="mt-4 px-6 py-2 bg-sakura-gold text-sakura-bg rounded-lg font-semibold hover:bg-sakura-mid transition-colors"
                      >
                        {language === 'ru' ? 'Продолжить без района' : 'Continue without district'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Кнопка сброса фильтров */}
        {(selectedCity || selectedDistrict) && step === 'city' && (
          <div className="px-4 py-3 border-t border-gray-200">
            <button
              onClick={handleClearFilters}
              className="w-full py-3 text-sakura-deep font-semibold rounded-xl border-2 border-sakura-gold/30 hover:bg-sakura-gold/5 transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">🗑️</span>
              <span>{language === 'ru' ? 'Сбросить фильтры' : 'Clear filters'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Стили для анимации */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default LocationSelector

