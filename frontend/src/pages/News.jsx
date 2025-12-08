import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPublishedNews } from '../services/supabase'
import { hapticFeedback } from '../utils/telegram'
import { useTranslation, translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'
import Loader from '../components/Loader'

const gradients = [
  'from-sakura-mid/60 via-sakura-accent/50 to-sakura-deep/60',
  'from-sakura-accent/60 via-sakura-mid/50 to-sakura-deep/60',
  'from-sakura-mid/50 via-sakura-dark/40 to-sakura-accent/50',
  'from-sakura-deep/60 via-sakura-mid/50 to-sakura-accent/50',
  'from-sakura-accent/50 via-sakura-dark/40 to-sakura-mid/50'
]

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
      const cached = sessionStorage.getItem('news_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed)) {
            setNews(parsed)
            setLoading(false)
          }
        } catch {}
      }

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

  // Используем переведенные новости, если доступны
  const displayNews = translatedNews.length > 0 ? translatedNews : news
  const featuredNews = displayNews.slice(0, Math.min(displayNews.length, 5))
  const featuredIds = new Set(featuredNews.map(item => item.id))
  const remainingNews = displayNews.filter(item => !featuredIds.has(item.id))
  const gridNews = remainingNews.length > 0 ? remainingNews : displayNews.slice(0, 4)
  const gridSectionTitle = language === 'ru' ? 'Все новости' : 'All news'

  if (loading || translating) {
    return <Loader />
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 text-sakura-surface">
      <div className="absolute inset-0 -z-20">
        <img
          src="/bg/sakura.jpg"
          alt="Sakura background"
          className="w-full h-full object-cover opacity-85"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sakura-mid/20 via-sakura-dark/20 to-sakura-deep/30" />

      <div className="sticky top-0 z-20 px-4 pt-6 pb-4 bg-sakura-surface/15 backdrop-blur-xl border-b border-sakura-border/40">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-full border border-sakura-border/40 bg-sakura-surface/10 text-sakura-surface/80 hover:border-sakura-accent transition-colors"
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
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold drop-shadow-sm">📰 {t('news_title')}</h1>
            <p className="text-xs text-sakura-surface/70 mt-1">{t('news_latest')}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="relative z-10 px-4 py-6 space-y-6">
        {displayNews.length === 0 ? (
          <div className="bg-sakura-surface/10 backdrop-blur-xl rounded-3xl p-8 text-center border border-sakura-border/40 shadow-xl">
            <span className="text-6xl leading-none mx-auto mb-4 block">🌸</span>
            <h3 className="text-xl font-bold mb-2">{t('news_no_items')}</h3>
            <p className="text-sm text-sakura-surface/80">
              {language === 'ru'
                ? 'Следите за обновлениями — вскоре мы поделимся свежими новостями.'
                : 'Stay tuned — fresh updates will appear here very soon.'}
            </p>
          </div>
        ) : (
          <>
            {featuredNews.length > 0 && (
              <section className="bg-sakura-surface/5 backdrop-blur-lg rounded-3xl border border-sakura-border/40 shadow-xl overflow-hidden">
                <div className="relative">
                  <div className="overflow-hidden">
                    <div
                      className="flex transition-transform duration-500 ease-out"
                      style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                    >
                      {featuredNews.map((item, index) => {
                        const gradient = gradients[index % gradients.length]
                        const newsIcon = newsIcons[index % newsIcons.length]

                        return (
                          <div key={item.id} className="w-full flex-shrink-0">
                            <div
                              onClick={() => handleNewsClick(item.id)}
                              className="relative h-64 md:h-72 cursor-pointer"
                            >
                              <div className="absolute inset-0">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                                    <span className="text-8xl text-white/30">{newsIcon}</span>
                                  </div>
                                )}
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-br from-sakura-deep/80 via-sakura-mid/60 to-transparent" />
                              <div className="relative h-full flex flex-col justify-between p-6">
                                <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-sakura-surface/70">
                                  <span>📅 {formatDate(item.created_at)}</span>
                                  {item.views_count > 0 && <span>👁 {item.views_count}</span>}
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold mb-3 line-clamp-2 min-h-[3.5rem]">
                                    {item.title}
                                  </h3>
                                  {item.preview_text && (
                                    <p className="text-sm text-sakura-surface/80 line-clamp-3 mb-4">
                                      {item.preview_text}
                                    </p>
                                  )}
                                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
                                    {t('news_read_more')}
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
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {featuredNews.length > 1 && (
                    <>
                      <button
                        onClick={() => handlePrevSlide(featuredNews.length)}
                        className="absolute top-1/2 left-4 -translate-y-1/2 p-3 rounded-full border border-sakura-border/40 bg-sakura-surface/20 backdrop-blur-md text-sakura-surface hover:border-sakura-accent transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleNextSlide(featuredNews.length)}
                        className="absolute top-1/2 right-4 -translate-y-1/2 p-3 rounded-full border border-sakura-border/40 bg-sakura-surface/20 backdrop-blur-md text-sakura-surface hover:border-sakura-accent transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                        {featuredNews.map((_, index) => (
                          <span
                            key={`indicator-${index}`}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              index === activeSlide ? 'w-6 bg-sakura-accent' : 'w-2 bg-sakura-surface/40'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-semibold">{gridSectionTitle}</h2>
                <span className="text-xs text-sakura-surface/70">{gridNews.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {gridNews.map((item, index) => {
                  const gradient = gradients[index % gradients.length]
                  const newsIcon = newsIcons[(index + featuredNews.length) % newsIcons.length]

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNewsClick(item.id)}
                      className="bg-sakura-surface/5 backdrop-blur-lg rounded-2xl border border-sakura-border/40 shadow-lg overflow-hidden hover:border-sakura-accent/80 transition-all duration-300 cursor-pointer active:scale-[0.985]"
                    >
                      <div className="relative h-32">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                            <span className="text-4xl text-white/30">{newsIcon}</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-sakura-deep/60 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-semibold text-sakura-surface">
                          📅 {formatDate(item.created_at)}
                        </div>
                        {item.views_count > 0 && (
                          <div className="absolute top-2 right-2 bg-sakura-deep/60 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-semibold text-sakura-surface">
                            👁 {item.views_count}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                          {item.title}
                        </h3>
                        {item.preview_text && (
                          <p className="text-xs text-sakura-surface/80 line-clamp-3 mb-3">
                            {item.preview_text}
                          </p>
                        )}
                        <span className="text-[11px] font-semibold text-sakura-deep drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] flex items-center gap-1">
                          {t('news_read_more')}
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M6 12l4-4-4-4" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
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
        .active\\:scale-98:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}

export default News

