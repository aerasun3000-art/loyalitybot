import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useLanguageStore from '../store/languageStore';
import { hapticFeedback } from '../utils/telegram';

const DISTRICTS = [
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
];

const SERVICES = [
  { id: 'nail_care', emoji: '💅', name: 'Nail Care' },
  { id: 'brow_design', emoji: '👁️', name: 'Brow Design' },
  { id: 'hair_salon', emoji: '💇‍♀️', name: 'Hair Salon' },
  { id: 'hair_removal', emoji: '⚡', name: 'Hair Removal' },
  { id: 'facial_aesthetics', emoji: '✨', name: 'Facial Aesthetics' },
  { id: 'lash_services', emoji: '👀', name: 'Lash Services' },
  { id: 'massage_therapy', emoji: '💆‍♀️', name: 'Massage Therapy' },
  { id: 'makeup_pmu', emoji: '💄', name: 'Make-up & PMU' },
  { id: 'body_wellness', emoji: '🌸', name: 'Body Wellness' },
  { id: 'nutrition_coaching', emoji: '🍎', name: 'Nutrition Coaching' },
  { id: 'mindfulness_coaching', emoji: '🧠', name: 'Mindfulness & Coaching' },
  { id: 'image_consulting', emoji: '👗', name: 'Image Consulting' }
];

const translations = {
  en: {
    title: '🗺️ Availability Map',
    subtitle: 'Real-time availability of exclusive positions',
    loading: 'Loading availability data...',
    available: 'Available',
    taken: 'Taken',
    pending: 'Under Review',
    clickToApply: 'Click to apply for this position',
    positionAvailable: 'Position Available',
    positionTaken: 'Position Taken',
    positionPending: 'Under Review',
    filterByDistrict: 'Filter by District',
    filterByService: 'Filter by Service',
    showAll: 'Show All',
    stats: 'Statistics',
    totalPositions: 'Total Positions',
    availablePositions: 'Available',
    takenPositions: 'Taken',
    pendingPositions: 'Pending',
    applyNow: 'Apply Now',
    backToHome: 'Back to Home',
    noPositionsFound: 'No positions match your filters',
  },
  ru: {
    title: '🗺️ Карта Доступности',
    subtitle: 'Доступность эксклюзивных позиций в реальном времени',
    loading: 'Загрузка данных о доступности...',
    available: 'Свободно',
    taken: 'Занято',
    pending: 'На рассмотрении',
    clickToApply: 'Нажмите, чтобы подать заявку на эту позицию',
    positionAvailable: 'Позиция Свободна',
    positionTaken: 'Позиция Занята',
    positionPending: 'На Рассмотрении',
    filterByDistrict: 'Фильтр по Району',
    filterByService: 'Фильтр по Сфере',
    showAll: 'Показать Все',
    stats: 'Статистика',
    totalPositions: 'Всего Позиций',
    availablePositions: 'Свободно',
    takenPositions: 'Занято',
    pendingPositions: 'На рассмотрении',
    applyNow: 'Подать Заявку',
    backToHome: 'На главную',
    noPositionsFound: 'Нет позиций, соответствующих фильтрам',
  }
};

const AvailabilityMap = () => {
  const { language, toggleLanguage } = useLanguageStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(searchParams.get('district') || 'all');
  const [selectedService, setSelectedService] = useState(searchParams.get('service') || 'all');
  const [hoveredCell, setHoveredCell] = useState(null);

  const t = (key) => translations[language]?.[key] || translations.en[key] || key;

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      
      // Запрос к Supabase напрямую через REST API
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/partners?select=district,business_type,status,name&city=eq.New York&district=not.is.null&business_type=not.is.null`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }

      const partners = await response.json();
      
      // Формируем карту доступности
      const availMap = {};
      DISTRICTS.forEach(district => {
        availMap[district] = {};
        SERVICES.forEach(service => {
          const partner = partners.find(
            p => p.district === district && p.business_type === service.id
          );
          
          if (partner) {
            if (partner.status === 'Approved') {
              availMap[district][service.id] = {
                status: 'taken',
                partnerName: partner.name || ''
              };
            } else {
              availMap[district][service.id] = {
                status: 'pending',
                partnerName: partner.name || ''
              };
            }
          } else {
            availMap[district][service.id] = {
              status: 'available',
              partnerName: ''
            };
          }
        });
      });

      setAvailability(availMap);
    } catch (error) {
      console.error('Error fetching availability:', error);
      // В случае ошибки показываем все как available
      const availMap = {};
      DISTRICTS.forEach(district => {
        availMap[district] = {};
        SERVICES.forEach(service => {
          availMap[district][service.id] = {
            status: 'available',
            partnerName: ''
          };
        });
      });
      setAvailability(availMap);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'taken':
        return 'bg-red-200 border-red-400 hover:bg-red-300';
      case 'pending':
        return 'bg-yellow-200 border-yellow-400 hover:bg-yellow-300';
      case 'available':
        return 'bg-green-200 border-green-400 hover:bg-green-300';
      default:
        return 'bg-gray-200 border-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'taken':
        return '✗';
      case 'pending':
        return '⏳';
      case 'available':
        return '✓';
      default:
        return '';
    }
  };

  const handleCellClick = (district, service) => {
    const status = availability[district]?.[service.id]?.status;
    if (status === 'available') {
      hapticFeedback('light');
      navigate(`/partner/apply?district=${encodeURIComponent(district)}&service=${encodeURIComponent(service.id)}`);
    }
  };

  // Фильтрация данных
  const filteredDistricts = selectedDistrict === 'all' 
    ? DISTRICTS 
    : [selectedDistrict];
  
  const filteredServices = selectedService === 'all' 
    ? SERVICES 
    : SERVICES.filter(s => s.id === selectedService);

  // Статистика
  const stats = {
    total: DISTRICTS.length * SERVICES.length,
    available: 0,
    taken: 0,
    pending: 0
  };

  DISTRICTS.forEach(district => {
    SERVICES.forEach(service => {
      const status = availability[district]?.[service.id]?.status || 'available';
      if (status === 'available') stats.available++;
      else if (status === 'taken') stats.taken++;
      else if (status === 'pending') stats.pending++;
    });
  });

  const handleLanguageToggle = () => {
    hapticFeedback('light');
    toggleLanguage();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sakura-light via-white to-sakura-cream">
      {/* Переключатель языка */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleLanguageToggle}
          className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border-2 border-sakura-mid/30 hover:border-sakura-mid transition-colors"
        >
          <span className="text-xl">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
          <span className="font-bold text-sakura-dark">{language === 'ru' ? 'RU' : 'EN'}</span>
        </button>
      </div>

      {/* Заголовок */}
      <div className="bg-white py-12 border-b-2 border-sakura-mid/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-sakura-dark mb-4">
              {t('title')}
            </h1>
            <p className="text-xl text-gray-600">
              {t('subtitle')}
            </p>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-sakura-light to-sakura-cream rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-sakura-dark">{stats.total}</div>
              <div className="text-sm text-gray-600">{t('totalPositions')}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center border-2 border-green-300">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-sm text-gray-600">{t('availablePositions')}</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 text-center border-2 border-yellow-300">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">{t('pendingPositions')}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border-2 border-red-300">
              <div className="text-2xl font-bold text-red-600">{stats.taken}</div>
              <div className="text-sm text-gray-600">{t('takenPositions')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-sakura-dark">
                {t('filterByDistrict')}:
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="border-2 border-sakura-mid/30 rounded-lg px-3 py-2 text-sm focus:border-sakura-mid focus:outline-none"
              >
                <option value="all">{t('showAll')}</option>
                {DISTRICTS.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-sakura-dark">
                {t('filterByService')}:
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="border-2 border-sakura-mid/30 rounded-lg px-3 py-2 text-sm focus:border-sakura-mid focus:outline-none"
              >
                <option value="all">{t('showAll')}</option>
                {SERVICES.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.emoji} {service.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-sakura-dark"></div>
            <p className="mt-4 text-lg text-gray-600">{t('loading')}</p>
          </div>
        ) : filteredDistricts.length === 0 || filteredServices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">{t('noPositionsFound')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-6 overflow-x-auto">
            <div className="inline-block min-w-full">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="bg-gray-50 p-4 text-left font-bold text-sm text-sakura-dark border-b-2 sticky left-0 z-10">
                      {t('filterByDistrict')}
                    </th>
                    {filteredServices.map(service => (
                      <th
                        key={service.id}
                        className="bg-gray-50 p-3 text-center font-medium text-xs text-sakura-dark border-b-2 min-w-[80px]"
                        title={service.name}
                      >
                        <div className="text-2xl mb-1">{service.emoji}</div>
                        <div className="text-xs">{service.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDistricts.map(district => (
                    <tr key={district} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-sm text-sakura-dark border-b sticky left-0 bg-white z-10">
                        {district}
                      </td>
                      {filteredServices.map(service => {
                        const positionData = availability[district]?.[service.id];
                        const status = positionData?.status || 'available';
                        const partnerName = positionData?.partnerName || '';
                        const isClickable = status === 'available';
                        const isHovered = hoveredCell === `${district}_${service.id}`;

                        return (
                          <td
                            key={service.id}
                            className={`
                              p-2 border-b relative
                              ${getStatusColor(status)}
                              ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                              transition-all
                              ${isHovered && isClickable ? 'scale-110 z-20 shadow-lg' : ''}
                            `}
                            onClick={() => isClickable && handleCellClick(district, service)}
                            onMouseEnter={() => setHoveredCell(`${district}_${service.id}`)}
                            onMouseLeave={() => setHoveredCell(null)}
                            title={
                              isClickable 
                                ? t('clickToApply')
                                : `${district} - ${service.name}: ${status}${partnerName ? ` (${partnerName})` : ''}`
                            }
                          >
                            <div className="h-14 w-14 rounded-lg flex flex-col items-center justify-center mx-auto">
                              <span className="text-2xl mb-1">{getStatusIcon(status)}</span>
                              {isHovered && isClickable && (
                                <span className="text-xs font-bold text-green-700">
                                  {t('applyNow')}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Легенда */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-sakura-dark mb-4 text-center">
            {language === 'ru' ? 'Легенда' : 'Legend'}
          </h3>
          <div className="flex flex-wrap gap-6 justify-center text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-200 border-2 border-green-400 rounded-lg flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <div>
                <div className="font-bold">{t('available')}</div>
                <div className="text-xs text-gray-500">{t('positionAvailable')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-200 border-2 border-yellow-400 rounded-lg flex items-center justify-center">
                <span className="text-xl">⏳</span>
              </div>
              <div>
                <div className="font-bold">{t('pending')}</div>
                <div className="text-xs text-gray-500">{t('positionPending')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-200 border-2 border-red-400 rounded-lg flex items-center justify-center">
                <span className="text-xl">✗</span>
              </div>
              <div>
                <div className="font-bold">{t('taken')}</div>
                <div className="text-xs text-gray-500">{t('positionTaken')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопка назад */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/onepager/partner')}
            className="px-8 py-3 bg-gradient-to-r from-sakura-mid to-sakura-dark text-white rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityMap;











