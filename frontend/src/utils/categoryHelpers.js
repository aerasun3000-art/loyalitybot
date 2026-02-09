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
 */
export const isCompetitor = (service, referralPartnerInfo, isPartnerUser = false) => {
  if (isPartnerUser) return false
  if (!referralPartnerInfo) return false

  const servicePartnerId = service.partner_chat_id || service.partnerId
  if (servicePartnerId === referralPartnerInfo.chatId) return false

  const serviceCategory = service.partner?.business_type || service.category || service.categoryCode
  if (!serviceCategory || !referralPartnerInfo.businessType) return false

  const referralCategory = normalizeCategoryCode(referralPartnerInfo.businessType)
  const serviceCategoryNormalized = normalizeCategoryCode(serviceCategory)
  return referralCategory === serviceCategoryNormalized
}

/**
 * Фильтрует список услуг, убирая конкурентов реферального партнёра.
 */
export const filterCompetitors = (servicesList, referralPartnerInfo, isPartnerUser = false) => {
  if (!referralPartnerInfo || !servicesList || servicesList.length === 0) return servicesList
  return servicesList.filter(service => !isCompetitor(service, referralPartnerInfo, isPartnerUser))
}
