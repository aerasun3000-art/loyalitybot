import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPartnerApplication } from '../services/supabase'
import { getChatId, hapticFeedback, getTelegramUser } from '../utils/telegram'
import { getCitiesList, getDistrictsByCity, isOnlineService } from '../utils/locations'
import Loader from '../components/Loader'

const PartnerApply = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const chatId = getChatId()
  const user = getTelegramUser()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.first_name || '',
    phone: '',
    companyName: '',
    city: '',
    district: ''
  })
  const [errors, setErrors] = useState({})
  const [cities] = useState(getCitiesList())
  const [districts, setDistricts] = useState([])
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    // Загружаем районы при выборе города
    if (formData.city) {
      const districtsForCity = getDistrictsByCity(formData.city)
      setDistricts(districtsForCity)
      
      // Если выбран город "Все", автоматически ставим район "Все"
      if (formData.city === 'Все') {
        setFormData(prev => ({ ...prev, district: 'Все' }))
      }
    } else {
      setDistricts([])
    }
  }, [formData.city])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Очищаем ошибку при вводе
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleCityChange = (e) => {
    const city = e.target.value
    setFormData(prev => ({ 
      ...prev, 
      city,
      district: '' // Сбрасываем район при смене города
    }))
    if (errors.city) {
      setErrors(prev => ({ ...prev, city: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Укажите ваше имя'
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Укажите номер телефона'
    } else if (!/^\+?[0-9\s\-()]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Неверный формат телефона'
    }
    
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Укажите название компании'
    }
    
    if (!formData.city) {
      newErrors.city = 'Выберите город'
    }
    
    if (!formData.district) {
      newErrors.district = 'Выберите район'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      hapticFeedback('error')
      return
    }
    
    setLoading(true)
    hapticFeedback('medium')
    
    try {
      const applicationData = {
        chatId: chatId.toString(),
        name: formData.name,
        phone: formData.phone,
        companyName: formData.companyName,
        city: formData.city,
        district: formData.district
      }
      
      await createPartnerApplication(applicationData)
      
      hapticFeedback('success')
      setShowSuccess(true)
      
      // Перенаправляем через 3 секунды
      setTimeout(() => {
        // Можно отправить в партнерский бот
        window.location.href = `https://t.me/YOUR_PARTNER_BOT?start=partner_applied`
      }, 3000)
      
    } catch (error) {
      console.error('Error submitting application:', error)
      hapticFeedback('error')
      setErrors({ submit: 'Произошла ошибка при отправке заявки. Попробуйте еще раз.' })
    } finally {
      setLoading(false)
    }
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-400 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center card-shadow">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-3">
            Заявка отправлена! 🎉
          </h1>
          
          <p className="text-gray-600 mb-6">
            Ваша заявка на партнерство принята и ожидает одобрения администратора.
            Мы уведомим вас о результате в ближайшее время.
          </p>
          
          <div className="bg-pink-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Ваша локация:</strong><br/>
              {isOnlineService(formData.city, formData.district) ? (
                <span className="text-pink-600 font-semibold">
                  🌍 {formData.city === 'Все' ? 'Работаю везде (онлайн)' : `${formData.city} (все районы)`}
                </span>
              ) : (
                <span className="text-pink-600 font-semibold">
                  📍 {formData.city}, {formData.district}
                </span>
              )}
            </p>
          </div>
          
          <p className="text-xs text-gray-500">
            Перенаправление в партнерский бот...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-400 to-pink-500 py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Стать партнером 🤝
          </h1>
          <p className="text-white/90">
            Заполните форму для подачи заявки
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 card-shadow">
          {/* Имя */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              Ваше имя *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 ${
                errors.name ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors`}
              placeholder="Иван Иванов"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Телефон */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              Номер телефона *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 ${
                errors.phone ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors`}
              placeholder="+7 (900) 123-45-67"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Название компании */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              Название компании *
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 ${
                errors.companyName ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors`}
              placeholder="Салон красоты 'Аврора'"
            />
            {errors.companyName && (
              <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
            )}
          </div>

          {/* Город */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              Город работы *
            </label>
            <select
              name="city"
              value={formData.city}
              onChange={handleCityChange}
              className={`w-full px-4 py-3 rounded-xl border-2 ${
                errors.city ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors bg-white`}
            >
              <option value="">Выберите город</option>
              {cities.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.label}
                </option>
              ))}
            </select>
            {errors.city && (
              <p className="text-red-500 text-sm mt-1">{errors.city}</p>
            )}
            {formData.city === 'Все' && (
              <p className="text-pink-600 text-sm mt-2 flex items-center gap-1">
                <span>💡</span>
                <span>Отлично для онлайн-консультаций и дистанционных услуг!</span>
              </p>
            )}
          </div>

          {/* Район */}
          {formData.city && formData.city !== 'Все' && (
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Район работы *
              </label>
              <select
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  errors.district ? 'border-red-500' : 'border-gray-200'
                } focus:border-pink-500 focus:outline-none transition-colors bg-white`}
              >
                <option value="">Выберите район</option>
                {districts.map((district) => (
                  <option key={district.value} value={district.value}>
                    {district.label}
                  </option>
                ))}
              </select>
              {errors.district && (
                <p className="text-red-500 text-sm mt-1">{errors.district}</p>
              )}
              {formData.district === 'Все' && (
                <p className="text-pink-600 text-sm mt-2 flex items-center gap-1">
                  <span>💡</span>
                  <span>Ваши услуги будут видны во всех районах города!</span>
                </p>
              )}
            </div>
          )}

          {/* Инфо */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Обратите внимание:</strong><br/>
              Выбранная локация определит, где будут видны ваши услуги в приложении.
            </p>
          </div>

          {/* Ошибка отправки */}
          {errors.submit && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:shadow-lg active:scale-95'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Отправка...
              </span>
            ) : (
              'Отправить заявку'
            )}
          </button>
        </form>

        {/* Дополнительная информация */}
        <div className="mt-6 text-center">
          <p className="text-white/80 text-sm">
            После одобрения заявки вы получите доступ<br/>к партнерской панели
          </p>
        </div>
      </div>
    </div>
  )
}

export default PartnerApply

