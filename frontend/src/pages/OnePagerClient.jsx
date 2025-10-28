const OnePagerClient = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Герой-секция */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              🎁 Зарабатывайте Бонусы
              <br />
              <span className="text-blue-100">
                За Каждую Покупку!
              </span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Совершайте покупки у партнёров, копите баллы и обменивайте их на подарки и скидки
            </p>
            <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3">
              <span className="text-4xl">💎</span>
              <div className="text-left">
                <div className="text-sm text-blue-100">Кэшбэк до</div>
                <div className="text-3xl font-bold">5%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Как копить баллы */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          💰 Как накапливать баллы
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <HowToCard
            icon="🛍️"
            title="Делайте покупки"
            description="Совершайте покупки у наших партнёров и получайте до 5% кэшбэка баллами"
            highlight="5% кэшбэк"
          />
          <HowToCard
            icon="🎉"
            title="Участвуйте в акциях"
            description="Следите за специальными предложениями с повышенным кэшбэком до 10%"
            highlight="До 10% в акциях"
          />
          <HowToCard
            icon="👥"
            title="Приглашайте друзей"
            description="Получите 100 бонусных баллов за каждого приведённого друга"
            highlight="+100 баллов"
          />
        </div>
      </div>

      {/* Что можно получить */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            🎁 Что можно получить за баллы
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <RewardCard
              icon="☕"
              title="Бесплатный кофе"
              points="100"
            />
            <RewardCard
              icon="🍕"
              title="Скидка 20%"
              points="200"
            />
            <RewardCard
              icon="💇"
              title="Стрижка в подарок"
              points="500"
            />
            <RewardCard
              icon="🎫"
              title="Билет в кино"
              points="300"
            />
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              И многое другое! Список услуг постоянно пополняется
            </p>
          </div>
        </div>
      </div>

      {/* Партнёры */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          🤝 Наши партнёры
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {['Кофейни', 'Рестораны', 'Салоны красоты', 'Фитнес-клубы', 'Магазины', 'Кинотеатры', 'Автосервисы', 'Аптеки'].map((category) => (
            <div key={category} className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">
                {category === 'Кофейни' && '☕'}
                {category === 'Рестораны' && '🍽️'}
                {category === 'Салоны красоты' && '💅'}
                {category === 'Фитнес-клубы' && '💪'}
                {category === 'Магазины' && '🛒'}
                {category === 'Кинотеатры' && '🎬'}
                {category === 'Автосервисы' && '🚗'}
                {category === 'Аптеки' && '💊'}
              </div>
              <div className="font-medium text-gray-900 dark:text-white">
                {category}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            ❓ Частые вопросы
          </h2>
          
          <div className="space-y-6">
            <FAQItem
              question="Как начать копить баллы?"
              answer="Просто начните делать покупки у наших партнёров и сообщите им свой номер телефона или Chat ID из бота. Баллы начислятся автоматически!"
            />
            <FAQItem
              question="Сгорают ли баллы?"
              answer="Нет! Ваши баллы не имеют срока действия и остаются с вами навсегда. Копите и тратьте в удобное время."
            />
            <FAQItem
              question="Как потратить баллы?"
              answer="Выберите услугу в разделе 'Услуги' нашего бота, нажмите 'Обменять' и покажите подтверждение партнёру."
            />
            <FAQItem
              question="Можно ли передать баллы другу?"
              answer="Нет, баллы привязаны к вашему аккаунту и не могут быть переданы другим пользователям."
            />
            <FAQItem
              question="Что делать если баллы не начислились?"
              answer="Свяжитесь с партнёром или напишите в поддержку через бота. Мы обязательно поможем разобраться!"
            />
          </div>
        </div>
      </div>

      {/* Преимущества */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          ⭐ Почему это удобно
        </h2>
        
        <div className="grid md:grid-cols-4 gap-6">
          <FeatureCard
            icon="📱"
            title="Всё в боте"
            description="Управляйте баллами прямо в Telegram"
          />
          <FeatureCard
            icon="⚡"
            title="Мгновенно"
            description="Баллы начисляются сразу после покупки"
          />
          <FeatureCard
            icon="🔒"
            title="Безопасно"
            description="Ваши данные надёжно защищены"
          />
          <FeatureCard
            icon="🎯"
            title="Просто"
            description="Никаких сложных правил и условий"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Начните копить баллы прямо сейчас!
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Откройте бота и получите приветственные 100 баллов в подарок 🎁
          </p>
          <button className="px-12 py-4 bg-white text-blue-600 rounded-xl font-bold text-xl hover:shadow-2xl transition-shadow">
            Открыть бота →
          </button>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные компоненты
const HowToCard = ({ icon, title, description, highlight }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-400 mb-3">
      {description}
    </p>
    <div className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-bold">
      {highlight}
    </div>
  </div>
);

const RewardCard = ({ icon, title, points }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
    <div className="text-5xl mb-3">{icon}</div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
      {points} баллов
    </div>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="text-center">
    <div className="text-5xl mb-3">{icon}</div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-400 text-sm">
      {description}
    </p>
  </div>
);

const FAQItem = ({ question, answer }) => (
  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
      {question}
    </h3>
    <p className="text-gray-600 dark:text-gray-400">
      {answer}
    </p>
  </div>
);

export default OnePagerClient;

