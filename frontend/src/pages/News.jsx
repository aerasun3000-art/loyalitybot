import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPublishedNews } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import Loader from '../components/Loader'

const News = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState('ru')

  useEffect(() => {
    loadNews()
    
    // Если есть параметр id, переходим к детальной странице
    const newsId = searchParams.get('id')
    if (newsId) {
      navigate(`/news/${newsId}`)
    }
  }, [searchParams])

  const loadNews = async () => {
    try {
      setLoading(true)
      const newsData = await getPublishedNews()
      setNews(newsData)
    } catch (error) {
      console.error('Error loading news:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewsClick = (newsId) => {
    hapticFeedback('light')
    navigate(`/news/${newsId}`)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const options = { year: 'numeric', month: 'long', day: 'numeric' }
    return date.toLocaleDateString('ru-RU', options)
  }

  if (loading) {
    return <Loader />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-500 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/')}
            className="text-white p-2 -ml-2"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white flex-1 text-center">
            {language === 'ru' ? '📰 Новости' : '📰 News'}
          </h1>
          <div className="w-8"></div>
        </div>
        <p className="text-white/90 text-center text-sm">
          {language === 'ru' 
            ? 'Последние новости и обновления' 
            : 'Latest news and updates'}
        </p>
      </div>

      {/* Список новостей */}
      <div className="px-4 -mt-4">
        {news.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center card-shadow">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {language === 'ru' ? 'Пока нет новостей' : 'No news yet'}
            </h3>
            <p className="text-gray-600">
              {language === 'ru'
                ? 'Следите за обновлениями - скоро здесь появятся новости!'
                : 'Stay tuned - news will appear here soon!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item, index) => {
              // Градиенты для карточек
              const gradients = [
                'from-pink-400 to-rose-400',
                'from-purple-400 to-pink-400',
                'from-rose-400 to-pink-500',
                'from-pink-300 to-purple-400',
                'from-fuchsia-400 to-pink-400'
              ]
              const gradient = gradients[index % gradients.length]
              
              // Иконки для новостей
              const newsIcons = ['📢', '✨', '🎉', '🎁', '🌟', '💝', '🔥', '⭐']
              const newsIcon = newsIcons[index % newsIcons.length]

              return (
                <div
                  key={item.id}
                  onClick={() => handleNewsClick(item.id)}
                  className="bg-white rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 cursor-pointer active:scale-98"
                >
                  {/* Изображение */}
                    {item.image_url ? (
                      <div className="h-48 relative overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      
                      {/* Дата поверх изображения */}
                      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-xs font-semibold text-gray-700">
                          📅 {formatDate(item.created_at)}
                        </span>
                      </div>
                      
                      {/* Просмотры */}
                      {item.views_count > 0 && (
                        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                          <span className="text-xs font-semibold text-white">
                            👁 {item.views_count}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`h-48 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <span className="text-9xl opacity-20 absolute">{newsIcon}</span>
                      <span className="text-7xl relative z-10 drop-shadow-lg">{newsIcon}</span>
                      
                      {/* Дата */}
                      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-xs font-semibold text-gray-700">
                          📅 {formatDate(item.created_at)}
                        </span>
                      </div>
                      
                      {/* Просмотры */}
                      {item.views_count > 0 && (
                        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                          <span className="text-xs font-semibold text-white">
                            👁 {item.views_count}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Контент */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2">
                      {item.title}
                    </h3>
                    
                    {item.preview_text && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                        {item.preview_text}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatDate(item.created_at)}
                      </span>
                      <button className="text-pink-500 font-semibold text-sm flex items-center gap-1">
                        {language === 'ru' ? 'Читать далее' : 'Read more'}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 12l4-4-4-4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Стили */}
      <style>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .active\\:scale-98:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}

export default News

