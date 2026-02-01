/**
 * Общая логика «один тап — поделиться / скопировать» для реферальной ссылки.
 * Сначала navigator.share (если доступен), иначе clipboard.
 */

import { hapticFeedback } from './telegram'

/**
 * @param {string} referralLink - реферальная ссылка
 * @param {Object} options
 * @param {string} [options.title] - заголовок для share
 * @param {string} [options.text] - текст для share
 * @param {function} [options.onSuccess] - колбэк при успехе
 * @param {function} [options.onError] - колбэк при ошибке
 * @returns {Promise<boolean>} true если успешно
 */
export const shareReferralLink = async (referralLink, { title = '', text = '', onSuccess, onError } = {}) => {
  if (!referralLink) {
    onError?.()
    return false
  }

  hapticFeedback('light')

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: title || 'LoyaltyBot',
        text: text || referralLink,
        url: referralLink
      })
      onSuccess?.()
      return true
    } catch (err) {
      if (err.name === 'AbortError') {
        return false
      }
      try {
        await navigator.clipboard?.writeText(referralLink)
        onSuccess?.()
        return true
      } catch {
        onError?.()
        return false
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(referralLink)
      onSuccess?.()
      return true
    } catch (err) {
      console.error('Error copying referral link:', err)
      onError?.()
      return false
    }
  }

  onError?.()
  return false
}

/**
 * Формирует реферальную ссылку
 * @param {string} referralCode
 * @returns {string}
 */
export const buildReferralLink = (referralCode) => {
  if (!referralCode) return ''
  const botUsername = (import.meta.env?.VITE_BOT_USERNAME || 'mindbeatybot').replace('@', '')
  return `https://t.me/${botUsername}?start=ref_${referralCode}`
}
