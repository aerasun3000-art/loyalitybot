const OnePagerPartner = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Герой-секция */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-10"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              🤝 Программа Лояльности
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                для Вашего Бизнеса
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Увеличьте выручку на 30% и удержите клиентов с помощью современной системы бонусов
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-shadow">
                Стать партнёром
              </button>
              <button className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold text-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-600 dark:hover:border-purple-600 transition-colors">
                Узнать больше
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Преимущества */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          ✨ Почему стоит присоединиться
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <BenefitCard
            icon="📈"
            title="Рост выручки"
            description="Увеличение среднего чека на 20-40% благодаря программе накопления баллов"
          />
          <BenefitCard
            icon="👥"
            title="Лояльные клиенты"
            description="Клиенты возвращаются чаще — retention rate вырастает на 60%"
          />
          <BenefitCard
            icon="📊"
            title="Полная аналитика"
            description="Детальная статистика и метрики в режиме реального времени"
          />
          <BenefitCard
            icon="🎯"
            title="Целевой маркетинг"
            description="Персонализированные акции и предложения для ваших клиентов"
          />
          <BenefitCard
            icon="⚡"
            title="Быстрый старт"
            description="Настройка за 15 минут, никакой сложной интеграции"
          />
          <BenefitCard
            icon="💳"
            title="Без комиссий"
            description="Платите только за результат — процент от оборота"
          />
        </div>
      </div>

      {/* Как это работает */}
      <div className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            🔄 Как это работает
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title="Регистрация"
              description="Заполните простую анкету и получите одобрение за 24 часа"
            />
            <StepCard
              number="2"
              title="Настройка"
              description="Установите процент кэшбэка и создайте первую акцию"
            />
            <StepCard
              number="3"
              title="Приглашение"
              description="Поделитесь реферальной ссылкой с вашими клиентами"
            />
            <StepCard
              number="4"
              title="Рост"
              description="Наблюдайте за ростом выручки и лояльности в дашборде"
            />
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          📊 Результаты партнёров
        </h2>
        
        <div className="grid md:grid-cols-4 gap-6">
          <StatCard value="30%" label="Рост выручки" />
          <StatCard value="60%" label="Retention rate" />
          <StatCard value="2.5x" label="Частота покупок" />
          <StatCard value="85+" label="NPS Score" />
        </div>
      </div>

      {/* Кейсы */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            💼 Истории успеха
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <CaseCard
              industry="Кофейня"
              result="+45% к выручке за 3 месяца"
              quote="Клиенты стали приходить в 2 раза чаще. Программа лояльности окупилась за первый месяц!"
              author="Анна, владелец Coffee Lab"
            />
            <CaseCard
              industry="Салон красоты"
              result="+70% повторных визитов"
              quote="Теперь мы всегда на связи с клиентами. Система напоминает им о бонусах, и они возвращаются."
              author="Мария, управляющая Beauty Space"
            />
          </div>
        </div>
      </div>

      {/* Условия */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          💎 Условия партнёрства
        </h2>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border-2 border-purple-200 dark:border-purple-800">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Что вы получаете:
              </h3>
              <ul className="space-y-3">
                <ConditionItem text="Персональный дашборд с аналитикой" />
                <ConditionItem text="Telegram-бот для управления бонусами" />
                <ConditionItem text="Автоматический подсчёт кэшбэка" />
                <ConditionItem text="Система акций и спецпредложений" />
                <ConditionItem text="NPS-опросы клиентов" />
                <ConditionItem text="Техническая поддержка 24/7" />
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Стоимость:
              </h3>
              <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl p-6">
                <div className="text-5xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  3%
                </div>
                <div className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  от оборота через программу
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  ✅ Без абонентской платы
                  <br />
                  ✅ Без скрытых комиссий
                  <br />
                  ✅ Платите только за результат
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Готовы увеличить выручку?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Присоединяйтесь к программе и начните зарабатывать больше уже сегодня
          </p>
          <button className="px-12 py-4 bg-white text-purple-600 rounded-xl font-bold text-xl hover:shadow-2xl transition-shadow">
            Стать партнёром →
          </button>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные компоненты
const BenefitCard = ({ icon, title, description }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-400">
      {description}
    </p>
  </div>
);

const StepCard = ({ number, title, description }) => (
  <div className="text-center">
    <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
      {number}
    </div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-400 text-sm">
      {description}
    </p>
  </div>
);

const StatCard = ({ value, label }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-sm">
    <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
      {value}
    </div>
    <div className="text-gray-600 dark:text-gray-400 font-medium">
      {label}
    </div>
  </div>
);

const CaseCard = ({ industry, result, quote, author }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm">
    <div className="text-purple-600 dark:text-purple-400 font-bold text-sm mb-2">
      {industry}
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
      {result}
    </div>
    <p className="text-gray-600 dark:text-gray-400 mb-4 italic">
      "{quote}"
    </p>
    <div className="text-sm text-gray-500 dark:text-gray-500">
      — {author}
    </div>
  </div>
);

const ConditionItem = ({ text }) => (
  <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
    <span className="text-green-500">✅</span>
    {text}
  </li>
);

export default OnePagerPartner;

