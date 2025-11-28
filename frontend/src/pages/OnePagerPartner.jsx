import { useState, useEffect } from 'react';

const OnePagerPartner = () => {
  const [earlyBirdCount, setEarlyBirdCount] = useState(null);
  const [remainingSlots, setRemainingSlots] = useState(null);

  useEffect(() => {
    // Здесь можно добавить API вызов для получения актуального количества
    // Пока используем заглушку
    setEarlyBirdCount(0);
    setRemainingSlots(20);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sakura-light via-white to-sakura-cream">
      {/* Герой-секция с ранним предложением */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sakura-mid to-sakura-dark opacity-10"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="text-center">
            {/* Бейдж раннего предложения */}
            <div className="inline-block mb-6 px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full font-bold text-lg animate-pulse">
              🎁 LIMITED TIME: Early Bird Offer for New York
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-sakura-dark mb-6">
              🗽 Exclusive Partner Program
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sakura-mid to-sakura-dark">
                New York Only
              </span>
            </h1>
            
            <p className="text-2xl text-sakura-dark/80 mb-8 max-w-3xl mx-auto">
              Become the <strong>exclusive</strong> partner for your service type in your district.
              <br />
              <span className="text-xl text-sakura-mid">No competition. Maximum revenue. Full control.</span>
            </p>

            {/* Цены */}
            <div className="flex gap-6 justify-center flex-wrap mb-8">
              <div className="bg-white rounded-2xl p-8 shadow-2xl border-4 border-red-400 transform scale-105">
                <div className="text-sm text-red-600 font-bold mb-2">FIRST 20 PARTNERS</div>
                <div className="text-6xl font-bold text-sakura-dark mb-2">$29</div>
                <div className="text-xl text-gray-600 mb-4">per year</div>
                <div className="text-sm text-gray-500 line-through mb-2">Regular: $99/year</div>
                <div className="text-green-600 font-bold">Save $70! 🎉</div>
              </div>
              
              <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-gray-300">
                <div className="text-sm text-gray-600 font-bold mb-2">AFTER 20 PARTNERS</div>
                <div className="text-6xl font-bold text-sakura-dark mb-2">$99</div>
                <div className="text-xl text-gray-600 mb-4">per year</div>
                <div className="text-sm text-gray-500">Standard pricing</div>
              </div>
            </div>

            {/* Счетчик оставшихся мест */}
            {remainingSlots !== null && remainingSlots > 0 && (
              <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-4 mb-8 inline-block">
                <div className="text-2xl font-bold text-yellow-800">
                  ⏰ Only {remainingSlots} Early Bird slots remaining!
                </div>
                <div className="text-lg text-yellow-700 mt-2">
                  {earlyBirdCount || 0} partners already joined
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center flex-wrap">
              <a 
                href="/partner/apply" 
                className="px-10 py-5 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl font-bold text-xl hover:shadow-2xl transition-all transform hover:scale-105"
              >
                🚀 Claim Your Spot Now
              </a>
              <a 
                href="#how-it-works" 
                className="px-10 py-5 bg-white text-sakura-dark rounded-xl font-bold text-xl border-2 border-sakura-mid hover:bg-sakura-light transition-colors"
              >
                Learn More ↓
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Что такое эксклюзивность */}
      <div className="bg-white py-16" id="exclusivity">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-sakura-dark mb-4">
            👑 What is Exclusive Partnership?
          </h2>
          <p className="text-xl text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            In each of New York's 10 districts, for each of 12 service types, there can be <strong>only ONE partner</strong>.
            <br />
            <span className="text-lg text-sakura-mid">You become the monopoly in your niche and territory.</span>
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <ExclusivityCard
              icon="🎯"
              title="Territory Protection"
              description="No other partner can offer the same service type in your district. You own the market."
            />
            <ExclusivityCard
              icon="💰"
              title="Maximum Revenue"
              description="All customers looking for your service in your district will find only you. No competition means higher prices and more clients."
            />
            <ExclusivityCard
              icon="📈"
              title="Revenue Share"
              description="Earn from partners you refer. Build your network and get passive income from their success."
            />
            <ExclusivityCard
              icon="🏆"
              title="Master Partner Status"
              description="Become a Master Partner in your district and coordinate the development of your territory."
            />
          </div>

          {/* 10 районов */}
          <div className="bg-gradient-to-r from-sakura-light to-sakura-cream rounded-2xl p-8 mb-8">
            <h3 className="text-3xl font-bold text-center text-sakura-dark mb-6">
              🗺️ 10 Districts of New York
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                'Manhattan Downtown',
                'Manhattan Midtown',
                'Manhattan Upper East',
                'Manhattan Upper West',
                'Brooklyn Downtown',
                'Brooklyn North',
                'Brooklyn South + S.I.',
                'Queens West + Bronx South',
                'Queens East',
                'Brooklyn Central'
              ].map((district, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 text-center shadow-sm">
                  <div className="text-sm font-bold text-sakura-dark">{district}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 12 видов услуг */}
          <div className="bg-gradient-to-r from-sakura-cream to-sakura-light rounded-2xl p-8">
            <h3 className="text-3xl font-bold text-center text-sakura-dark mb-6">
              💅 12 Service Types Available
            </h3>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { emoji: '💅', name: 'Nail Care' },
                { emoji: '👁️', name: 'Brow Design' },
                { emoji: '💇‍♀️', name: 'Hair Salon' },
                { emoji: '⚡', name: 'Hair Removal' },
                { emoji: '✨', name: 'Facial Aesthetics' },
                { emoji: '👀', name: 'Lash Services' },
                { emoji: '💆‍♀️', name: 'Massage Therapy' },
                { emoji: '💄', name: 'Make-up & PMU' },
                { emoji: '🌸', name: 'Body Wellness' },
                { emoji: '🍎', name: 'Nutrition Coaching' },
                { emoji: '🧠', name: 'Mindfulness & Coaching' },
                { emoji: '👗', name: 'Image Consulting' }
              ].map((service, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-2">{service.emoji}</div>
                  <div className="text-sm font-medium text-sakura-dark">{service.name}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-gray-600 mt-6">
              <strong>120 total exclusive positions</strong> (10 districts × 12 services)
              <br />
              <span className="text-sakura-mid">Each position can have only ONE partner</span>
            </p>
          </div>
        </div>
      </div>

      {/* Как это работает */}
      <div className="bg-gradient-to-br from-sakura-light to-white py-16" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-sakura-dark mb-12">
            🔄 How It Works
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title="Choose Your Spot"
              description="Select your district and service type. If available, it's yours exclusively."
            />
            <StepCard
              number="2"
              title="Early Bird Pricing"
              description="First 20 partners pay only $29/year. After that, it's $99/year."
            />
            <StepCard
              number="3"
              title="Get Exclusive Rights"
              description="You become the only partner for your service in your district. No competition."
            />
            <StepCard
              number="4"
              title="Grow Your Business"
              description="Build your client base, earn revenue share, and become a Master Partner."
            />
          </div>
        </div>
      </div>

      {/* Преимущества */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-sakura-dark mb-12">
            ✨ Why Join Now?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <BenefitCard
              icon="🎁"
              title="Early Bird Discount"
              description="Save $70 per year if you're among the first 20 partners. Limited time offer!"
            />
            <BenefitCard
              icon="👑"
              title="Exclusive Territory"
              description="No competition in your district for your service type. You own the market."
            />
            <BenefitCard
              icon="📊"
              title="Full Analytics Dashboard"
              description="Track your revenue, clients, and performance in real-time."
            />
            <BenefitCard
              icon="🤝"
              title="Revenue Share Program"
              description="Earn passive income from partners you refer. Build your network."
            />
            <BenefitCard
              icon="💬"
              title="Telegram Bot Integration"
              description="Manage your loyalty program directly from Telegram. Easy and convenient."
            />
            <BenefitCard
              icon="🚀"
              title="Fast Setup"
              description="Get started in 15 minutes. No complex integrations needed."
            />
          </div>
        </div>
      </div>

      {/* Цены детально */}
      <div className="bg-gradient-to-r from-sakura-mid/10 to-sakura-dark/10 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-sakura-dark mb-12">
            💎 Pricing Details
          </h2>
          
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="border-r border-gray-200 pr-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🎁</span>
                  <h3 className="text-2xl font-bold text-sakura-dark">Early Bird</h3>
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">LIMITED</span>
                </div>
                <div className="text-5xl font-bold text-sakura-dark mb-2">$29</div>
                <div className="text-lg text-gray-600 mb-6">per year</div>
                <ul className="space-y-3">
                  <ConditionItem text="Exclusive territory rights" />
                  <ConditionItem text="Full platform access" />
                  <ConditionItem text="Revenue share program" />
                  <ConditionItem text="Analytics dashboard" />
                  <ConditionItem text="Telegram bot integration" />
                  <ConditionItem text="24/7 support" />
                </ul>
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-sm font-bold text-yellow-800">
                    ⏰ Only for first 20 partners in New York
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">💎</span>
                  <h3 className="text-2xl font-bold text-sakura-dark">Premium</h3>
                </div>
                <div className="text-5xl font-bold text-sakura-dark mb-2">$99</div>
                <div className="text-lg text-gray-600 mb-6">per year</div>
                <ul className="space-y-3">
                  <ConditionItem text="Exclusive territory rights" />
                  <ConditionItem text="Full platform access" />
                  <ConditionItem text="Revenue share program" />
                  <ConditionItem text="Analytics dashboard" />
                  <ConditionItem text="Telegram bot integration" />
                  <ConditionItem text="24/7 support" />
                </ul>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">
                    Standard pricing after Early Bird slots are filled
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-lg font-bold text-sakura-dark mb-2">
                  ✅ All features included in both plans
                </div>
                <div className="text-gray-600">
                  The only difference is the price. Early Bird saves you $70 per year!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA финальный */}
      <div className="bg-gradient-to-r from-sakura-mid to-sakura-dark py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Ready to Claim Your Exclusive Territory?
          </h2>
          <p className="text-2xl text-white/90 mb-8">
            Join the first 20 partners and save $70 per year
            <br />
            <span className="text-xl">Become the exclusive partner in your district</span>
          </p>
          
          {remainingSlots !== null && remainingSlots > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-8 inline-block">
              <div className="text-3xl font-bold text-white mb-2">
                ⏰ {remainingSlots} Early Bird slots left!
              </div>
              <div className="text-lg text-white/90">
                Don't miss your chance to save $70/year
              </div>
            </div>
          )}
          
          <a 
            href="/partner/apply" 
            className="inline-block px-12 py-6 bg-white text-sakura-dark rounded-xl font-bold text-2xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
            🚀 Apply Now - Claim Your Spot
          </a>
          
          <div className="mt-8 text-white/80 text-lg">
            ✅ No hidden fees • ✅ Cancel anytime • ✅ Full refund if not approved
          </div>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные компоненты
const BenefitCard = ({ icon, title, description }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow border border-sakura-light">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-sakura-dark mb-2">
      {title}
    </h3>
    <p className="text-gray-600">
      {description}
    </p>
  </div>
);

const StepCard = ({ number, title, description }) => (
  <div className="text-center">
    <div className="w-20 h-20 bg-gradient-to-r from-sakura-mid to-sakura-dark rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
      {number}
    </div>
    <h3 className="text-xl font-bold text-sakura-dark mb-2">
      {title}
    </h3>
    <p className="text-gray-600">
      {description}
    </p>
  </div>
);

const ExclusivityCard = ({ icon, title, description }) => (
  <div className="bg-gradient-to-br from-sakura-light to-white rounded-xl p-6 shadow-sm border border-sakura-mid/20">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="text-xl font-bold text-sakura-dark mb-2">
      {title}
    </h3>
    <p className="text-gray-600">
      {description}
    </p>
  </div>
);

const ConditionItem = ({ text }) => (
  <li className="flex items-center gap-2 text-gray-700">
    <span className="text-green-500 text-xl">✅</span>
    <span>{text}</span>
  </li>
);

export default OnePagerPartner;
