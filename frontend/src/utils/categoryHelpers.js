import { getCategoryByCode, serviceCategories } from './serviceIcons'

/**
 * Нормализует код категории — ищет каноническое значение из справочника.
 */
export const normalizeCategoryCode = (code) => {
  if (!code) return null
  const categoryData = getCategoryByCode(code) || serviceCategories[code]
  return categoryData?.code || code
}

/**
 * Проверяет, является ли партнёр услуги конкурентом реферального партнёра.
 * Конкурент — тот, кто работает в той же категории, но это не сам реферальный партнёр.
 * Для партнёров: показываем себя и реферального партнёра, скрываем остальных в категории реферера.
 * @param {Object} service - услуга или группа
 * @param {Object|null} referralPartnerInfo - { chatId, businessType } партнёра, который пригласил
 * @param {boolean} isPartnerUser - текущий пользователь — партнёр
 * @param {string|null} viewingPartnerChatId - chat_id партнёра, если он смотрит клиентский бот
 */
export const isCompetitor = (service, referralPartnerInfo, isPartnerUser = false, viewingPartnerChatId = null) => {
  if (!referralPartnerInfo) return false

  const servicePartnerId = String(service.partner_chat_id || service.partnerId || '')
  const refChatId = String(referralPartnerInfo.chatId || '')

  // Реферальный партнёр всегда показываем
  if (servicePartnerId === refChatId) return false

  // Партнёр видит себя в любой категории
  if (isPartnerUser && viewingPartnerChatId && servicePartnerId === String(viewingPartnerChatId)) return false

  const serviceCategory = service.partner?.business_type || service.category || service.categoryCode
  if (!serviceCategory || !referralPartnerInfo.businessType) return false

  const referralCategory = normalizeCategoryCode(referralPartnerInfo.businessType)
  const serviceCategoryNormalized = normalizeCategoryCode(serviceCategory)
  return referralCategory === serviceCategoryNormalized
}

/**
 * Фильтрует список услуг, убирая конкурентов реферального партнёра.
 */
export const filterCompetitors = (servicesList, referralPartnerInfo, isPartnerUser = false, viewingPartnerChatId = null) => {
  if (!referralPartnerInfo || !servicesList || servicesList.length === 0) return servicesList
  return servicesList.filter(service => !isCompetitor(service, referralPartnerInfo, isPartnerUser, viewingPartnerChatId))
}
