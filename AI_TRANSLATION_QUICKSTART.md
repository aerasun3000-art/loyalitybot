# 🚀 Быстрый старт: AI-Перевод контента

## ✅ Что уже сделано

1. ✅ Добавлен метод перевода в `ai_helper.py` (GigaChat)
2. ✅ Создан API endpoint `/api/translate` в `secure_api.py`
3. ✅ Создана утилита `frontend/src/utils/translate.js`
4. ✅ Интегрировано с системой i18n в `frontend/src/utils/i18n.js`

## 🔧 Настройка

### 1. Убедитесь, что GigaChat API ключ настроен

```bash
# В .env файле
GIGACHAT_API_KEY=your_api_key_here
```

### 2. Настройте URL API на фронтенде (опционально)

```bash
# В frontend/.env или .env.local
VITE_API_URL=http://localhost:8001  # или ваш production URL
```

Если не указано, по умолчанию используется `http://localhost:8001`

## 💡 Примеры использования

### Простой пример: Перевод новости

```jsx
import { useState, useEffect } from 'react'
import { translateText } from '../utils/translate'
import useLanguageStore from '../store/languageStore'

const NewsItem = ({ news }) => {
  const { language } = useLanguageStore()
  const [translatedTitle, setTranslatedTitle] = useState(news.title)

  useEffect(() => {
    if (language !== 'ru') {
      translateText(news.title, language, 'ru').then(setTranslatedTitle)
    } else {
      setTranslatedTitle(news.title)
    }
  }, [language, news.title])

  return <h2>{translatedTitle}</h2>
}
```

### Использование с хуком i18n

```jsx
import { useTranslationWithAI } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const MyComponent = ({ content }) => {
  const { language } = useLanguageStore()
  const { t, translateDynamic } = useTranslationWithAI(language)
  const [translated, setTranslated] = useState(content)

  useEffect(() => {
    if (language !== 'ru') {
      translateDynamic(content, 'ru').then(setTranslated)
    }
  }, [language, content, translateDynamic])

  return (
    <div>
      <h1>{t('home_greeting')}</h1>
      <p>{translated}</p>
    </div>
  )
}
```

## 🎯 Где использовать

Идеально для перевода:
- 📰 Новостей (`news.title`, `news.content`)
- 🎁 Акций (`promotions.title`, `promotions.description`)
- 💼 Описаний услуг (`services.title`, `services.description`)
- 📝 Любого динамического контента из базы данных

## ⚡ Оптимизация

Переводы автоматически кэшируются в памяти. Для очистки кэша:

```javascript
import { clearTranslationCache } from '../utils/translate'
clearTranslationCache()
```

## 🔍 Тестирование

Проверьте работу API:

```bash
curl -X POST http://localhost:8001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет", "target_lang": "en", "source_lang": "ru"}'
```

Ожидаемый ответ:
```json
{
  "success": true,
  "translated_text": "Hello",
  "original_text": "Привет",
  "source_lang": "ru",
  "target_lang": "en"
}
```

## 📚 Подробная документация

См. `AI_TRANSLATION_GUIDE.md` для полной документации.

---

**Готово к использованию!** 🎉

