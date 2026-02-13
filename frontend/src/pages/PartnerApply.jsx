import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPartnerApplication } from '../services/supabase'
import { getChatId, hapticFeedback, getTelegramUser, getStartParam } from '../utils/telegram'
import { getPartnerCitiesList, getDistrictsByCity, isOnlineService } from '../utils/locations'
import { getCategoriesByGroup } from '../utils/serviceIcons'
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
    categoryGroup: '', // Глобальная категория: beauty, food, retail, influencer
    businessType: '', // Категория услуг внутри категории (для beauty)
    city: '',
    district: '',
    username: user?.username || '', // Пытаемся получить username автоматически
    bookingUrl: '', // Ссылка на систему бронирования
    workMode: 'offline', // online, offline, hybrid
    referralCommissionPercent: 10 // Процент комиссии системе за реферала
  })
  const [errors, setErrors] = useState({})
  const [cities] = useState(getPartnerCitiesList())
  const [districts, setDistricts] = useState([])
  const [showSuccess, setShowSuccess] = useState(false)
  const serviceCategories = getCategoriesByGroup(formData.categoryGroup)
  const [referredByChatId, setReferredByChatId] = useState(null) // Chat ID партнера, который пригласил

  // Получаем referred_by_chat_id из start_param при загрузке компонента
  useEffect(() => {
    const startParam = getStartParam()
    if (startParam) {
      // Парсим partner_{id} из start_param
      const partnerMatch = startParam.match(/^partner_(\d+)$/i)
      if (partnerMatch) {
        const referrerChatId = partnerMatch[1]
        setReferredByChatId(referrerChatId)
        console.log('📎 Обнаружен пригласивший партнер:', referrerChatId)
      }
    }
  }, [])

  useEffect(() => {
    // Загружаем районы при выборе города
    if (formData.city) {
      const districtsForCity = getDistrictsByCity(formData.city)
      setDistricts(districtsForCity)

      // Для New York не устанавливаем автоматически "All" - пользователь должен выбрать район
      if (formData.city === 'New York') {
        // Для NY сбрасываем district, чтобы пользователь выбрал конкретный район
        if (formData.district === 'All') {
          setFormData(prev => ({ ...prev, district: '' }))
        }
      } else if (districtsForCity.length > 0 && districtsForCity[0].value === 'All') {
        // Для других городов (кроме NY) автоматически ставим район "All"
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
    let processedValue = value

    // Для username автоматически убираем символ @
    if (name === 'username') {
      processedValue = value.replace('@', '').trim()
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
      // Сбрасываем категорию услуг при смене типа бизнеса
      ...(name === 'categoryGroup' ? { businessType: '' } : {})
    }))
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

    // Проверка глобальной категории
    if (!formData.categoryGroup) {
      newErrors.categoryGroup = t('partner_category_group_required')
    }

    // Компания обязательна только для не-блогеров
    if (formData.categoryGroup !== 'influencer' && !formData.companyName.trim()) {
      newErrors.companyName = t('partner_company_required')
    }

    // Категория услуг обязательна для beauty и самопознания
    if ((formData.categoryGroup === 'beauty' || formData.categoryGroup === 'self_discovery' || formData.categoryGroup === 'b2b') && !formData.businessType) {
      newErrors.businessType = t('partner_business_type_required')
    }

    // Город обязателен только для оффлайн
    if (formData.workMode === 'offline' && !formData.city) {
      newErrors.city = t('partner_city_required')
    }

    // Проверка процента комиссии
    if (!formData.referralCommissionPercent || formData.referralCommissionPercent < 0 || formData.referralCommissionPercent > 100) {
      newErrors.referralCommissionPercent = language === 'ru' ? 'Введите процент от 0 до 100' : 'Enter percentage from 0 to 100'
    }

    // Для New York район обязателен и не может быть "All"
    if (formData.city === 'New York') {
      if (!formData.district || formData.district === 'All') {
        newErrors.district = language === 'ru'
          ? 'Выберите конкретный район Нью-Йорка'
          : 'Please select a specific New York district'
      }
    } else if (formData.city && !formData.district) {
      // Для других городов проверяем наличие района
      const districtsForCity = getDistrictsByCity(formData.city)
      if (districtsForCity.length > 0 && districtsForCity[0].value !== 'All') {
        // Если есть районы (не только "All"), но не выбран - ошибка
        newErrors.district = t('partner_district_required')
      }
    }

    // Username не обязателен, но если указан - проверяем формат (без @)
    if (formData.username) {
      const cleanUsername = formData.username.replace('@', '').trim()
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanUsername)) {
        newErrors.username = language === 'ru'
          ? 'Username должен содержать только буквы, цифры и подчеркивания (5-32 символа, без @)'
          : 'Username must contain only letters, numbers and underscores (5-32 characters, without @)'
      }
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
        companyName: formData.companyName.trim() || (formData.categoryGroup === 'influencer' ? formData.name.trim() : ''),
        categoryGroup: formData.categoryGroup, // НОВОЕ: глобальная категория
        businessType: formData.businessType,
        city: formData.city || (formData.workMode === 'online' ? 'Online' : ''),
        district: formData.district || 'All',
        username: formData.username.replace('@', '').trim() || null,
        bookingUrl: formData.bookingUrl.trim() || null,
        workMode: formData.workMode, // НОВОЕ: режим работы
        referralCommissionPercent: parseFloat(formData.referralCommissionPercent) || 10, // НОВОЕ: процент комиссии
        referredByChatId: referredByChatId || null
      }

      console.log('Submitting application:', applicationData)

      await createPartnerApplication(applicationData)

      hapticFeedback('success')
      setShowSuccess(true)

      // Перенаправляем через 3 секунды
      setTimeout(() => {
        // Можно отправить в партнерский бот
        window.location.href = `https://t.me/ghbipartnerbot?start=partner_applied`
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

  const inputStyle = (hasError) => ({
    backgroundColor: 'var(--tg-theme-bg-color)',
    color: 'var(--tg-theme-text-color)',
    WebkitTextFillColor: 'var(--tg-theme-text-color)',
    border: hasError
      ? '2px solid #ef4444'
      : '2px solid color-mix(in srgb, var(--tg-theme-hint-color) 25%, transparent)'
  })

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
        <div className="max-w-md w-full relative z-10">
          {/* Кнопка возврата */}
          <div className="mb-4">
            <button
              onClick={() => {
                hapticFeedback('light')
                navigate('/')
              }}
              className="p-2 rounded-full"
              style={{
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
              }}
              aria-label={language === 'ru' ? 'Вернуться на главную' : 'Back to home'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <div className="rounded-3xl p-8 text-center shadow-lg"
            style={{
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
            }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)' }}>
              <svg className="w-12 h-12" fill="none" stroke="var(--tg-theme-button-color)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--tg-theme-text-color)' }}>
              {t('partner_success_title')} 🎉
            </h1>

            <p className="mb-6" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {t('partner_success_text')}
            </p>

            <div className="rounded-xl p-4 mb-6"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)'
              }}>
              <p className="text-sm" style={{ color: 'var(--tg-theme-text-color)' }}>
                <strong>{t('partner_your_location')}:</strong><br/>
                {isOnlineService(formData.city, formData.district) ? (
                  <span className="font-semibold" style={{ color: 'var(--tg-theme-button-color)' }}>
                    🌍 {formData.city === 'Все' || formData.city === 'Online' ? (formData.city === 'Online' ? 'Online' : t('partner_work_everywhere')) : `${formData.city} (${formData.district === 'All' ? 'All districts' : t('partner_all_districts')})`}
                  </span>
                ) : (
                  <span className="font-semibold" style={{ color: 'var(--tg-theme-button-color)' }}>
                    📍 {formData.city}, {formData.district}
                  </span>
                )}
              </p>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {t('partner_redirecting')}
            </p>

            {/* Кнопка вернуться на главную */}
            <button
              onClick={() => {
                hapticFeedback('light')
                navigate('/')
              }}
              className="w-full py-3 px-6 rounded-xl font-semibold active:scale-95"
              style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }}
            >
              {language === 'ru' ? 'Вернуться на главную' : 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6 px-4" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
      <div className="max-w-md mx-auto relative z-10">
        {/* Кнопка возврата */}
        <div className="mb-4">
          <button
            onClick={() => {
              hapticFeedback('light')
              navigate('/')
            }}
            className="p-2 rounded-full"
            style={{
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-text-color)',
              border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
            }}
            aria-label={language === 'ru' ? 'Вернуться на главную' : 'Back to home'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
            {t('partner_apply_title')} 🤝
          </h1>
          <p style={{ color: 'var(--tg-theme-hint-color)' }}>
            {t('partner_apply_subtitle')}
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="rounded-3xl p-6 shadow-lg"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
          }}>
          {/* Имя */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {t('partner_name')} {t('required_field')}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.name)}
              placeholder={language === 'ru' ? 'Иван Иванов' : 'John Doe'}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Телефон */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {t('partner_phone')} {t('required_field')}
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.phone)}
              placeholder={t('partner_phone_placeholder')}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Глобальная категория бизнеса */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {language === 'ru' ? 'Тип бизнеса' : 'Business Type'} {t('required_field')}
            </label>
            <select
              name="categoryGroup"
              value={formData.categoryGroup}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.categoryGroup)}
            >
              <option value="">{language === 'ru' ? 'Выберите тип бизнеса' : 'Select business type'}</option>
              <option value="beauty">💄 {language === 'ru' ? 'Красота (Салон/Мастер)' : 'Beauty (Salon/Master)'}</option>
              <option value="food">🍔 {language === 'ru' ? 'Еда (Кафе/Ресторан)' : 'Food (Cafe/Restaurant)'}</option>
              <option value="education">📚 {language === 'ru' ? 'Образование' : 'Education'}</option>
              <option value="retail">🛍️ {language === 'ru' ? 'Розница (Магазин)' : 'Retail (Store)'}</option>
              <option value="sports_fitness">🏋️ {language === 'ru' ? 'Спорт и фитнес' : 'Sports & Fitness'}</option>
              <option value="entertainment">🎬 {language === 'ru' ? 'Развлечения' : 'Entertainment'}</option>
              <option value="healthcare">🏥 {language === 'ru' ? 'Здравоохранение' : 'Healthcare'}</option>
              <option value="services">🧹 {language === 'ru' ? 'Услуги' : 'Services'}</option>
              <option value="self_discovery">🔮 {language === 'ru' ? 'Самопознание' : 'Self-Discovery'}</option>
              <option value="influencer">🤳 {language === 'ru' ? 'Блогер/Инфлюенсер' : 'Influencer/Blogger'}</option>
              <option value="b2b">🏢 B2B</option>
            </select>
            {errors.categoryGroup && (
              <p className="text-red-500 text-sm mt-1">{errors.categoryGroup}</p>
            )}
          </div>

          {/* Название компании */}
          {formData.categoryGroup !== 'influencer' && (
            <div className="mb-4">
              <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                {t('partner_company')} {t('required_field')}
              </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.companyName)}
              placeholder={t('partner_company_placeholder')}
            />
            {errors.companyName && (
              <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
            )}
          </div>
          )}

          {/* Категория услуг (Beauty и Самопознание) */}
          {(formData.categoryGroup === 'beauty' || formData.categoryGroup === 'self_discovery' || formData.categoryGroup === 'b2b') && (
            <div className="mb-4">
              <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                {language === 'ru' ? 'Категория услуг' : 'Service Category'} {t('required_field')}
              </label>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.businessType)}
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
          )}

          {/* Режим работы */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {language === 'ru' ? 'Режим работы' : 'Work Mode'} {t('required_field')}
            </label>
            <select
              name="workMode"
              value={formData.workMode}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.workMode)}
            >
              <option value="offline">📍 {language === 'ru' ? 'Оффлайн (только в своем городе)' : 'Offline (only in your city)'}</option>
              <option value="online">🌍 {language === 'ru' ? 'Онлайн (всем городам)' : 'Online (all cities)'}</option>
              <option value="hybrid">🔄 {language === 'ru' ? 'Гибрид (онлайн + оффлайн, всем городам)' : 'Hybrid (online + offline, all cities)'}</option>
            </select>
            {errors.workMode && (
              <p className="text-red-500 text-sm mt-1">{errors.workMode}</p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {language === 'ru'
                ? '💡 Онлайн и Гибрид партнеры видны клиентам всех городов'
                : '💡 Online and Hybrid partners are visible to clients in all cities'}
            </p>
          </div>

          {/* Город (обязателен только для оффлайн) */}
          {formData.workMode === 'offline' && (
            <div className="mb-4">
              <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                {t('partner_city')} {t('required_field')}
              </label>
            <select
              name="city"
              value={formData.city}
              onChange={handleCityChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.city)}
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
          )}

          {/* Процент комиссии системе */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {language === 'ru' ? 'Процент комиссии системе за клиента' : 'Commission % to system per client'} {t('required_field')}
            </label>
            <div className="relative">
              <input
                type="number"
                name="referralCommissionPercent"
                value={formData.referralCommissionPercent}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 rounded-xl focus:outline-none"
                style={inputStyle(errors.referralCommissionPercent)}
                placeholder="10"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--tg-theme-hint-color)' }}>%</span>
            </div>
            {errors.referralCommissionPercent && (
              <p className="text-red-500 text-sm mt-1">{errors.referralCommissionPercent}</p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {language === 'ru'
                ? '💡 Процент, который вы платите системе за каждого клиента, пришедшего от другого партнера. Эти средства распределяются как Revenue Share.'
                : '💡 Percentage you pay to the system for each client referred by another partner. These funds are distributed as Revenue Share.'}
            </p>
          </div>

          {/* Username (Telegram) */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {language === 'ru' ? 'Telegram username мастера' : 'Master Telegram username'}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                ({language === 'ru' ? 'необязательно' : 'optional'})
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--tg-theme-hint-color)' }}>@</span>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full pl-8 pr-4 py-3 rounded-xl focus:outline-none"
                style={inputStyle(errors.username)}
                placeholder={language === 'ru' ? 'vera_yoga03 или @vera_yoga03' : 'vera_yoga03 or @vera_yoga03'}
              />
            </div>
            {errors.username && (
              <p className="text-red-500 text-sm mt-1">{errors.username}</p>
            )}
            {!formData.username && (
              <p className="text-xs mt-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {language === 'ru'
                  ? '💡 Если у мастера нет username, клиенты смогут написать через бота'
                  : '💡 If master has no username, clients can contact via bot'}
              </p>
            )}
          </div>

          {/* Ссылка на бронирование */}
          <div className="mb-4">
            <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
              {language === 'ru' ? 'Ссылка на бронирование времени' : 'Booking URL'}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                ({language === 'ru' ? 'необязательно' : 'optional'})
              </span>
            </label>
            <input
              type="url"
              name="bookingUrl"
              value={formData.bookingUrl}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={inputStyle(errors.bookingUrl)}
              placeholder={language === 'ru' ? 'https://example.com/booking' : 'https://example.com/booking'}
            />
            {errors.bookingUrl && (
              <p className="text-red-500 text-sm mt-1">{errors.bookingUrl}</p>
            )}
            {!formData.bookingUrl && (
              <p className="text-xs mt-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
                {language === 'ru'
                  ? '💡 Ссылка на вашу систему бронирования (Yclients, Яндекс.Бронирование и т.д.)'
                  : '💡 Link to your booking system (Yclients, Yandex.Booking, etc.)'}
              </p>
            )}
          </div>

          {/* Район */}
          {formData.city && (
            <div className="mb-6">
              <label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
                {t('partner_district')} {t('required_field')}
              </label>
              <select
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl focus:outline-none"
                style={inputStyle(errors.district)}
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
                <p className="text-sm mt-2 flex items-center gap-1" style={{ color: 'var(--tg-theme-button-color)' }}>
                  <span>💡</span>
                  <span>{t('partner_all_districts_hint')}</span>
                </p>
              )}
            </div>
          )}

          {/* Инфо */}
          <div className="rounded-xl p-4 mb-6"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--tg-theme-button-color) 15%, transparent)'
            }}>
            <p className="text-sm" style={{ color: 'var(--tg-theme-text-color)' }}>
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
            className="w-full py-4 rounded-xl font-bold active:scale-[0.98]"
            style={loading
              ? { backgroundColor: 'var(--tg-theme-hint-color)', color: 'var(--tg-theme-bg-color)', cursor: 'not-allowed', opacity: 0.5 }
              : { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }
            }
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

        {/* Ссылка на презентацию */}
        <div className="mt-6 text-center">
           <button
             onClick={() => navigate('/partner/beauty-presentation')}
             className="underline text-sm font-medium"
             style={{ color: 'var(--tg-theme-button-color)' }}
           >
             {language === 'ru' ? '✨ Посмотреть презентацию для Beauty' : '✨ View Beauty Presentation'}
           </button>
        </div>

          {/* Дополнительная информация */}
          <div className="mt-4 text-center">
            <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {t('partner_footer_text')}
            </p>
          </div>
      </div>
    </div>
  )
}

export default PartnerApply
