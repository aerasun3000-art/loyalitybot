import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthBootstrap from './components/AuthBootstrap'
import './styles/index.css'
import { initSentry } from './sentry'
import { resolveApiUrl } from './utils/apiResolver'

// Инициализация Sentry для отслеживания ошибок (не блокирует загрузку)
try {
  initSentry()
} catch (error) {
  // Игнорируем ошибки инициализации Sentry, чтобы не блокировать загрузку приложения
  console.debug('Sentry initialization skipped')
}

// Очистка кэша только при необходимости (не на публичных страницах)
const isPublicPage = window.location.pathname.startsWith('/onepager/') || 
                     window.location.pathname.startsWith('/partner/income-presentation') ||
                     window.location.pathname.startsWith('/partner/beauty-presentation') ||
                     window.location.pathname.startsWith('/partner/apply') ||
                     window.location.pathname.startsWith('/availability-map') ||
                     window.location.pathname.startsWith('/privacy') ||
                     window.location.pathname.startsWith('/terms')

if (!isPublicPage && 'caches' in window) {
  caches.keys().then(function(names) {
    names.forEach(function(name) {
      caches.delete(name)
    })
  })
}

// Очистка кэша только один раз при первой загрузке (только для Telegram Web App)
(function checkAndClearCache() {
  try {
    // Пропускаем очистку кэша для публичных страниц
    if (isPublicPage) {
      return
    }
    
    const appVersion = 'v9-fix-infinite-reload'
    const storedVersion = sessionStorage.getItem('app_version')
    
    // Очищаем кэш только если версия изменилась И это первая загрузка (нет параметра _reload)
    if (storedVersion !== appVersion && !window.location.search.includes('_reload')) {
      // Очищаем кэш
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
      sessionStorage.setItem('app_version', appVersion)
      
      // Перезагрузка только для Telegram Web App и только один раз
      if (window.Telegram?.WebApp) {
        setTimeout(() => {
          const url = new URL(window.location.href)
          url.searchParams.set('_reload', '1')
          url.searchParams.set('v', Date.now().toString())
          window.location.href = url.toString()
        }, 100)
        return
      }
    } else if (storedVersion !== appVersion) {
      // Обновляем версию без перезагрузки
      sessionStorage.setItem('app_version', appVersion)
    }
  } catch (e) {
    // Игнорируем ошибки
  }
})()

// Инициализация Telegram Web App
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp
  tg.ready()
  tg.expand()

  // Принудительно обновляем версию для Telegram
  console.log('📱 Telegram WebApp initialized, version:', tg.version)
}

// Тема применяется через index.html (раннее) и themeStore onRehydrateStorage (с inline-стилями)

resolveApiUrl().catch(() => {}).then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </React.StrictMode>,
  )
})