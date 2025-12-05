import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { initSentry } from './sentry'

// Инициализация Sentry для отслеживания ошибок
initSentry()

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
    const appVersion = 'v8-bot-intermediary-final'
    const storedVersion = sessionStorage.getItem('app_version_v8')
    
    if (storedVersion !== appVersion) {
      console.log('🔄 New app version v8-bot-intermediary-final detected, clearing ALL cache...')
      // Очищаем всё
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('app_version_v8', appVersion)
      
      // Принудительная перезагрузка для Telegram Web App
      if (window.Telegram?.WebApp) {
        console.log('🔄 Reloading to apply v4 version...')
        setTimeout(() => {
          window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now() + '&_reload=1'
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)