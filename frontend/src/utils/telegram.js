/**
 * Утилиты для работы с Telegram Web App
 */

// Получить объект Telegram Web App
export const getTelegramWebApp = () => {
  return window.Telegram?.WebApp || null
}

// Получить данные пользователя из Telegram
export const getTelegramUser = () => {
  const tg = getTelegramWebApp()
  return tg?.initDataUnsafe?.user || null
}

// Получить Chat ID пользователя
export const getChatId = () => {
  const user = getTelegramUser()
  return user?.id?.toString() || null
}

// Получить параметры из start_param
export const getStartParam = () => {
  const tg = getTelegramWebApp()
  return tg?.initDataUnsafe?.start_param || null
}

// Показать главную кнопку
export const showMainButton = (text, onClick) => {
  const tg = getTelegramWebApp()
  if (!tg) return
  
  tg.MainButton.setText(text)
  tg.MainButton.show()
  tg.MainButton.onClick(onClick)
}

// Скрыть главную кнопку
export const hideMainButton = () => {
  const tg = getTelegramWebApp()
  if (!tg) return
  
  tg.MainButton.hide()
}

// Показать кнопку "Назад"
export const showBackButton = (onClick) => {
  const tg = getTelegramWebApp()
  if (!tg) return
  
  tg.BackButton.show()
  tg.BackButton.onClick(onClick)
}

// Скрыть кнопку "Назад"
export const hideBackButton = () => {
  const tg = getTelegramWebApp()
  if (!tg) return
  
  tg.BackButton.hide()
}

// Закрыть Web App
export const closeApp = () => {
  const tg = getTelegramWebApp()
  tg?.close()
}

// Показать alert
export const showAlert = (message) => {
  const tg = getTelegramWebApp()
  tg?.showAlert(message)
}

// Показать confirm
export const showConfirm = (message, callback) => {
  const tg = getTelegramWebApp()
  tg?.showConfirm(message, callback)
}

// Вызвать haptic feedback
export const hapticFeedback = (type = 'medium') => {
  const tg = getTelegramWebApp()
  
  switch (type) {
    case 'light':
      tg?.HapticFeedback?.impactOccurred('light')
      break
    case 'medium':
      tg?.HapticFeedback?.impactOccurred('medium')
      break
    case 'heavy':
      tg?.HapticFeedback?.impactOccurred('heavy')
      break
    case 'success':
      tg?.HapticFeedback?.notificationOccurred('success')
      break
    case 'error':
      tg?.HapticFeedback?.notificationOccurred('error')
      break
    case 'warning':
      tg?.HapticFeedback?.notificationOccurred('warning')
      break
    default:
      tg?.HapticFeedback?.impactOccurred('medium')
  }
}

// Получить цветовую схему
export const getColorScheme = () => {
  const tg = getTelegramWebApp()
  return tg?.colorScheme || 'light'
}

// Проверить, запущено ли в Telegram
export const isInTelegram = () => {
  return !!getTelegramWebApp()
}

// Открыть ссылку
export const openLink = (url) => {
  const tg = getTelegramWebApp()
  tg?.openLink(url)
}

// Открыть Telegram ссылку
export const openTelegramLink = (url) => {
  const tg = getTelegramWebApp()
  tg?.openTelegramLink(url)
}

// Получить версию платформы
export const getPlatform = () => {
  const tg = getTelegramWebApp()
  return tg?.platform || 'unknown'
}

// Проверить, поддерживается ли версия
export const isVersionAtLeast = (version) => {
  const tg = getTelegramWebApp()
  return tg?.isVersionAtLeast(version) || false
}

