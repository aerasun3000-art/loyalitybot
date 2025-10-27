import { useState, useEffect } from 'react'
import { getCities, getDistrictsByCity } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'

const LocationSelector = ({ isOpen, onClose, onSelect, title = 'Выберите местоположение' }) => {
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
      <div className="bg-white rounded-t-3xl w-full max-h-[80vh] flex flex-col animate-slide-up">
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
              {step === 'city' ? 'Выберите город' : 'Выберите район'}
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
            <div className="mt-2 text-sm text-gray-600 text-center">
              📍 {selectedCity}
            </div>
          )}
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {step === 'city' && (
                <div className="space-y-2">
                  {/* Кнопка "Все города" */}
                  <button
                    onClick={() => handleConfirm('', '')}
                    className="w-full p-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-semibold active:scale-95 transition-transform duration-200"
                  >
                    🌍 Все города
                  </button>
                  
                  {cities.filter(city => city !== 'Все').map((city, index) => (
                    <button
                      key={index}
                      onClick={() => handleCitySelect(city)}
                      className={`w-full p-4 rounded-2xl font-semibold text-left transition-all duration-200 active:scale-95 ${
                        selectedCity === city
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      📍 {city}
                    </button>
                  ))}
                  
                  {cities.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">🏙️</div>
                      <p>Города не найдены</p>
                    </div>
                  )}
                </div>
              )}

              {step === 'district' && (
                <div className="space-y-2">
                  {/* Кнопка "Все районы города" */}
                  <button
                    onClick={() => handleConfirm(selectedCity, '')}
                    className="w-full p-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-semibold active:scale-95 transition-transform duration-200"
                  >
                    🌆 Все районы города
                  </button>
                  
                  {districts.filter(district => district !== 'Все').map((district, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        handleDistrictSelect(district)
                        handleConfirm(selectedCity, district)
                      }}
                      className={`w-full p-4 rounded-2xl font-semibold text-left transition-all duration-200 active:scale-95 ${
                        selectedDistrict === district
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      📌 {district}
                    </button>
                  ))}
                  
                  {districts.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">🏘️</div>
                      <p>Районы не найдены</p>
                      <button
                        onClick={() => handleConfirm(selectedCity, '')}
                        className="mt-4 px-6 py-2 bg-pink-500 text-white rounded-full font-semibold"
                      >
                        Продолжить без района
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
              className="w-full py-3 text-gray-600 font-semibold rounded-2xl border-2 border-gray-300 active:scale-95 transition-transform duration-200"
            >
              🗑️ Сбросить фильтры
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

