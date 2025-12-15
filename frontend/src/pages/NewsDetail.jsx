import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNewsById, incrementNewsViews } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation, translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
// import LuxuryIcon from '../components/LuxuryIcons'
import Loader from '../components/Loader'

const NewsDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const [news, setNews] = useState(null)
  const [translatedNews, setTranslatedNews] = useState(null)
  const [loading, setLoading] = useState(true)
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    loadNewsDetail()
  }, [id])

  // Автоматический перевод новости при изменении языка
  useEffect(() => {
    if (!news || language === 'ru') {
      setTranslatedNews(news)
      return
    }

    // Проверяем, доступен ли API для переводов
    const checkApiAndTranslate = async () => {
      // Если в БД уже есть предзаполненные английские поля, используем их без обращения к API
      if (language === 'en' && (news.title_en || news.preview_text_en || news.content_en)) {
        const mapped = {
          ...news,
          title: news.title_en || news.title,
          preview_text: news.preview_text_en || news.preview_text,
          content: news.content_en || news.content
        }
        setTranslatedNews(mapped)
        return
      }

      // Если API URL не установлен, используем оригинальный текст
      const apiUrl = import.meta.env.VITE_API_URL
      if (!apiUrl) {
        console.warn('⚠️ VITE_API_URL не установлен. Переводы отключены. Показываем оригинальный текст.')
        setTranslatedNews(news)
        return
      }

      setTranslating(true)
      try {
        const translated = {
          ...news,
          title: await translateDynamicContent(news.title, language, 'ru'),
          preview_text: news.preview_text
            ? await translateDynamicContent(news.preview_text, language, 'ru')
            : null,
          content: await translateDynamicContent(news.content, language, 'ru'),
        }
        setTranslatedNews(translated)
      } catch (error) {
        console.error('Error translating news:', error)
        setTranslatedNews(news) // Fallback на оригинал при ошибке
      } finally {
        setTranslating(false)
      }
    }

    checkApiAndTranslate()
  }, [news, language])

  const loadNewsDetail = async () => {
    try {
      setLoading(true)
      const newsData = await getNewsById(parseInt(id))
      
      if (!newsData) {
        // Новость не найдена
        navigate('/news')
        return
      }
      
      setNews(newsData)
      
      // Увеличиваем счетчик просмотров
      await incrementNewsViews(parseInt(id))
    } catch (error) {
      console.error('Error loading news detail:', error)
      navigate('/news')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    const locale = language === 'ru' ? 'ru-RU' : 'en-US'
    return date.toLocaleDateString(locale, options)
  }

  const handleBack = () => {
    hapticFeedback('light')
    navigate('/news')
  }

  const handleShare = () => {
    hapticFeedback('medium')
    // Можно добавить функцию шаринга через Telegram
    if (window.Telegram?.WebApp) {
      const message = language === 'ru' 
        ? 'Функция "Поделиться" скоро будет доступна!' 
        : 'Share feature coming soon!'
      window.Telegram.WebApp.showAlert(message)
    }
  }

  if (loading) {
    return <Loader />
  }

  // Используем переведенную новость, если доступна
  const displayNews = translatedNews || news

  if (!displayNews) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl leading-none mx-auto mb-4 text-jewelry-gray-elegant">⚠️</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {language === 'ru' ? 'Новость не найдена' : 'News not found'}
          </h2>
          <button
            onClick={handleBack}
            className="text-pink-500 font-semibold"
          >
            ← {t('news_back_to_news')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Шапка с кнопками */}
      <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-gray-100">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 text-gray-700"
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
        
        <span className="font-semibold text-gray-800">
          {t('news_title')}
        </span>
        
        <button
          onClick={handleShare}
          className="p-2 -mr-2 text-gray-700"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
        </button>
      </div>

      {/* Изображение */}
      {displayNews.image_url && (
        <div className="relative">
          <img
            src={displayNews.image_url}
            alt={displayNews.title}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      {/* Контент */}
      <div className="px-4 py-6">
        {/* Заголовок */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
          {displayNews.title}
        </h1>

        {/* Мета-информация */}
        <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M8 4v4l3 2" />
            </svg>
            <span>{formatDate(displayNews.created_at)}</span>
          </div>
          
          {displayNews.views_count > 0 && (
            <div className="flex items-center gap-1">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
                <circle cx="8" cy="8" r="2" />
              </svg>
              <span>{displayNews.views_count} {t('news_views')}</span>
            </div>
          )}
        </div>

        {/* Основной текст */}
        <div className="prose prose-pink max-w-none">
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
            {displayNews.content}
          </div>
        </div>

        {/* Разделитель */}
        <div className="my-8 border-t border-gray-200"></div>

        {/* Дополнительная информация */}
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-6 border border-pink-100">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg leading-none">ℹ️</span>
            {language === 'ru' ? 'Информация' : 'Information'}
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>{t('news_published')}:</span>
              <span className="font-semibold text-gray-800">
                {formatDate(displayNews.created_at)}
              </span>
            </div>
            {displayNews.updated_at && displayNews.updated_at !== displayNews.created_at && (
              <div className="flex justify-between">
                <span>{language === 'ru' ? 'Обновлено' : 'Updated'}:</span>
                <span className="font-semibold text-gray-800">
                  {formatDate(displayNews.updated_at)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t('news_views')}:</span>
              <span className="font-semibold text-gray-800">
                {displayNews.views_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Кнопка "Назад к новостям" */}
        <button
          onClick={handleBack}
          className="w-full mt-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform duration-200"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 10H5M10 15l-5-5 5-5" />
          </svg>
          {t('news_back_to_news')}
        </button>
      </div>

      {/* Стили для prose */}
      <style>{`
        .prose {
          max-width: none;
        }
        .prose p {
          margin-bottom: 1em;
        }
        .prose h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          color: #1f2937;
        }
        .prose h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 1.25em;
          margin-bottom: 0.5em;
          color: #1f2937;
        }
        .prose ul, .prose ol {
          padding-left: 1.5em;
          margin-bottom: 1em;
        }
        .prose li {
          margin-bottom: 0.5em;
        }
        .prose strong {
          font-weight: 600;
          color: #111827;
        }
        .prose a {
          color: #ec4899;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default NewsDetail

