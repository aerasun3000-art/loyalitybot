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
        return 'bg-sakura-accent/10 border-sakura-accent hover:bg-sakura-accent/20';
      case 'pending':
        return 'bg-sakura-gold/10 border-sakura-gold hover:bg-sakura-gold/20';
      case 'available':
        return 'bg-sakura-mid/10 border-sakura-mid hover:bg-sakura-mid/20';
      default:
        return 'bg-sakura-cream border-sakura-border';
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, var(--tg-theme-bg-color, #f9fafb), var(--tg-theme-secondary-bg-color, #f3f4f6))' }}>
      {/* Переключатель языка */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleLanguageToggle}
          className="flex items-center gap-2 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--tg-theme-bg-color, #fff) 90%, transparent)',
            border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)'
          }}
        >
          <span className="text-xl">{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
          <span className="font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>{language === 'ru' ? 'RU' : 'EN'}</span>
        </button>
      </div>

      {/* Заголовок */}
      <div className="py-12" style={{ backgroundColor: 'var(--tg-theme-bg-color, #fff)', borderBottom: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: 'var(--tg-theme-text-color)' }}>
              {t('title')}
            </h1>
            <p className="text-xl" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {t('subtitle')}
            </p>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="rounded-xl p-4 text-center" style={{ background: 'linear-gradient(135deg, var(--tg-theme-secondary-bg-color), color-mix(in srgb, var(--tg-theme-button-color) 10%, transparent))' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>{stats.total}</div>
              <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('totalPositions')}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center border-2 border-green-300">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('availablePositions')}</div>
            </div>
            <div className="bg-sakura-cream rounded-xl p-4 text-center border-2 border-sakura-gold">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('pendingPositions')}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border-2 border-red-300">
              <div className="text-2xl font-bold text-red-600">{stats.taken}</div>
              <div className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('takenPositions')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="sticky top-0 z-40 shadow-sm" style={{ backgroundColor: 'var(--tg-theme-bg-color, #fff)', borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: 'var(--tg-theme-text-color)' }}>
                {t('filterByDistrict')}:
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{
                  border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)',
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  color: 'var(--tg-theme-text-color)'
                }}
              >
                <option value="all">{t('showAll')}</option>
                {DISTRICTS.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: 'var(--tg-theme-text-color)' }}>
                {t('filterByService')}:
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{
                  border: '2px solid color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)',
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  color: 'var(--tg-theme-text-color)'
                }}
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
            <div className="inline-block animate-spin rounded-full h-16 w-16" style={{ borderBottom: '2px solid var(--tg-theme-button-color)' }}></div>
            <p className="mt-4 text-lg" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('loading')}</p>
          </div>
        ) : filteredDistricts.length === 0 || filteredServices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('noPositionsFound')}</p>
          </div>
        ) : (
          <div className="rounded-2xl shadow-xl p-6 overflow-x-auto" style={{ backgroundColor: 'var(--tg-theme-bg-color, #fff)' }}>
            <div className="inline-block min-w-full">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="bg-sakura-cream p-4 text-left font-bold text-sm border-b-2 sticky left-0 z-10" style={{ color: 'var(--tg-theme-text-color)' }}>
                      {t('filterByDistrict')}
                    </th>
                    {filteredServices.map(service => (
                      <th
                        key={service.id}
                        className="bg-sakura-cream p-3 text-center font-medium text-xs border-b-2 min-w-[80px]"
                        title={service.name}
                        style={{ color: 'var(--tg-theme-text-color)' }}
                      >
                        <div className="text-2xl mb-1">{service.emoji}</div>
                        <div className="text-xs">{service.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDistricts.map(district => (
                    <tr key={district} className="hover:bg-sakura-cream/40 transition-colors">
                      <td className="p-4 font-bold text-sm border-b sticky left-0 z-10" style={{ color: 'var(--tg-theme-text-color)', backgroundColor: 'var(--tg-theme-bg-color, #fff)' }}>
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
        <div className="mt-8 rounded-xl p-6 shadow-lg" style={{ backgroundColor: 'var(--tg-theme-bg-color, #fff)' }}>
          <h3 className="text-xl font-bold mb-4 text-center" style={{ color: 'var(--tg-theme-text-color)' }}>
            {language === 'ru' ? 'Легенда' : 'Legend'}
          </h3>
          <div className="flex flex-wrap gap-6 justify-center text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sakura-mid/10 border-2 border-sakura-mid rounded-lg flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <div>
                <div className="font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>{t('available')}</div>
                <div className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('positionAvailable')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sakura-gold/10 border-2 border-sakura-gold rounded-lg flex items-center justify-center">
                <span className="text-xl">⏳</span>
              </div>
              <div>
                <div className="font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>{t('pending')}</div>
                <div className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('positionPending')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sakura-accent/10 border-2 border-sakura-accent rounded-lg flex items-center justify-center">
                <span className="text-xl">✗</span>
              </div>
              <div>
                <div className="font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>{t('taken')}</div>
                <div className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>{t('positionTaken')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Кнопка назад */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/onepager/partner')}
            className="px-8 py-3 rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
            style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }}
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityMap;
