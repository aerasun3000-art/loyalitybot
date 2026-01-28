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

// Получить username пользователя
export const getUsername = () => {
  const user = getTelegramUser()
  return user?.username || null
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
  
  // В версии 6.0 showAlert не поддерживается - используем alert() сразу
  if (!tg || (tg.version && parseFloat(tg.version) >= 6.0)) {
    // Браузер или версия 6.0+ - используем обычный alert
    alert(message)
    return
  }
  
  // Пытаемся использовать showAlert только для версий < 6.0
  try {
    if (tg.showAlert && typeof tg.showAlert === 'function') {
      tg.showAlert(message)
    } else {
      // Fallback
      alert(message)
    }
  } catch (error) {
    // Fallback при любой ошибке
    alert(message)
  }
}

// Показать confirm
export const showConfirm = (message, callback) => {
  const tg = getTelegramWebApp()
  if (!tg) {
    // Fallback для браузера
    const result = confirm(message)
    if (callback) callback(result)
    return
  }
  
  try {
    if (tg.showConfirm && typeof tg.showConfirm === 'function') {
      tg.showConfirm(message, callback)
    } else {
      // Fallback для версий без showConfirm
      const result = confirm(message)
      if (callback) callback(result)
    }
  } catch (error) {
    // Fallback при ошибке
    console.warn('showConfirm not supported, using confirm:', error)
    const result = confirm(message)
    if (callback) callback(result)
  }
}

// Вызвать haptic feedback
export const hapticFeedback = (type = 'medium') => {
  const tg = getTelegramWebApp()
  
  // В версии 6.0 HapticFeedback не поддерживается - просто игнорируем
  if (!tg || !tg.HapticFeedback) {
    return
  }
  
  // Проверяем версию - в 6.0+ HapticFeedback не работает
  if (tg.version && parseFloat(tg.version) >= 6.0) {
    // Версия 6.0+ - HapticFeedback не поддерживается, просто игнорируем
    return
  }
  
  // Пытаемся вызвать только если версия < 6.0
  try {
    switch (type) {
      case 'light':
        if (tg.HapticFeedback?.impactOccurred) {
          tg.HapticFeedback.impactOccurred('light')
        }
        break
      case 'medium':
        if (tg.HapticFeedback?.impactOccurred) {
          tg.HapticFeedback.impactOccurred('medium')
        }
        break
      case 'heavy':
        if (tg.HapticFeedback?.impactOccurred) {
          tg.HapticFeedback.impactOccurred('heavy')
        }
        break
      case 'success':
        if (tg.HapticFeedback?.notificationOccurred) {
          tg.HapticFeedback.notificationOccurred('success')
        }
        break
      case 'error':
        if (tg.HapticFeedback?.notificationOccurred) {
          tg.HapticFeedback.notificationOccurred('error')
        }
        break
      case 'warning':
        if (tg.HapticFeedback?.notificationOccurred) {
          tg.HapticFeedback.notificationOccurred('warning')
        }
        break
      default:
        if (tg.HapticFeedback?.impactOccurred) {
          tg.HapticFeedback.impactOccurred('medium')
        }
    }
  } catch (error) {
    // Игнорируем все ошибки HapticFeedback (не критично)
    // Не логируем, чтобы не засорять консоль
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

