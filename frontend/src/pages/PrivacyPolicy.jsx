import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const PrivacyPolicy = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-sakura-cream">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-4 pt-6 pb-8 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">{t('privacy_policy_title')}</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>
        <div className="text-center text-white/80 text-sm">
          <p>{t('legal_updated')}: 28 {language === 'ru' ? 'октября' : 'October'} 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 pb-20">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          {language === 'ru' ? (
            // Русская версия
            <div className="prose prose-sm max-w-none">
              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Введение</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  Добро пожаловать в <strong>LoyaltyBot</strong>!
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Эта Политика конфиденциальности описывает, как мы собираем, используем, храним и защищаем ваши персональные данные при использовании нашей программы лояльности через Telegram бота и веб-приложение.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">1. Какие данные мы собираем</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">1.1 Информация, которую вы предоставляете</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Имя и фамилия</strong> (по желанию, можете указать в профиле)</li>
                  <li><strong>Номер телефона</strong> (по желанию, для дополнительной верификации)</li>
                  <li><strong>Telegram User ID</strong> (автоматически, для аутентификации)</li>
                  <li><strong>Фото/изображения</strong>, загружаемые при создании акций или услуг</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">1.2 Информация, собираемая автоматически</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Telegram username</strong> и <strong>фото профиля</strong> (если доступно)</li>
                  <li><strong>Chat ID</strong> (идентификатор Telegram)</li>
                  <li><strong>Настройки языка</strong> (для локализации интерфейса)</li>
                  <li><strong>История активности</strong>: транзакции, накопленные и потраченные баллы</li>
                  <li><strong>Информация о партнере</strong> (если вы партнер): услуги, акции, статистика</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">1.3 Технические данные</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li><strong>Логи</strong>: взаимодействие с ботом, ошибки, временные метки</li>
                  <li><strong>IP-адрес</strong> и <strong>данные браузера</strong> (при использовании веб-приложения)</li>
                  <li><strong>Тип устройства</strong> и <strong>операционная система</strong> (для оптимизации)</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">2. Как мы используем ваши данные</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Мы используем ваши данные для следующих целей:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li><strong>Предоставление услуг</strong>: работа программы лояльности, управление баллами</li>
                  <li><strong>Персонализация</strong>: улучшение пользовательского опыта, рекомендации</li>
                  <li><strong>Коммуникация</strong>: уведомления об акциях, новостях, обновлениях</li>
                  <li><strong>Аналитика для партнеров</strong>: предоставление статистики партнерам (агрегированные данные)</li>
                  <li><strong>Безопасность</strong>: предотвращение мошенничества, спама и нарушений правил</li>
                  <li><strong>Соблюдение законов</strong>: выполнение требований законодательства</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">3. С кем мы делимся данными</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  Мы <strong>НЕ продаем</strong> ваши данные третьим лицам.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Мы можем передавать данные в следующих случаях:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li><strong>С партнерами</strong>: только необходимую информацию (имя, потраченные баллы) при обмене баллов</li>
                  <li><strong>С поставщиками услуг</strong>: хостинг (Supabase), аналитика, облачное хранилище</li>
                  <li><strong>Юридические требования</strong>: когда требуется по закону или постановлению суда</li>
                  <li><strong>Ваше согласие</strong>: когда вы явно соглашаетесь на передачу данных</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">4. Хранение данных</h2>
                <ul className="list-none text-gray-600 text-sm space-y-2">
                  <li><strong>Где:</strong> Ваши данные хранятся на серверах <strong>Supabase</strong> (ЕС/США)</li>
                  <li><strong>Как долго:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>Активные аккаунты: неограниченно, пока аккаунт активен</li>
                      <li>Удаленные аккаунты: данные удаляются в течение 30 дней</li>
                      <li>Логи: хранятся 90 дней</li>
                    </ul>
                  </li>
                  <li><strong>Защита:</strong> Мы используем шифрование (SSL/TLS), контроль доступа, регулярные бэкапы</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">5. Ваши права (GDPR)</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">У вас есть следующие права:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Право на доступ</strong>: запросить копию всех ваших данных</li>
                  <li><strong>Право на исправление</strong>: исправить неточные данные</li>
                  <li><strong>Право на удаление</strong>: запросить удаление всех ваших данных</li>
                  <li><strong>Право на портируемость</strong>: получить данные в формате JSON/Excel</li>
                  <li><strong>Право на ограничение обработки</strong>: ограничить использование данных</li>
                  <li><strong>Право на возражение</strong>: возразить против определенных видов обработки</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">Как реализовать права</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Отправьте запрос через:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>Telegram бот: команда <code className="bg-gray-100 px-1 rounded">/support</code> или <code className="bg-gray-100 px-1 rounded">поддержка</code></li>
                  <li>Email: <strong>support@loyalitybot.com</strong></li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">
                  <strong>Время ответа:</strong> до 30 дней
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">6. Контактная информация</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  По вопросам конфиденциальности:
                </p>
                <ul className="list-none text-gray-600 text-sm space-y-1">
                  <li><strong>Email:</strong> support@loyalitybot.com</li>
                  <li><strong>Telegram:</strong> @LoyaltyBot_Support</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-3">7. Согласие</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  <strong>Используя LoyaltyBot, вы соглашаетесь с этой Политикой конфиденциальности.</strong>
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">
                  Если вы не согласны, пожалуйста, не используйте наш сервис.
                </p>
              </section>
            </div>
          ) : (
            // English version
            <div className="prose prose-sm max-w-none">
              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Introduction</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  Welcome to <strong>LoyaltyBot</strong>!
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  This Privacy Policy describes how we collect, use, store, and protect your personal data when you use our loyalty program through the Telegram bot and web application.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">1. Data We Collect</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">1.1 Information You Provide</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Name and surname</strong> (optional, you can specify it in your profile)</li>
                  <li><strong>Phone number</strong> (optional, for additional verification)</li>
                  <li><strong>Telegram User ID</strong> (automatic, for authentication)</li>
                  <li><strong>Photos/Images</strong> uploaded when creating promotions or services</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">1.2 Information Collected Automatically</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Telegram username</strong> and <strong>profile photo</strong> (if available)</li>
                  <li><strong>Chat ID</strong> (Telegram identifier)</li>
                  <li><strong>Language settings</strong> (for interface localization)</li>
                  <li><strong>Activity history</strong>: transactions, accumulated and spent points</li>
                  <li><strong>Partner information</strong> (if you are a partner): services, promotions, statistics</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">1.3 Technical Data</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li><strong>Logs</strong>: interaction with the bot, errors, timestamps</li>
                  <li><strong>IP address</strong> and <strong>browser data</strong> (when using the web application)</li>
                  <li><strong>Device type</strong> and <strong>operating system</strong> (for optimization)</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">2. How We Use Your Data</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">We use your data for the following purposes:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li><strong>Service provision</strong>: loyalty program operation, points management</li>
                  <li><strong>Personalization</strong>: improving user experience, recommendations</li>
                  <li><strong>Communication</strong>: notifications about promotions, news, updates</li>
                  <li><strong>Partner analytics</strong>: providing statistics for partners (aggregated data)</li>
                  <li><strong>Security</strong>: fraud prevention, spam, and rule violations</li>
                  <li><strong>Legal compliance</strong>: following laws and regulations</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">3. Data Sharing</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  We <strong>DO NOT sell</strong> your data to third parties.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">We may share your data in the following cases:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li><strong>With partners</strong>: only necessary information (name, points spent) when redeeming points</li>
                  <li><strong>With service providers</strong>: hosting (Supabase), analytics, cloud storage</li>
                  <li><strong>Legal requirements</strong>: when required by law or court order</li>
                  <li><strong>Your consent</strong>: when you explicitly agree to data sharing</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">4. Data Storage</h2>
                <ul className="list-none text-gray-600 text-sm space-y-2">
                  <li><strong>Where:</strong> Your data is stored on <strong>Supabase</strong> servers (EU/USA)</li>
                  <li><strong>How long:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>Active accounts: indefinitely while the account is active</li>
                      <li>Deleted accounts: data is removed within 30 days</li>
                      <li>Logs: stored for 90 days</li>
                    </ul>
                  </li>
                  <li><strong>Protection:</strong> We use encryption (SSL/TLS), access control, and regular backups</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">5. Your Rights (GDPR)</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">You have the following rights:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Right to access</strong>: Request a copy of all your data</li>
                  <li><strong>Right to correction</strong>: Correct inaccurate data</li>
                  <li><strong>Right to deletion</strong>: Request deletion of all your data</li>
                  <li><strong>Right to data portability</strong>: Receive your data in JSON/Excel format</li>
                  <li><strong>Right to restrict processing</strong>: Limit how we use your data</li>
                  <li><strong>Right to object</strong>: Object to certain types of data processing</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">How to Exercise Your Rights</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Send a request via:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>Telegram bot: <code className="bg-gray-100 px-1 rounded">/support</code> or <code className="bg-gray-100 px-1 rounded">support</code> command</li>
                  <li>Email: <strong>support@loyalitybot.com</strong></li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">
                  <strong>Response time:</strong> up to 30 days
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">6. Contact Us</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  If you have questions about privacy:
                </p>
                <ul className="list-none text-gray-600 text-sm space-y-1">
                  <li><strong>Email:</strong> support@loyalitybot.com</li>
                  <li><strong>Telegram:</strong> @LoyaltyBot_Support</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-3">7. Consent</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  <strong>By using LoyaltyBot, you agree to this Privacy Policy.</strong>
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">
                  If you do not agree, please do not use our service.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>LoyaltyBot © 2025</p>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy

