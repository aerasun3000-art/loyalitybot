import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const TermsOfService = () => {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-sakura-cream">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-4 pt-6 pb-8 sticky top-0 z-10 shadow-md">
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
          <h1 className="text-xl font-bold text-white">{t('terms_of_service_title')}</h1>
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
                  Эти Условия использования ("Условия") регулируют использование нашей программы лояльности через Telegram бота и веб-приложение.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-3 font-semibold">
                  Используя LoyaltyBot, вы соглашаетесь с этими Условиями. Если вы не согласны, пожалуйста, не используйте сервис.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">1. Определения</h2>
                <ul className="list-none text-gray-600 text-sm space-y-2">
                  <li><strong>Сервис</strong> — программа лояльности LoyaltyBot (Telegram бот + веб-приложение)</li>
                  <li><strong>Пользователь</strong> / <strong>Клиент</strong> — любой человек, использующий сервис</li>
                  <li><strong>Партнер</strong> — бизнес или физическое лицо, предлагающее услуги через программу</li>
                  <li><strong>Баллы</strong> — виртуальная валюта, используемая в программе</li>
                  <li><strong>Администрация</strong> — команда LoyaltyBot, управляющая сервисом</li>
                  <li><strong>Аккаунт</strong> — ваш профиль в системе, привязанный к Telegram</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">2. Регистрация и аккаунт</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">2.1 Создание аккаунта</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Регистрация происходит через <strong>Telegram</strong></li>
                  <li>Вы должны предоставить точную информацию</li>
                  <li>Один аккаунт на человека (дубликаты запрещены)</li>
                  <li>Минимальный возраст: <strong>14 лет</strong></li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">2.2 Безопасность аккаунта</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Вы несете ответственность за безопасность своего аккаунта</li>
                  <li>Не делитесь своим Telegram аккаунтом</li>
                  <li>Немедленно сообщите нам о любом несанкционированном доступе</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">2.3 Прекращение действия аккаунта</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Мы можем приостановить или удалить ваш аккаунт, если:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>Вы нарушаете эти Условия</li>
                  <li>Обнаружено мошенничество или злоупотребление</li>
                  <li>Аккаунт неактивен более 12 месяцев</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">3. Баллы лояльности</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.1 Накопление баллов</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Баллы можно получить:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Приветственный бонус (при регистрации)</li>
                  <li>Использование услуг партнеров</li>
                  <li>Участие в акциях</li>
                  <li>Реферальная программа (приглашение друзей)</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.2 Использование баллов</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Баллы можно потратить:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>На услуги партнеров</li>
                  <li>На эксклюзивные акции</li>
                  <li>На товары и услуги из каталога</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.3 Ограничения баллов</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Баллы НЕ имеют денежной стоимости</strong></li>
                  <li>Баллы <strong>нельзя передать</strong> на другой аккаунт</li>
                  <li>Баллы <strong>нельзя вывести</strong> наличными</li>
                  <li>Баллы могут иметь <strong>срок действия</strong> (указывается в акциях)</li>
                  <li>Администрация может <strong>корректировать балансы</strong> в случае ошибок или мошенничества</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.4 Отмена баллов</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Мы можем отменить баллы, если:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>Они были начислены по ошибке</li>
                  <li>Обнаружено мошенничество</li>
                  <li>Нарушены условия использования сервиса</li>
                  <li>Был произведен возврат за услугу</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">4. Запрещенные действия</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3 font-semibold">
                  Следующие действия <strong>СТРОГО ЗАПРЕЩЕНЫ</strong>:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Создание фальшивых аккаунтов или ботов</li>
                  <li>Мошенничество или попытки манипулировать системой</li>
                  <li>Спам, флуд, чрезмерные запросы</li>
                  <li>Использование сервиса в незаконных целях</li>
                  <li>Публикация оскорбительного или вредного контента</li>
                  <li>Попытки взлома или доступа к чужим данным</li>
                  <li>Перепродажа или передача баллов</li>
                  <li>Любая деятельность, наносящая вред сервису или пользователям</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-semibold">
                  Нарушение приведет к немедленному удалению аккаунта и возможным юридическим последствиям.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">5. Интеллектуальная собственность</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">5.1 Наши права</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Весь контент сервиса (код, дизайн, тексты, логотипы) является нашей <strong>интеллектуальной собственностью</strong>.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Вы не можете:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Копировать или модифицировать код сервиса</li>
                  <li>Использовать наши товарные знаки без разрешения</li>
                  <li>Создавать производные продукты на основе нашего сервиса</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">5.2 Ваш контент</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Контент, который вы загружаете (фото, отзывы):
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>Остается вашей собственностью</li>
                  <li>Вы предоставляете нам лицензию на его использование в сервисе</li>
                  <li>Вы несете ответственность за его законность</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">6. Ограничение ответственности</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">6.1 Сервис "как есть"</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Мы предоставляем сервис <strong>"как есть"</strong> без гарантий:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Бесперебойной работы</li>
                  <li>Отсутствия ошибок</li>
                  <li>Соответствия вашим ожиданиям</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">6.2 Ограничение ответственности</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Мы <strong>НЕ несем ответственности</strong> за:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Потерю баллов или данных из-за технических сбоев</li>
                  <li>Действия или бездействие партнеров</li>
                  <li>Косвенные или последующие убытки</li>
                  <li>Упущенную выгоду</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-semibold">
                  Максимальная ответственность: сумма баллов на вашем счету.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">7. Изменения в сервисе</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Мы оставляем за собой право:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Изменять функциональность сервиса</li>
                  <li>Изменять Условия в любое время</li>
                  <li>Приостанавливать или прекращать работу сервиса</li>
                  <li>Изменять стоимость баллов или правила их начисления/списания</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-semibold">
                  О значительных изменениях вы будете уведомлены через Telegram.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">8. Конфиденциальность</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ваши данные обрабатываются в соответствии с нашей <strong>Политикой конфиденциальности</strong>.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">
                  Пожалуйста, ознакомьтесь с ней.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">9. Контактная информация</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Для вопросов и поддержки:
                </p>
                <ul className="list-none text-gray-600 text-sm space-y-1">
                  <li><strong>Telegram:</strong> команда <code className="bg-gray-100 px-1 rounded">/support</code> в боте</li>
                  <li><strong>Email:</strong> support@loyalitybot.com</li>
                  <li><strong>Поддержка:</strong> @LoyaltyBot_Support</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-3">10. Принятие условий</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3 font-semibold">
                  Используя LoyaltyBot, вы подтверждаете, что:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Вы прочитали и поняли эти Условия</li>
                  <li>Вы согласны соблюдать все правила</li>
                  <li>Вы достигли минимального возраста (14+ лет)</li>
                  <li>Предоставленная вами информация точна</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-bold text-center mt-4">
                  Спасибо за использование LoyaltyBot! 🎉
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
                  These Terms of Service ("Terms") govern your use of our loyalty program through the Telegram bot and web application.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-3 font-semibold">
                  By using LoyaltyBot, you agree to these Terms. If you do not agree, please do not use the service.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">1. Definitions</h2>
                <ul className="list-none text-gray-600 text-sm space-y-2">
                  <li><strong>Service</strong> — LoyaltyBot loyalty program (Telegram bot + web application)</li>
                  <li><strong>User</strong> / <strong>Client</strong> — any person using the service</li>
                  <li><strong>Partner</strong> — business or individual offering services through the program</li>
                  <li><strong>Points</strong> — virtual currency used in the program</li>
                  <li><strong>Administration</strong> — LoyaltyBot team managing the service</li>
                  <li><strong>Account</strong> — your profile in the system linked to Telegram</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">2. Registration and Account</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">2.1 Account Creation</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Registration is done through <strong>Telegram</strong></li>
                  <li>You must provide accurate information</li>
                  <li>One account per person (duplicate accounts prohibited)</li>
                  <li>Minimum age: <strong>14 years</strong></li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">2.2 Account Security</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>You are responsible for account security</li>
                  <li>Do not share your Telegram account</li>
                  <li>Notify us immediately of any unauthorized access</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">2.3 Account Termination</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  We may suspend or delete your account if:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>You violate these Terms</li>
                  <li>Fraud or abuse is detected</li>
                  <li>Account is inactive for more than 12 months</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">3. Loyalty Points</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.1 Earning Points</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Points can be earned:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Welcome bonus (upon registration)</li>
                  <li>Using partner services</li>
                  <li>Participating in promotions</li>
                  <li>Referral program (inviting friends)</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.2 Using Points</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">Points can be spent:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>On partner services</li>
                  <li>On exclusive promotions</li>
                  <li>On goods and services in the catalog</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.3 Point Restrictions</h3>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li><strong>Points have NO monetary value</strong></li>
                  <li>Points <strong>cannot be transferred</strong> to another account</li>
                  <li>Points <strong>cannot be withdrawn</strong> as cash</li>
                  <li>Points may have an <strong>expiration date</strong> (indicated in promotions)</li>
                  <li>Administration may <strong>adjust balances</strong> in case of errors or fraud</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">3.4 Point Cancellation</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  We may cancel points if:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>They were accrued by error</li>
                  <li>Fraud was detected</li>
                  <li>Service terms were violated</li>
                  <li>Refund was issued for the service</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">4. Prohibited Activities</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3 font-semibold">
                  The following are <strong>STRICTLY PROHIBITED</strong>:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Creating fake accounts or bots</li>
                  <li>Fraud or attempts to manipulate the system</li>
                  <li>Spamming, flooding, excessive requests</li>
                  <li>Using the service for illegal purposes</li>
                  <li>Publishing offensive or harmful content</li>
                  <li>Attempting to hack or access others' data</li>
                  <li>Reselling or transferring points</li>
                  <li>Any activity that harms the service or users</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-semibold">
                  Violation will result in immediate account deletion and possible legal action.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">5. Intellectual Property</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">5.1 Our Rights</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  All service content (code, design, texts, logos) is our <strong>intellectual property</strong>.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">You may not:</p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Copy or modify the service code</li>
                  <li>Use our trademarks without permission</li>
                  <li>Create derivative products based on our service</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">5.2 Your Content</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  Content you upload (photos, reviews):
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                  <li>Remains your property</li>
                  <li>You grant us a license to use it in the service</li>
                  <li>You are responsible for its legality</li>
                </ul>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">6. Disclaimers</h2>
                
                <h3 className="text-lg font-semibold text-gray-700 mb-2">6.1 Service "As Is"</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  We provide the service <strong>"as is"</strong> without guarantees:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-4">
                  <li>Uninterrupted operation</li>
                  <li>Error-free functionality</li>
                  <li>Meeting your expectations</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-700 mb-2">6.2 Limitation of Liability</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  We are <strong>NOT responsible</strong> for:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Loss of points or data due to technical failures</li>
                  <li>Partner actions or inactions</li>
                  <li>Indirect or consequential damages</li>
                  <li>Lost profits</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-semibold">
                  Maximum liability: amount of points in your account.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">7. Service Changes</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  We reserve the right to:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>Change service functionality</li>
                  <li>Change Terms at any time</li>
                  <li>Suspend or terminate the service</li>
                  <li>Change point value or earning/spending rules</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-semibold">
                  You will be notified of significant changes via Telegram.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">8. Privacy</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Your data is processed according to our <strong>Privacy Policy</strong>.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">
                  Please review it.
                </p>
              </section>

              <section className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">9. Contact Information</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  For questions and support:
                </p>
                <ul className="list-none text-gray-600 text-sm space-y-1">
                  <li><strong>Telegram:</strong> <code className="bg-gray-100 px-1 rounded">/support</code> command in the bot</li>
                  <li><strong>Email:</strong> support@loyalitybot.com</li>
                  <li><strong>Support:</strong> @LoyaltyBot_Support</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-3">10. Acceptance of Terms</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3 font-semibold">
                  By using LoyaltyBot, you confirm that:
                </p>
                <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 mb-3">
                  <li>You have read and understood these Terms</li>
                  <li>You agree to comply with all rules</li>
                  <li>You are of legal age (14+ years)</li>
                  <li>The information you provided is accurate</li>
                </ul>
                <p className="text-gray-600 text-sm leading-relaxed font-bold text-center mt-4">
                  Thank you for using LoyaltyBot! 🎉
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

export default TermsOfService

