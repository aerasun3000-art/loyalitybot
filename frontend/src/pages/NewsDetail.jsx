import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNewsById, incrementNewsViews } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation, translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
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

    const checkApiAndTranslate = async () => {
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
        setTranslatedNews(news)
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
        navigate('/news')
        return
      }

      setNews(newsData)
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
    if (window.Telegram?.WebApp) {
      const message = language === 'ru'
        ? 'Функция "Поделиться" скоро будет доступна!'
        : 'Share feature coming soon!'
      window.Telegram.WebApp.showAlert(message)
    }
  }

  if (loading || translating) {
    return <Loader />
  }

  const displayNews = translatedNews || news

  if (!displayNews) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
        <div className="text-center">
          <span className="text-6xl leading-none mx-auto mb-4">⚠️</span>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
            {language === 'ru' ? 'Новость не найдена' : 'News not found'}
          </h2>
          <button onClick={handleBack} className="font-semibold"
            style={{ color: 'var(--tg-theme-button-color)' }}>
            ← {t('news_back_to_news')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
      {/* Шапка с кнопками */}
      <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: 'var(--tg-theme-bg-color)', borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}>
        <button onClick={handleBack} className="p-2 -ml-2" style={{ color: 'var(--tg-theme-text-color)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
          {t('news_title')}
        </span>
        <button onClick={handleShare} className="p-2 -mr-2" style={{ color: 'var(--tg-theme-text-color)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <img src={displayNews.image_url} alt={displayNews.title} className="w-full h-64 object-cover" />
        </div>
      )}

      {/* Контент */}
      <div className="px-4 py-6">
        <h1 className="text-3xl font-bold mb-4 leading-tight" style={{ color: 'var(--tg-theme-text-color)' }}>
          {displayNews.title}
        </h1>

        <div className="flex items-center gap-4 mb-6 text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
          <div className="flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="7" />
              <path d="M8 4v4l3 2" />
            </svg>
            <span>{formatDate(displayNews.created_at)}</span>
          </div>
          {displayNews.views_count > 0 && (
            <div className="flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
                <circle cx="8" cy="8" r="2" />
              </svg>
              <span>{displayNews.views_count} {t('news_views')}</span>
            </div>
          )}
        </div>

        <div className="leading-relaxed whitespace-pre-wrap text-base" style={{ color: 'var(--tg-theme-text-color)' }}>
          {displayNews.content}
        </div>

        <div className="my-8" style={{ borderTop: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' }}></div>

        {/* Дополнительная информация */}
        <div className="rounded-2xl p-6"
          style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
          <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--tg-theme-text-color)' }}>
            <span className="text-lg leading-none">ℹ️</span>
            {language === 'ru' ? 'Информация' : 'Information'}
          </h3>
          <div className="space-y-2 text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
            <div className="flex justify-between">
              <span>{t('news_published')}:</span>
              <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
                {formatDate(displayNews.created_at)}
              </span>
            </div>
            {displayNews.updated_at && displayNews.updated_at !== displayNews.created_at && (
              <div className="flex justify-between">
                <span>{language === 'ru' ? 'Обновлено' : 'Updated'}:</span>
                <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
                  {formatDate(displayNews.updated_at)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t('news_views')}:</span>
              <span className="font-semibold" style={{ color: 'var(--tg-theme-text-color)' }}>
                {displayNews.views_count || 0}
              </span>
            </div>
          </div>
        </div>

        <button onClick={handleBack}
          className="w-full mt-6 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95"
          style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10H5M10 15l-5-5 5-5" />
          </svg>
          {t('news_back_to_news')}
        </button>
      </div>
    </div>
  )
}

export default NewsDetail
