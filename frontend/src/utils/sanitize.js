import DOMPurify from 'dompurify'

/**
 * Санитизирует строку — удаляет все HTML-теги и атрибуты, оставляя только текст.
 * Используется для динамического контента из API (переводы, новости, акции).
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return text
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
