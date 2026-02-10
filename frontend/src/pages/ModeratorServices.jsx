import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getChatId } from '../utils/telegram';
import { isModerator, getAllServicesForModerator } from '../services/supabase';
import Loader from '../components/Loader';

const ModeratorServices = () => {
  const [loading, setLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [services, setServices] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const chatId = getChatId();
      if (!chatId) {
        if (!cancelled) {
          setAccessAllowed(false);
          setLoading(false);
        }
        return;
      }

      try {
        const allowed = await isModerator(chatId);
        if (cancelled) return;
        setAccessAllowed(!!allowed);

        if (allowed) {
          const data = await getAllServicesForModerator();
          if (!cancelled) setServices(data || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Ошибка загрузки');
          setAccessAllowed(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader />
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-sakura-cream">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Нет доступа</h1>
          <p className="text-gray-600 mb-4">
            Эта страница доступна только модераторам приложения.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            На главную
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: 'var(--tg-theme-bg-color, #f9fafb)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Все услуги партнёров</h1>
        <p className="text-gray-600 mb-6">
          Модераторский просмотр: все услуги всех партнёров без учёта пригласившего.
        </p>

        <div className="bg-sakura-surface rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-sakura-cream">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Партнёр</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Услуга</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Активна</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Баллы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Нет услуг
                    </td>
                  </tr>
                ) : (
                  services.map((s) => (
                    <tr key={s.id} className="hover:bg-sakura-cream">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {s.partner
                          ? [s.partner.company_name || s.partner.name, s.partner.city].filter(Boolean).join(', ') || s.partner_chat_id
                          : s.partner_chat_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{s.title || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{s.category || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            s.approval_status === 'Approved'
                              ? 'bg-green-100 text-green-800'
                              : s.approval_status === 'Rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {s.approval_status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {s.is_active ? 'Да' : 'Нет'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{s.price_points ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Всего: {services.length} услуг
        </p>
      </div>
    </div>
  );
};

export default ModeratorServices;
