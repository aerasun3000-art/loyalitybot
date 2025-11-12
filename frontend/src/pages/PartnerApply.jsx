import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPartnerApplication } from '../services/supabase'
import { getChatId, hapticFeedback, getTelegramUser } from '../utils/telegram'
import { getPartnerCitiesList, getDistrictsByCity, isOnlineService } from '../utils/locations'
import { getAllServiceCategories } from '../utils/serviceIcons'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'

const PartnerApply = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const chatId = getChatId()
  const user = getTelegramUser()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.first_name || '',
    phone: '',
    companyName: '',
    businessType: '',
    city: '',
    district: ''
  })
  const [errors, setErrors] = useState({})
  const [cities] = useState(getPartnerCitiesList())
  const [districts, setDistricts] = useState([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [serviceCategories] = useState(getAllServiceCategories())

  useEffect(() => {
    // Загружаем районы при выборе города
    if (formData.city) {
      const districtsForCity = getDistrictsByCity(formData.city)
      setDistricts(districtsForCity)
      
      // Если выбран город с районом "All", автоматически ставим район "All"
      if (districtsForCity.length > 0 && districtsForCity[0].value === 'All') {
        setFormData(prev => ({ ...prev, district: 'All' }))
      } else if (districtsForCity.length === 0) {
        // Если районов нет, сбрасываем district
        setFormData(prev => ({ ...prev, district: '' }))
      }
    } else {
      setDistricts([])
      setFormData(prev => ({ ...prev, district: '' }))
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
      newErrors.name = t('partner_name_required')
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = t('partner_phone_required')
    } else if (!/^\+?[0-9\s\-()]{10,}$/.test(formData.phone)) {
      newErrors.phone = t('partner_phone_invalid')
    }
    
    if (!formData.companyName.trim()) {
      newErrors.companyName = t('partner_company_required')
    }
    
    if (!formData.businessType) {
      newErrors.businessType = language === 'ru' ? 'Выберите категорию услуг' : 'Select service category'
    }
    
    if (!formData.city) {
      newErrors.city = t('partner_city_required')
    }
    
    // Для всех партнерских городов district должен быть 'All'
    // Если district не установлен, устанавливаем его автоматически
    if (formData.city && !formData.district) {
      const districtsForCity = getDistrictsByCity(formData.city)
      if (districtsForCity.length > 0 && districtsForCity[0].value === 'All') {
        setFormData(prev => ({ ...prev, district: 'All' }))
      } else {
        newErrors.district = t('partner_district_required')
      }
    } else if (!formData.district) {
      newErrors.district = t('partner_district_required')
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Проверка chatId
    if (!chatId) {
      hapticFeedback('error')
      setErrors({ submit: 'Chat ID не найден. Пожалуйста, откройте форму через Telegram бота.' })
      return
    }
    
    if (!validateForm()) {
      hapticFeedback('error')
      return
    }
    
    setLoading(true)
    hapticFeedback('medium')
    
    try {
      const applicationData = {
        chatId: chatId.toString(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        companyName: formData.companyName.trim(),
        businessType: formData.businessType,
        city: formData.city,
        district: formData.district || 'All'
      }
      
      console.log('Submitting application:', applicationData)
      
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
      const errorMessage = error?.message || error?.error?.message || t('partner_error')
      setErrors({ submit: `Ошибка: ${errorMessage}` })
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
            {t('partner_success_title')} 🎉
          </h1>
          
          <p className="text-gray-600 mb-6">
            {t('partner_success_text')}
          </p>
          
          <div className="bg-pink-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>{t('partner_your_location')}:</strong><br/>
              {isOnlineService(formData.city, formData.district) ? (
                <span className="text-pink-600 font-semibold">
                  🌍 {formData.city === 'Все' || formData.city === 'Online' ? (formData.city === 'Online' ? 'Online' : t('partner_work_everywhere')) : `${formData.city} (${formData.district === 'All' ? 'All districts' : t('partner_all_districts')})`}
                </span>
              ) : (
                <span className="text-pink-600 font-semibold">
                  📍 {formData.city}, {formData.district}
                </span>
              )}
            </p>
          </div>
          
          <p className="text-xs text-gray-500">
            {t('partner_redirecting')}
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
            {t('partner_apply_title')} 🤝
          </h1>
          <p className="text-white/90">
            {t('partner_apply_subtitle')}
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 card-shadow">
          {/* Имя */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              {t('partner_name')} {t('required_field')}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 ${
                errors.name ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors`}
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
              placeholder={language === 'ru' ? 'Иван Иванов' : 'John Doe'}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Телефон */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              {t('partner_phone')} {t('required_field')}
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 ${
                errors.phone ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors`}
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
              placeholder={t('partner_phone_placeholder')}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Название компании */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              {t('partner_company')} {t('required_field')}
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 ${
                errors.companyName ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors`}
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
              placeholder={t('partner_company_placeholder')}
            />
            {errors.companyName && (
              <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
            )}
          </div>

          {/* Категория услуг */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              {language === 'ru' ? 'Категория услуг' : 'Service Category'} {t('required_field')}
            </label>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 ${
                errors.businessType ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors bg-white`}
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
            >
              <option value="">{language === 'ru' ? 'Выберите категорию услуг' : 'Select service category'}</option>
              {serviceCategories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.emoji} {language === 'ru' ? category.name : category.nameEn}
                </option>
              ))}
            </select>
            {errors.businessType && (
              <p className="text-red-500 text-sm mt-1">{errors.businessType}</p>
            )}
          </div>

          {/* Город */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              {t('partner_city')} {t('required_field')}
            </label>
            <select
              name="city"
              value={formData.city}
              onChange={handleCityChange}
              className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 ${
                errors.city ? 'border-red-500' : 'border-gray-200'
              } focus:border-pink-500 focus:outline-none transition-colors bg-white`}
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
            >
              <option value="">{t('partner_city_placeholder')}</option>
              {cities.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.label}
                </option>
              ))}
            </select>
            {errors.city && (
              <p className="text-red-500 text-sm mt-1">{errors.city}</p>
            )}
          </div>

          {/* Район */}
          {formData.city && (
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                {t('partner_district')} {t('required_field')}
              </label>
              <select
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 ${
                  errors.district ? 'border-red-500' : 'border-gray-200'
                } focus:border-pink-500 focus:outline-none transition-colors bg-white`}
                style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
              >
                <option value="">{t('partner_district_placeholder')}</option>
                {districts.map((district) => (
                  <option key={district.value} value={district.value}>
                    {district.label}
                  </option>
                ))}
              </select>
              {errors.district && (
                <p className="text-red-500 text-sm mt-1">{errors.district}</p>
              )}
              {formData.district === 'All' && (
                <p className="text-pink-600 text-sm mt-2 flex items-center gap-1">
                  <span>💡</span>
                  <span>{t('partner_all_districts_hint')}</span>
                </p>
              )}
            </div>
          )}

          {/* Инфо */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ {language === 'ru' ? 'Обратите внимание' : 'Note'}:</strong><br/>
              {t('partner_location_info')}
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
                {t('partner_submitting')}
              </span>
            ) : (
              t('partner_submit')
            )}
          </button>
        </form>

        {/* Дополнительная информация */}
        <div className="mt-6 text-center">
          <p className="text-white/80 text-sm">
            {t('partner_footer_text')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default PartnerApply

