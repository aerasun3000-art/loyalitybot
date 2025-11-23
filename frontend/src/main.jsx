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

// АГРЕССИВНАЯ очистка кэша для версии 6.0
(function checkAndClearCache() {
  try {
    const appVersion = 'v13-new-project-fix'
    const storedVersion = sessionStorage.getItem('app_version_v13')
    
    if (storedVersion !== appVersion) {
      console.log('🔄 New app version v13-new-project-fix detected, clearing ALL cache...')
      // АГРЕССИВНАЯ очистка всего кэша
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('app_version_v13', appVersion)
      
      // Принудительная перезагрузка для Telegram Web App
      if (window.Telegram?.WebApp) {
        console.log('🔄 Reloading to apply v12-buttons-removed version...')
        setTimeout(() => {
          const url = window.location.href.split('?')[0]
          window.location.href = url + '?v=' + Date.now() + '&_reload=1&_v12=1&_buttons_removed=1&_nocache=' + Date.now()
        }, 50)
        return
      }
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

