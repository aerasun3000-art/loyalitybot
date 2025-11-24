const OnePagerInvestor = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Герой-секция */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block bg-purple-500/30 px-4 py-2 rounded-full text-sm font-bold mb-6">
                ИНВЕСТИЦИОННОЕ ПРЕДЛОЖЕНИЕ
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Loyalty Platform
              </h1>
              <p className="text-xl text-purple-100 mb-8">
                B2B2C платформа программ лояльности для малого и среднего бизнеса
              </p>
              <div className="flex gap-6">
                <div>
                  <div className="text-4xl font-bold">$15M</div>
                  <div className="text-purple-200 text-sm">Оценка проекта</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">$3M</div>
                  <div className="text-purple-200 text-sm">Привлекаем</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">20%</div>
                  <div className="text-purple-200 text-sm">Доля</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">Ключевые метрики</h3>
              <div className="space-y-4">
                <MetricRow label="MRR" value="$450K" />
                <MetricRow label="Количество партнёров" value="127" />
                <MetricRow label="Активных пользователей" value="15,000+" />
                <MetricRow label="MoM Growth" value="+35%" />
                <MetricRow label="LTV/CAC" value="4.2x" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Проблема и решение */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              🎯 Проблема
            </h2>
            <div className="space-y-4">
              <ProblemCard text="Малый бизнес теряет 60% клиентов после первой покупки" />
              <ProblemCard text="Программы лояльности сложны и дороги в внедрении" />
              <ProblemCard text="Нет простых инструментов для удержания клиентов" />
              <ProblemCard text="Владельцы бизнеса не понимают поведение клиентов" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              💡 Наше решение
            </h2>
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-8">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                Простая SaaS-платформа программ лояльности, интегрированная с Telegram, 
                которая помогает бизнесу удерживать клиентов и увеличивать выручку.
              </p>
              <ul className="space-y-3">
                <SolutionItem text="Запуск за 15 минут без технической интеграции" />
                <SolutionItem text="Управление через Telegram-бота" />
                <SolutionItem text="Детальная аналитика и NPS" />
                <SolutionItem text="Оплата только за результат" />
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Рыночный потенциал */}
      <div className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            📊 Рыночный потенциал
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <MarketCard
              title="TAM"
              subtitle="Весь рынок"
              value="$150B"
              description="Глобальный рынок программ лояльности"
            />
            <MarketCard
              title="SAM"
              subtitle="Доступный рынок"
              value="$8B"
              description="SMB сегмент в России и СНГ"
              highlight
            />
            <MarketCard
              title="SOM"
              subtitle="Целевой рынок"
              value="$500M"
              description="Первые 3 года — фокус на РФ"
            />
          </div>

          <div className="mt-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              🎯 Целевая аудитория
            </h3>
            <div className="grid md:grid-cols-4 gap-6">
              <TargetItem icon="☕" text="Кофейни и рестораны" />
              <TargetItem icon="💅" text="Салоны красоты" />
              <TargetItem icon="🛍️" text="Розничные магазины" />
              <TargetItem icon="💪" text="Фитнес-клубы" />
            </div>
            <p className="mt-6 text-gray-600 dark:text-gray-400">
              <strong>2.4M</strong> малых предприятий в России, <strong>80%</strong> из которых 
              не имеют программы лояльности
            </p>
          </div>
        </div>
      </div>

      {/* Бизнес-модель */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          💰 Бизнес-модель
        </h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Монетизация
            </h3>
            <div className="space-y-4">
              <RevenueItem
                model="Revenue Share"
                description="3% от оборота через платформу"
                share="85%"
              />
              <RevenueItem
                model="Premium подписка"
                description="$2,990/мес за расширенную аналитику"
                share="10%"
              />
              <RevenueItem
                model="Маркетплейс услуг"
                description="Комиссия 5% за услуги партнёров"
                share="5%"
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Unit Economics
            </h3>
            <div className="space-y-4">
              <UnitEconItem label="Средний чек партнёра" value="$15,000/мес" />
              <UnitEconItem label="CAC" value="$4,500" />
              <UnitEconItem label="LTV" value="$180,000" />
              <UnitEconItem label="LTV/CAC" value="4.2x" highlight />
              <UnitEconItem label="Payback period" value="3 месяца" />
              <UnitEconItem label="Churn rate" value="8%/год" />
            </div>
          </div>
        </div>
      </div>

      {/* Тяга (Traction) */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            🚀 Текущие результаты
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <TractionCard value="127" label="Активных партнёров" />
            <TractionCard value="15K+" label="Пользователей" />
            <TractionCard value="$12M" label="GMV (месячный)" />
            <TractionCard value="+35%" label="MoM рост" />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              📈 Прогноз роста (24 месяца)
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              <ProjectionCard
                period="Через 12 мес"
                partners="500"
                users="75K"
                mrr="$2.5M"
              />
              <ProjectionCard
                period="Через 18 мес"
                partners="1,200"
                users="180K"
                mrr="$7M"
                highlight
              />
              <ProjectionCard
                period="Через 24 мес"
                partners="2,500"
                users="400K"
                mrr="$15M"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Команда */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          👥 Команда
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <TeamCard
            name="Основатель & CEO"
            experience="8 лет в SaaS, ex-Яндекс"
            expertise="Product, Sales"
          />
          <TeamCard
            name="CTO"
            experience="10 лет в разработке, ex-Тинькофф"
            expertise="Architecture, ML"
          />
          <TeamCard
            name="CMO"
            experience="6 лет в маркетинге, ex-Сбер"
            expertise="Growth, Analytics"
          />
        </div>
      </div>

      {/* Использование средств */}
      <div className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            💵 Использование инвестиций ($3M)
          </h2>
          
          <div className="space-y-4">
            <UseOfFundsBar label="Маркетинг и продажи" percentage={50} amount="$1.5M" />
            <UseOfFundsBar label="Разработка продукта" percentage={30} amount="$900K" />
            <UseOfFundsBar label="Операционные расходы" percentage={15} amount="$450K" />
            <UseOfFundsBar label="Резерв" percentage={5} amount="$150K" />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            Присоединяйтесь к росту
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Станьте частью революции в программах лояльности для SMB
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button className="px-8 py-4 bg-white text-purple-900 rounded-xl font-bold text-lg hover:shadow-2xl transition-shadow">
              Скачать Pitch Deck
            </button>
            <button className="px-8 py-4 bg-purple-600 text-white rounded-xl font-bold text-lg border-2 border-white/30 hover:bg-purple-700 transition-colors">
              Связаться с нами
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные компоненты
const MetricRow = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-purple-100">{label}</span>
    <span className="text-xl font-bold">{value}</span>
  </div>
);

const ProblemCard = ({ text }) => (
  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
    <span className="text-red-500 text-xl">❌</span>
    <p className="text-gray-700 dark:text-gray-300">{text}</p>
  </div>
);

const SolutionItem = ({ text }) => (
  <li className="flex items-center gap-2">
    <span className="text-green-500">✅</span>
    <span className="text-gray-700 dark:text-gray-300">{text}</span>
  </li>
);

const MarketCard = ({ title, subtitle, value, description, highlight }) => (
  <div className={`rounded-2xl p-6 ${
    highlight
      ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
      : 'bg-gray-50 dark:bg-gray-700'
  }`}>
    <div className={`text-sm font-bold mb-1 ${highlight ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
      {subtitle}
    </div>
    <div className="text-3xl font-bold mb-1">{title}</div>
    <div className="text-4xl font-bold mb-3">{value}</div>
    <p className={`text-sm ${highlight ? 'text-purple-100' : 'text-gray-600 dark:text-gray-400'}`}>
      {description}
    </p>
  </div>
);

const TargetItem = ({ icon, text }) => (
  <div className="text-center">
    <div className="text-4xl mb-2">{icon}</div>
    <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">{text}</div>
  </div>
);

const RevenueItem = ({ model, description, share }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <div>
      <div className="font-bold text-gray-900 dark:text-white">{model}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{description}</div>
    </div>
    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{share}</div>
  </div>
);

const UnitEconItem = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center">
    <span className={highlight ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}>
      {label}
    </span>
    <span className={`text-xl font-bold ${highlight ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
      {value}
    </span>
  </div>
);

const TractionCard = ({ value, label }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
      {value}
    </div>
    <div className="text-gray-600 dark:text-gray-400">{label}</div>
  </div>
);

const ProjectionCard = ({ period, partners, users, mrr, highlight }) => (
  <div className={`rounded-xl p-6 ${
    highlight
      ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg scale-105'
      : 'bg-gray-50 dark:bg-gray-700'
  }`}>
    <div className={`text-lg font-bold mb-4 ${highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
      {period}
    </div>
    <div className="space-y-2">
      <div>
        <div className={`text-sm ${highlight ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
          Партнёры
        </div>
        <div className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {partners}
        </div>
      </div>
      <div>
        <div className={`text-sm ${highlight ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
          Пользователи
        </div>
        <div className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {users}
        </div>
      </div>
      <div>
        <div className={`text-sm ${highlight ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
          MRR
        </div>
        <div className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {mrr}
        </div>
      </div>
    </div>
  </div>
);

const TeamCard = ({ name, experience, expertise }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
    <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl text-white">
      👤
    </div>
    <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
      {name}
    </h3>
    <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-2">
      {experience}
    </p>
    <p className="text-purple-600 dark:text-purple-400 text-center text-sm font-medium">
      {expertise}
    </p>
  </div>
);

const UseOfFundsBar = ({ label, percentage, amount }) => (
  <div>
    <div className="flex justify-between mb-2">
      <span className="font-medium text-gray-900 dark:text-white">{label}</span>
      <span className="text-gray-600 dark:text-gray-400">{amount}</span>
    </div>
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
      <div
        className="bg-gradient-to-r from-purple-600 to-blue-600 h-4 rounded-full flex items-center justify-end pr-2"
        style={{ width: `${percentage}%` }}
      >
        <span className="text-white text-xs font-bold">{percentage}%</span>
      </div>
    </div>
  </div>
);

export default OnePagerInvestor;

