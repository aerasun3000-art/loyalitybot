import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPublishedNews } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation, translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'

const newsIcons = ['📢', '✨', '🎉', '🎁', '🌟', '💖', '🔥', '⭐']

const News = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { language } = useLanguageStore()
  const { t } = useTranslation(language)
  const [news, setNews] = useState([])
  const [translatedNews, setTranslatedNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  // Категории новостей (обновляются при изменении языка)
  const categories = [
    { id: 'all', label: language === 'ru' ? 'Все' : 'All' },
    { id: 'popular', label: language === 'ru' ? 'Популярные' : 'Most popular' },
    { id: 'latest', label: language === 'ru' ? 'Последние' : 'Latest' },
    { id: 'featured', label: language === 'ru' ? 'Рекомендуемые' : 'For you' }
  ]

  useEffect(() => {
    loadNews()

    const newsId = searchParams.get('id')
    if (newsId) {
      navigate(`/news/${newsId}`)
    }
  }, [searchParams])

  useEffect(() => {
    const featuredCount = Math.min(news.length, 5)
    if (featuredCount > 0 && activeSlide >= featuredCount) {
      setActiveSlide(0)
    }
  }, [news.length, activeSlide])

  // Автоматический перевод новостей при изменении языка
  useEffect(() => {
    if (news.length === 0 || language === 'ru') {
      setTranslatedNews(news)
      return
    }

    // Проверяем, доступен ли API для переводов
    const checkApiAndTranslate = async () => {
      // Если в БД уже есть предзаполненные английские поля, используем их без обращения к API
      if (language === 'en' && news.some(item => item.title_en || item.preview_text_en)) {
        const mapped = news.map(item => ({
          ...item,
          title: item.title_en || item.title,
          preview_text: item.preview_text_en || item.preview_text
        }))
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
        const translated = await Promise.all(
          news.map(async (item) => {
            try {
              return {
                ...item,
                title: await translateDynamicContent(item.title, language, 'ru'),
                preview_text: item.preview_text
                  ? await translateDynamicContent(item.preview_text, language, 'ru')
                  : null,
              }
            } catch (error) {
              // Если перевод одного элемента не удался, используем оригинал
              console.warn(`Translation failed for news ${item.id}:`, error)
              return item
            }
          })
        )
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

  const loadNews = async () => {
    try {
      const newsData = await getPublishedNews()
      setNews(newsData)
      sessionStorage.setItem('news_cache', JSON.stringify(newsData))
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

  const handlePrevSlide = (count) => {
    if (count <= 1) return
    hapticFeedback('light')
    setActiveSlide(prev => (prev - 1 + count) % count)
  }

  const handleNextSlide = (count) => {
    if (count <= 1) return
    hapticFeedback('light')
    setActiveSlide(prev => (prev + 1) % count)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const options = { year: 'numeric', month: 'long', day: 'numeric' }
    const locale = language === 'ru' ? 'ru-RU' : 'en-US'
    return date.toLocaleDateString(locale, options)
  }

  const formatShortDate = (dateString) => {
    const date = new Date(dateString)
    const options = { year: 'numeric', month: 'short', day: 'numeric' }
    const locale = language === 'ru' ? 'ru-RU' : 'en-US'
    return date.toLocaleDateString(locale, options)
  }

  const formatFullDate = (dateString) => {
    const date = new Date(dateString)
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    const locale = language === 'ru' ? 'ru-RU' : 'en-US'
    return date.toLocaleDateString(locale, options)
  }

  // Фильтрация и поиск новостей
  const filterNews = (newsList) => {
    let filtered = [...newsList]

    // Фильтр по категориям
    if (activeCategory === 'popular') {
      filtered = filtered.sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    } else if (activeCategory === 'latest') {
      filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else if (activeCategory === 'featured') {
      // Рекомендуемые - первые 5 новостей
      filtered = filtered.slice(0, 5)
    }

    // Поиск
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(query) ||
        item.preview_text?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  // Используем переведенные новости, если доступны
  const displayNews = translatedNews.length > 0 ? translatedNews : news
  const filteredNews = filterNews(displayNews)

  // Главные новости для карусели (первые 2-3)
  const featuredNews = filteredNews.slice(0, Math.min(filteredNews.length, 3))
  // ВСЕ новости для списка (включая те, что в карусели)
  const listNews = filteredNews

  const listSectionTitle = language === 'ru' ? 'Рекомендуемые для вас' : 'For you today news'

  if (loading || translating) {
    return <Loader />
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-24" style={{ backgroundColor: 'var(--tg-theme-bg-color)', color: 'var(--tg-theme-text-color)' }}>

      {/* Header Section */}
      <div className="sticky top-0 z-20 backdrop-blur-xl"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 90%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)'
        }}>
        <div className="px-4 pt-14 pb-4">
          <h1 className="text-[28px] font-bold leading-tight"
            style={{ color: 'var(--tg-theme-button-text-color, #fff)' }}>
            {t('news_title')}
          </h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sticky top-[70px] z-10 px-4 pt-4 pb-2 backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 90%, transparent)' }}>
        <div className="flex items-center gap-3 h-12 px-4 rounded-xl shadow-sm"
          style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--tg-theme-hint-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ru' ? 'Поиск новостей' : 'Search for news'}
            className="flex-1 text-base outline-none bg-transparent"
            style={{ color: 'var(--tg-theme-text-color)', '::placeholder': { color: 'var(--tg-theme-hint-color)' } }}
          />
          <button onClick={() => setSearchQuery('')} className="p-2 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--tg-theme-hint-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-[134px] z-10 px-4 pt-2 pb-3 backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 90%, transparent)' }}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                hapticFeedback('light')
                setActiveCategory(category.id)
              }}
              className="flex-shrink-0 h-10 px-4 rounded-[20px] text-sm font-medium"
              style={activeCategory === category.id
                ? { backgroundColor: 'var(--tg-theme-button-text-color, #fff)', color: 'var(--tg-theme-button-color)' }
                : { backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-text-color, #fff) 20%, transparent)', color: 'var(--tg-theme-button-text-color, #fff)' }
              }
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 pt-6 pb-6">
        {filteredNews.length === 0 ? (
          <div className="rounded-3xl p-8 text-center mx-4"
            style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
            <span className="text-6xl leading-none mx-auto mb-4 block">📰</span>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>{t('news_no_items')}</h3>
            <p className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              {language === 'ru'
                ? 'Следите за обновлениями — вскоре мы поделимся свежими новостями.'
                : 'Stay tuned — fresh updates will appear here very soon.'}
            </p>
          </div>
        ) : (
          <>
            {/* Карусель главных новостей - большие карточки с peek effect */}
            {featuredNews.length > 0 && (
              <div className="mb-6">
                <div
                  className="flex gap-4 overflow-x-auto scrollbar-hide px-4"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {featuredNews.map((item, index) => {
                    const newsIcon = newsIcons[index % newsIcons.length]

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNewsClick(item.id)}
                        className="flex-shrink-0 w-[85%] rounded-xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.98]"
                        style={{
                          scrollSnapAlign: 'start',
                          minWidth: '85%',
                          maxWidth: '85%',
                          backgroundColor: 'var(--tg-theme-secondary-bg-color)'
                        }}
                      >
                        {/* Изображение */}
                        <div className="relative h-[280px] overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 30%, transparent)' }}>
                              <span className="text-6xl opacity-30">{newsIcon}</span>
                            </div>
                          )}
                        </div>

                        {/* Текстовый блок */}
                        <div style={{ padding: '16px' }}>
                          {/* Дата и время чтения */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs leading-[1.4] font-normal" style={{ color: 'var(--tg-theme-hint-color)' }}>
                              {formatShortDate(item.created_at)}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>•</span>
                            <span className="text-xs leading-[1.4] font-normal" style={{ color: 'var(--tg-theme-hint-color)' }}>7 min</span>
                          </div>

                          {/* Заголовок */}
                          <h3 className="text-lg font-bold leading-[1.4] line-clamp-3" style={{ color: 'var(--tg-theme-text-color)' }}>
                            {item.title}
                          </h3>

                          {/* Описание, если есть */}
                          {item.preview_text && (
                            <p className="text-sm leading-[1.5] mt-2 line-clamp-2" style={{ color: 'var(--tg-theme-hint-color)' }}>
                              {item.preview_text}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Список новостей с миниатюрами */}
            {listNews.length > 0 && (
              <div className="px-4 mt-6">
                <div className="mb-4">
                  <h2 className="text-[20px] font-bold leading-[1.3]" style={{ color: 'var(--tg-theme-text-color)' }}>
                    {listSectionTitle}
                  </h2>
                </div>
                <div className="rounded-xl overflow-hidden shadow-sm"
                  style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}>
                  {listNews.map((item, index) => {
                    const newsIcon = newsIcons[(index + featuredNews.length) % newsIcons.length]

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNewsClick(item.id)}
                        className="flex items-start cursor-pointer active:opacity-80"
                        style={{
                          padding: '16px',
                          gap: '16px',
                          borderBottom: index < listNews.length - 1 ? '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 15%, transparent)' : 'none',
                          minHeight: '100px'
                        }}
                      >
                        {/* Левая часть - текст */}
                        <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Имя автора */}
                          <p className="text-sm font-medium leading-[1.5]" style={{ color: 'var(--tg-theme-text-color)', fontSize: '14px', fontWeight: 500 }}>
                            {item.author || 'Admin'}
                          </p>

                          {/* Заголовок */}
                          <h3 className="text-base font-semibold leading-[1.5] line-clamp-2" style={{ color: 'var(--tg-theme-text-color)', fontSize: '16px', fontWeight: 600 }}>
                            {item.title}
                          </h3>

                          {/* Мета-информация */}
                          <p className="text-xs leading-[1.4]" style={{ color: 'var(--tg-theme-hint-color)', fontSize: '12px', fontWeight: 400 }}>
                            {language === 'ru' ? '5 мин чтения' : '5 min read'} • {formatShortDate(item.created_at)}
                          </p>
                        </div>

                        {/* Правая часть - миниатюра */}
                        <div className="flex-shrink-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="object-cover"
                              style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '8px'
                              }}
                            />
                          ) : (
                            <div
                              className="flex items-center justify-center"
                              style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '8px',
                                backgroundColor: 'color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)'
                              }}
                            >
                              <span className="text-2xl opacity-30">{newsIcon}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default News
