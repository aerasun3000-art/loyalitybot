import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const BeautyPartnerPresentation = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const isRu = language === 'ru'

  // Прокрутка к секции
  const scrollToSection = (id) => {
    hapticFeedback('light')
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
      {/* Navigation Bar */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md shadow-sm"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 85%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)'
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💅</span>
            <span className="font-bold text-lg" style={{ color: 'var(--tg-theme-text-color)' }}>
              {isRu ? 'Sarafano.io для Бьюти' : 'Sarafano.io for Beauty'}
            </span>
          </div>
          <button
            onClick={() => navigate('/partner/apply')}
            className="px-4 py-2 rounded-xl font-semibold hover:shadow-lg active:scale-95 transition-all"
            style={{
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color, #fff)'
            }}
          >
            {isRu ? 'Стать партнером' : 'Become Partner'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div
            className="inline-block mb-4 px-4 py-2 rounded-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
              {isRu ? '✨ Программа лояльности нового поколения' : '✨ Next-gen loyalty program'}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: 'var(--tg-theme-text-color)' }}>
            {isRu ? (
              <>
                Увеличьте возврат клиентов<br />
                <span style={{ color: 'var(--tg-theme-button-color)' }}>на 40% за 3 месяца</span>
              </>
            ) : (
              <>
                Increase client retention<br />
                <span style={{ color: 'var(--tg-theme-button-color)' }}>by 40% in 3 months</span>
              </>
            )}
          </h1>

          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {isRu
              ? 'Telegram-бот для салонов красоты, который автоматизирует начисление баллов, напоминания клиентам и увеличивает повторные визиты через геймификацию.'
              : 'Telegram bot for beauty salons that automates points, client reminders and increases repeat visits through gamification.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              onClick={() => navigate('/partner/apply')}
              className="px-8 py-4 rounded-xl font-bold hover:shadow-xl active:scale-95 transition-all text-lg"
              style={{
                backgroundColor: 'var(--tg-theme-button-color)',
                color: 'var(--tg-theme-button-text-color, #fff)'
              }}
            >
              {isRu ? '🚀 Начать бесплатно' : '🚀 Start Free'}
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="px-8 py-4 rounded-xl font-semibold active:scale-95 transition-all text-lg"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color) 70%, transparent)',
                color: 'var(--tg-theme-text-color)',
                border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)'
              }}
            >
              {isRu ? '💰 Узнать цены' : '💰 See Pricing'}
            </button>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { value: '500+', label: isRu ? 'Партнеров' : 'Partners' },
              { value: '40%', label: isRu ? 'Рост retention' : 'Retention Growth' },
              { value: isRu ? '1 день' : '1 day', label: isRu ? 'Запуск' : 'Setup Time' },
              { value: '$0', label: isRu ? 'Старт' : 'Start Free' }
            ].map((badge, idx) => (
              <div
                key={idx}
                className="backdrop-blur-sm rounded-xl p-4"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
                }}
              >
                <div className="text-2xl font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>{badge.value}</div>
                <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{badge.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section
        id="problems"
        className="py-16 px-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 50%, transparent)' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: 'var(--tg-theme-text-color)' }}>
            {isRu ? 'Знакомые проблемы?' : 'Familiar Problems?'}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                emoji: '😤',
                title: isRu ? 'Клиенты забывают о записи' : 'Clients forget appointments',
                desc: isRu ? 'No-show до 30% записей = потеря времени и денег' : 'Up to 30% no-shows = lost time and money'
              },
              {
                emoji: '💸',
                title: isRu ? 'Дорогие CRM системы' : 'Expensive CRM systems',
                desc: isRu ? 'Yclients, Dikidi стоят $100-200/мес + скрытые комиссии' : 'Yclients, Dikidi cost $100-200/mo + hidden fees'
              },
              {
                emoji: '📱',
                title: isRu ? 'Клиенты не скачивают приложения' : 'Clients won\'t download apps',
                desc: isRu ? 'Барьер для записи: регистрация, скачивание, настройка' : 'Booking barrier: registration, download, setup'
              },
              {
                emoji: '📉',
                title: isRu ? 'Низкий возврат клиентов' : 'Low client retention',
                desc: isRu ? 'Клиенты уходят к конкурентам без программы лояльности' : 'Clients leave to competitors without loyalty program'
              },
              {
                emoji: '⏰',
                title: isRu ? 'Нет времени на маркетинг' : 'No time for marketing',
                desc: isRu ? 'Ручная рассылка напоминаний отнимает часы' : 'Manual reminder campaigns take hours'
              },
              {
                emoji: '🤝',
                title: isRu ? 'Сложные интеграции' : 'Complex integrations',
                desc: isRu ? 'Недели настройки, обучение персонала, техподдержка' : 'Weeks of setup, staff training, support'
              }
            ].map((problem, idx) => (
              <div
                key={idx}
                className="backdrop-blur-sm rounded-2xl p-6 border-2 border-red-100 hover:border-red-200 transition-all shadow-sm"
                style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)' }}
              >
                <div className="text-4xl mb-3">{problem.emoji}</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>{problem.title}</h3>
                <p style={{ color: 'var(--tg-theme-hint-color)' }}>{problem.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section
        id="solutions"
        className="py-16 px-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color) 70%, var(--tg-theme-secondary-bg-color))' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ color: 'var(--tg-theme-text-color)' }}>
            {isRu ? 'Как мы решаем эти проблемы' : 'How We Solve These Problems'}
          </h2>
          <p className="text-center mb-12 text-lg" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {isRu
              ? 'Простое решение для современного салона красоты'
              : 'Simple solution for modern beauty salon'}
          </p>

          <div className="space-y-6">
            {[
              {
                emoji: '🤖',
                title: isRu ? 'Автоматические напоминания' : 'Automatic Reminders',
                desc: isRu ? 'Бот сам напоминает клиентам за 24 часа до записи. Снижение no-show на 80%.' : 'Bot automatically reminds clients 24h before appointment. 80% no-show reduction.',
                color: 'from-green-400 to-emerald-500'
              },
              {
                emoji: '💎',
                title: isRu ? 'Программа лояльности 3 уровня' : '3-Level Loyalty Program',
                desc: isRu ? 'Клиенты получают баллы за визиты, рефералов и активности. Автоматическое повышение уровня.' : 'Clients earn points for visits, referrals and activities. Automatic level upgrades.',
                color: 'from-purple-400 to-pink-500'
              },
              {
                emoji: '📱',
                title: isRu ? 'Работает в Telegram' : 'Works in Telegram',
                desc: isRu ? 'Никаких скачиваний. Клиент открывает ссылку → видит баланс, акции, записывается.' : 'No downloads. Client opens link → sees balance, promotions, books appointment.',
                color: 'from-blue-400 to-cyan-500'
              },
              {
                emoji: '💰',
                title: isRu ? 'Прозрачные цены' : 'Transparent Pricing',
                desc: isRu ? 'От $29/мес. Без скрытых комиссий, без % с оборота. Фиксированная цена.' : 'From $29/mo. No hidden fees, no % of revenue. Fixed price.',
                color: 'from-yellow-400 to-orange-500'
              },
              {
                emoji: '⚡',
                title: isRu ? 'Запуск за 1 день' : 'Launch in 1 Day',
                desc: isRu ? 'Регистрация → настройка → первый клиент. Без интеграций, без обучения.' : 'Registration → setup → first client. No integrations, no training.',
                color: 'from-red-400 to-pink-500'
              },
              {
                emoji: '📊',
                title: isRu ? 'Аналитика и статистика' : 'Analytics & Statistics',
                desc: isRu ? 'Дашборд с оборотами, NPS оценками, топ клиентами. Видно, что работает.' : 'Dashboard with revenue, NPS scores, top clients. See what works.',
                color: 'from-indigo-400 to-purple-500'
              }
            ].map((solution, idx) => (
              <div
                key={idx}
                className="backdrop-blur-sm rounded-2xl p-6 transition-all shadow-sm"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
                  border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
                }}
              >
                <div className="flex items-start gap-4">
                  <div className={`text-4xl bg-gradient-to-br ${solution.color} rounded-xl p-3 w-16 h-16 flex items-center justify-center`}>
                    {solution.emoji}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>{solution.title}</h3>
                    <p style={{ color: 'var(--tg-theme-hint-color)' }}>{solution.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section
        id="comparison"
        className="py-16 px-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 50%, transparent)' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: 'var(--tg-theme-text-color)' }}>
            {isRu ? 'Сравнение с конкурентами' : 'Comparison with Competitors'}
          </h2>

          <div
            className="backdrop-blur-sm rounded-2xl p-6 overflow-x-auto"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
              border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)' }}>
                  <th className="text-left py-4 px-4 font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
                    {isRu ? 'Функция' : 'Feature'}
                  </th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: 'var(--tg-theme-button-color)' }}>
                    {isRu ? 'Sarafano.io' : 'Sarafano.io'}
                  </th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: 'var(--tg-theme-hint-color)' }}>
                    Yclients
                  </th>
                  <th className="text-center py-4 px-4 font-bold" style={{ color: 'var(--tg-theme-hint-color)' }}>
                    Dikidi
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    feature: isRu ? 'Цена (месяц)' : 'Price (month)',
                    loyalitybot: '$29-59',
                    yclients: '$100-200',
                    dikidi: '$50-100 + комиссии'
                  },
                  {
                    feature: isRu ? 'Запуск' : 'Setup Time',
                    loyalitybot: isRu ? '1 день' : '1 day',
                    yclients: isRu ? '1-2 недели' : '1-2 weeks',
                    dikidi: isRu ? '3-7 дней' : '3-7 days'
                  },
                  {
                    feature: isRu ? 'Комиссия с клиентов' : 'Client Commission',
                    loyalitybot: '$0',
                    yclients: isRu ? 'До 5%' : 'Up to 5%',
                    dikidi: isRu ? '2-3%' : '2-3%'
                  },
                  {
                    feature: isRu ? 'Программа лояльности' : 'Loyalty Program',
                    loyalitybot: '✅ MLM 3 уровня',
                    yclients: '⚠️ Базовая',
                    dikidi: '⚠️ Базовая'
                  },
                  {
                    feature: isRu ? 'Автонапоминания' : 'Auto Reminders',
                    loyalitybot: '✅ Telegram',
                    yclients: '⚠️ SMS (платно)',
                    dikidi: '⚠️ SMS (платно)'
                  },
                  {
                    feature: isRu ? 'Мобильное приложение' : 'Mobile App',
                    loyalitybot: isRu ? '✅ Web App (без скачивания)' : '✅ Web App (no download)',
                    yclients: '❌ Нужно скачать',
                    dikidi: '❌ Нужно скачать'
                  },
                  {
                    feature: isRu ? 'Интеграция с кассой' : 'POS Integration',
                    loyalitybot: isRu ? '✅ Опционально' : '✅ Optional',
                    yclients: '✅ Обязательно',
                    dikidi: '✅ Обязательно'
                  }
                ].map((row, idx) => (
                  <tr
                    key={idx}
                    className="transition-all"
                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 10%, transparent)' }}
                  >
                    <td className="py-4 px-4 font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>{row.feature}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 font-semibold">
                        {row.loyalitybot}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center" style={{ color: 'var(--tg-theme-hint-color)' }}>{row.yclients}</td>
                    <td className="py-4 px-4 text-center" style={{ color: 'var(--tg-theme-hint-color)' }}>{row.dikidi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="py-16 px-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color) 70%, var(--tg-theme-secondary-bg-color))' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ color: 'var(--tg-theme-text-color)' }}>
            {isRu ? 'Простые и прозрачные цены' : 'Simple & Transparent Pricing'}
          </h2>
          <p className="text-center mb-12 text-lg" style={{ color: 'var(--tg-theme-hint-color)' }}>
            {isRu
              ? 'Выберите план, который подходит вашему салону'
              : 'Choose the plan that fits your salon'}
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <div
              className="backdrop-blur-sm rounded-2xl p-6"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
                border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
              }}
            >
              <div className="text-center mb-6">
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>FREE</div>
                <div className="text-4xl font-bold mb-1" style={{ color: 'var(--tg-theme-button-color)' }}>$0</div>
                <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{isRu ? 'навсегда' : 'forever'}</div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'До 50 клиентов' : 'Up to 50 clients'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Базовые баллы' : 'Basic points'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Telegram бот' : 'Telegram bot'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: 'var(--tg-theme-hint-color)' }}>❌</span>
                  <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{isRu ? 'Автонапоминания' : 'Auto reminders'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: 'var(--tg-theme-hint-color)' }}>❌</span>
                  <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{isRu ? 'Аналитика' : 'Analytics'}</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/partner/apply')}
                className="w-full py-3 rounded-xl font-semibold transition-all"
                style={{
                  border: '2px solid var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-text-color)',
                  backgroundColor: 'transparent'
                }}
              >
                {isRu ? 'Начать' : 'Start'}
              </button>
            </div>

            {/* Starter Plan */}
            <div
              className="backdrop-blur-sm rounded-2xl p-6 shadow-lg relative"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, var(--tg-theme-secondary-bg-color))',
                border: '2px solid var(--tg-theme-button-color)'
              }}
            >
              <div
                className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)'
                }}
              >
                {isRu ? 'ПОПУЛЯРНО' : 'POPULAR'}
              </div>
              <div className="text-center mb-6">
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>STARTER</div>
                <div className="text-4xl font-bold mb-1" style={{ color: 'var(--tg-theme-button-color)' }}>$29</div>
                <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{isRu ? 'в месяц' : 'per month'}</div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'До 200 клиентов' : 'Up to 200 clients'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Автонапоминания' : 'Auto reminders'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Программа лояльности' : 'Loyalty program'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Базовая аналитика' : 'Basic analytics'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Поддержка' : 'Support'}</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/partner/apply')}
                className="w-full py-3 rounded-xl font-bold hover:shadow-xl transition-all"
                style={{
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color, #fff)'
                }}
              >
                {isRu ? 'Выбрать' : 'Choose'}
              </button>
            </div>

            {/* Pro Plan */}
            <div
              className="backdrop-blur-sm rounded-2xl p-6"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
                border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
              }}
            >
              <div className="text-center mb-6">
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>PRO</div>
                <div className="text-4xl font-bold mb-1" style={{ color: 'var(--tg-theme-button-color)' }}>$59</div>
                <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{isRu ? 'в месяц' : 'per month'}</div>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Неограниченно клиентов' : 'Unlimited clients'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'MLM 3 уровня' : 'MLM 3 levels'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Полная аналитика' : 'Full analytics'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Онлайн-запись' : 'Online booking'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span className="text-sm">{isRu ? 'Приоритетная поддержка' : 'Priority support'}</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/partner/apply')}
                className="w-full py-3 rounded-xl font-semibold transition-all"
                style={{
                  border: '2px solid var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-text-color)',
                  backgroundColor: 'transparent'
                }}
              >
                {isRu ? 'Выбрать' : 'Choose'}
              </button>
            </div>
          </div>

          {/* Revenue Share Option */}
          <div
            className="mt-8 rounded-2xl p-6"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 10%, var(--tg-theme-secondary-bg-color))',
              border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)'
            }}
          >
            <h3 className="text-xl font-bold mb-3 text-center" style={{ color: 'var(--tg-theme-text-color)' }}>
              {isRu ? '💡 Опция Revenue Share' : '💡 Revenue Share Option'}
            </h3>
            <p className="text-center mb-4" style={{ color: 'var(--tg-theme-text-color)' }}>
              {isRu
                ? 'Для салонов с оборотом $20K+/мес: платите $39-99 + 1.5-2.5% от выручки вместо фиксированной цены.'
                : 'For salons with $20K+/mo revenue: pay $39-99 + 1.5-2.5% of revenue instead of fixed price.'}
            </p>
            <div className="text-center text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {isRu
                ? 'Пример: оборот $30K → $99 + $600 = $699/мес (но вы экономите на маркетинге)'
                : 'Example: $30K revenue → $99 + $600 = $699/mo (but you save on marketing)'}
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section
        id="results"
        className="py-16 px-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 50%, transparent)' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: 'var(--tg-theme-text-color)' }}>
            {isRu ? 'Реальные результаты партнеров' : 'Real Partner Results'}
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: isRu ? 'Салон "Вероника"' : 'Salon "Veronika"',
                city: isRu ? 'Москва' : 'Moscow',
                result: '+45%',
                metric: isRu ? 'Рост retention' : 'Retention growth',
                period: isRu ? 'за 3 месяца' : 'in 3 months',
                emoji: '💅'
              },
              {
                name: isRu ? 'Барбершоп "Брутальный"' : 'Barbershop "Brutal"',
                city: isRu ? 'СПб' : 'St. Petersburg',
                result: '+60%',
                metric: isRu ? 'Повторные визиты' : 'Repeat visits',
                period: isRu ? 'за 2 месяца' : 'in 2 months',
                emoji: '💇‍♂️'
              },
              {
                name: isRu ? 'Студия ресниц "Lash Pro"' : 'Lash Studio "Lash Pro"',
                city: isRu ? 'Казань' : 'Kazan',
                result: '+35%',
                metric: isRu ? 'Средний чек' : 'Average ticket',
                period: isRu ? 'за 4 месяца' : 'in 4 months',
                emoji: '👀'
              }
            ].map((caseStudy, idx) => (
              <div
                key={idx}
                className="backdrop-blur-sm rounded-2xl p-6 hover:shadow-lg transition-all"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
                  border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
                }}
              >
                <div className="text-4xl mb-3">{caseStudy.emoji}</div>
                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--tg-theme-text-color)' }}>{caseStudy.name}</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--tg-theme-hint-color)' }}>{caseStudy.city}</p>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--tg-theme-button-color)' }}>{caseStudy.result}</div>
                <div className="text-sm mb-1" style={{ color: 'var(--tg-theme-hint-color)' }}>{caseStudy.metric}</div>
                <div className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>{caseStudy.period}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="py-16 px-4"
        style={{ backgroundColor: 'var(--tg-theme-button-color)' }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            {isRu ? 'Готовы увеличить доход?' : 'Ready to Increase Revenue?'}
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'var(--tg-theme-button-text-color, #fff)', opacity: 0.9 }}>
            {isRu
              ? 'Присоединяйтесь к 500+ партнерам, которые уже используют Sarafano.io для роста бизнеса'
              : 'Join 500+ partners already using Sarafano.io to grow their business'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/partner/apply')}
              className="px-8 py-4 rounded-xl font-bold active:scale-95 transition-all text-lg shadow-xl"
              style={{
                backgroundColor: 'var(--tg-theme-bg-color)',
                color: 'var(--tg-theme-text-color)'
              }}
            >
              {isRu ? '🚀 Стать партнером бесплатно' : '🚀 Become Partner Free'}
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="px-8 py-4 rounded-xl font-semibold active:scale-95 transition-all text-lg"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-text-color, #fff) 20%, transparent)',
                color: 'var(--tg-theme-button-text-color, #fff)',
                border: '2px solid color-mix(in srgb, var(--tg-theme-button-text-color, #fff) 30%, transparent)'
              }}
            >
              {isRu ? '📋 Посмотреть тарифы' : '📋 View Plans'}
            </button>
          </div>
          <p className="mt-6 text-sm" style={{ color: 'var(--tg-theme-button-text-color, #fff)', opacity: 0.8 }}>
            {isRu
              ? '✅ Без кредитной карты • ✅ Запуск за 1 день • ✅ Отмена в любой момент'
              : '✅ No credit card • ✅ Launch in 1 day • ✅ Cancel anytime'}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-4 text-center"
        style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)'
        }}
      >
        <p className="text-sm" style={{ opacity: 0.8 }}>
          {isRu
            ? '© 2025 Sarafano.io. Все права защищены.'
            : '© 2025 Sarafano.io. All rights reserved.'}
        </p>
      </footer>
    </div>
  )
}

export default BeautyPartnerPresentation
