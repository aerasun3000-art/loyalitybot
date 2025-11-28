import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { initSentry } from './sentry'

// Инициализация Sentry для отслеживания ошибок (не блокируем загрузку при ошибке)
try {
  initSentry()
} catch (error) {
  console.warn('Sentry initialization failed (non-critical):', error)
  // Продолжаем загрузку даже если Sentry не инициализировался
}

// Принудительная очистка кэша для Telegram Web App
if ('caches' in window) {
  caches.keys().then(function(names) {
    names.forEach(function(name) {
      caches.delete(name)
    })
  })
}

// Очистка кэша при обновлении версии (только один раз)
(function checkAndClearCache() {
  try {
    const appVersion = 'v14-stable'
    const storedVersion = sessionStorage.getItem('app_version')
    const urlParams = new URLSearchParams(window.location.search)
    const hasReloadParam = urlParams.has('_reload')
    
    // Если версия изменилась И мы еще не делали перезагрузку в этой сессии
    if (storedVersion !== appVersion && !hasReloadParam) {
      console.log('🔄 New app version detected, clearing cache...')
      // Очистка кэша
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
      // Очищаем только старые данные, не все localStorage
      try {
        const keysToKeep = ['loyalitybot-language'] // Сохраняем язык
        const newStorage = {}
        keysToKeep.forEach(key => {
          const value = localStorage.getItem(key)
          if (value) newStorage[key] = value
        })
        localStorage.clear()
        Object.keys(newStorage).forEach(key => {
          localStorage.setItem(key, newStorage[key])
        })
      } catch (e) {
        console.warn('Could not preserve localStorage:', e)
      }
      
      sessionStorage.setItem('app_version', appVersion)
      
      // Перезагрузка только один раз, если это Telegram Web App
      if (window.Telegram?.WebApp) {
        console.log('🔄 Reloading once to apply new version...')
        setTimeout(() => {
          const url = window.location.href.split('?')[0]
          window.location.href = url + '?v=' + Date.now() + '&_reload=1'
        }, 100)
        return
      }
    } else if (hasReloadParam) {
      // Убираем параметр _reload из URL после перезагрузки
      const url = new URL(window.location.href)
      url.searchParams.delete('_reload')
      url.searchParams.delete('_v12')
      url.searchParams.delete('_buttons_removed')
      url.searchParams.delete('_nocache')
      window.history.replaceState({}, '', url.toString())
    }
  } catch (e) {
    console.warn('Could not clear cache:', e)
  }
})()

// Инициализация Telegram Web App
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp
  tg.ready()
  tg.expand()
  
  // Отключаем случайное закрытие приложения свайпом
  try {
    // Показываем подтверждение перед закрытием
    if (tg.enableClosingConfirmation && typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation()
    }
    // Отключаем вертикальные свайпы (может не работать в новых версиях)
    if (tg.disableVerticalSwipes && typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes()
    }
  } catch (error) {
    console.warn('Could not disable swipe-to-close:', error)
  }
  
  // Применяем тему Telegram
  document.documentElement.className = tg.colorScheme
  
  // Принудительно обновляем версию для Telegram
  console.log('📱 Telegram WebApp initialized, version:', tg.version)
}

// Проверяем наличие root элемента перед рендерингом
const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('❌ Root element not found!')
  document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: system-ui;"><h1>Ошибка загрузки</h1><p>Элемент root не найден</p></div>'
} else {
  console.log('✅ Root element found, starting React render...')
  try {
    const root = ReactDOM.createRoot(rootElement)
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
    console.log('✅ App rendered successfully')
  } catch (error) {
    console.error('❌ Failed to render app:', error)
    console.error('Error stack:', error.stack)
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: system-ui;">
        <h1>Ошибка загрузки приложения</h1>
        <p style="color: red;">${error.message}</p>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; max-width: 600px; margin: 20px auto;">${error.stack || 'No stack trace'}</pre>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">Пожалуйста, откройте приложение через Telegram бота</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">Перезагрузить</button>
      </div>
    `
  }
}

