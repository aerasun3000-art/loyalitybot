# 🌍 AI-Перевод контента на фронтенде - Руководство

## 📋 Обзор

Система автоматического перевода контента с помощью ИИ (GigaChat) для фронтенда. Позволяет переводить динамический контент (новости, акции, описания услуг) на нужный язык автоматически.

## 🎯 Возможности

- ✅ Автоматический перевод текста через GigaChat AI
- ✅ Кэширование переводов для оптимизации
- ✅ Интеграция с существующей системой i18n
- ✅ Поддержка множества языков (ru, en, es, fr, de, it, pt, zh, ja, ko)
- ✅ Перевод массивов и объектов
- ✅ Fallback на оригинальный текст при ошибках

## 🏗️ Архитектура

```
Frontend (React)
    ↓
translate.js (утилита)
    ↓
Backend API (/api/translate)
    ↓
ai_helper.py (GigaChat)
    ↓
GigaChat API
```

## 📦 Компоненты

### 1. Backend: `ai_helper.py`

Метод `translate_text()` для перевода через GigaChat:

```python
async def translate_text(
    self, 
    text: str, 
    target_lang: str = 'en',
    source_lang: str = 'ru'
) -> Optional[str]
```

### 2. Backend API: `secure_api.py`

Endpoint `/api/translate`:

```json
POST /api/translate
{
  "text": "Привет, мир!",
  "target_lang": "en",
  "source_lang": "ru"
}

Response:
{
  "success": true,
  "translated_text": "Hello, world!",
  "original_text": "Привет, мир!",
  "source_lang": "ru",
  "target_lang": "en"
}
```

### 3. Frontend: `frontend/src/utils/translate.js`

Утилита для перевода на фронтенде:

```javascript
import { translateText, translateTexts, translateObject } from '../utils/translate'

// Перевод одного текста
const translated = await translateText('Привет', 'en', 'ru')

// Перевод массива
const translated = await translateTexts(['Привет', 'Мир'], 'en', 'ru')

// Перевод объекта
const translated = await translateObject({ title: 'Заголовок', desc: 'Описание' }, 'en', 'ru')
```

### 4. Frontend: `frontend/src/utils/i18n.js`

Расширенная функция для перевода динамического контента:

```javascript
import { translateDynamicContent, useTranslationWithAI } from '../utils/i18n'

// В компоненте
const { translateDynamic } = useTranslationWithAI(language)
const translatedNews = await translateDynamic(news.title, 'ru')
```

## 🚀 Использование

### Пример 1: Перевод новостей

```jsx
import { useState, useEffect } from 'react'
import { translateDynamicContent } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const NewsCard = ({ news }) => {
  const { language } = useLanguageStore()
  const [translatedTitle, setTranslatedTitle] = useState(news.title)
  const [translatedContent, setTranslatedContent] = useState(news.content)

  useEffect(() => {
    const translate = async () => {
      if (language !== 'ru') {
        const title = await translateDynamicContent(news.title, language, 'ru')
        const content = await translateDynamicContent(news.content, language, 'ru')
        setTranslatedTitle(title)
        setTranslatedContent(content)
      }
    }
    translate()
  }, [language, news])

  return (
    <div>
      <h2>{translatedTitle}</h2>
      <p>{translatedContent}</p>
    </div>
  )
}
```

### Пример 2: Перевод акций

```jsx
import { translateText } from '../utils/translate'
import useLanguageStore from '../store/languageStore'

const PromotionCard = ({ promotion }) => {
  const { language } = useLanguageStore()
  const [translated, setTranslated] = useState({
    title: promotion.title,
    description: promotion.description
  })

  useEffect(() => {
    const translate = async () => {
      if (language !== 'ru') {
        const title = await translateText(promotion.title, language, 'ru')
        const description = await translateText(promotion.description, language, 'ru')
        setTranslated({ title, description })
      }
    }
    translate()
  }, [language, promotion])

  return (
    <div>
      <h3>{translated.title}</h3>
      <p>{translated.description}</p>
    </div>
  )
}
```

### Пример 3: Перевод описаний услуг

```jsx
import { translateObject } from '../utils/translate'
import useLanguageStore from '../store/languageStore'

const ServiceCard = ({ service }) => {
  const { language } = useLanguageStore()
  const [translated, setTranslated] = useState(service)

  useEffect(() => {
    const translate = async () => {
      if (language !== 'ru') {
        const translatedService = await translateObject(
          {
            title: service.title,
            description: service.description
          },
          language,
          'ru'
        )
        setTranslated({ ...service, ...translatedService })
      }
    }
    translate()
  }, [language, service])

  return (
    <div>
      <h3>{translated.title}</h3>
      <p>{translated.description}</p>
    </div>
  )
}
```

### Пример 4: Использование хука useTranslationWithAI

```jsx
import { useTranslationWithAI } from '../utils/i18n'
import useLanguageStore from '../store/languageStore'

const MyComponent = ({ dynamicContent }) => {
  const { language } = useLanguageStore()
  const { t, translateDynamic } = useTranslationWithAI(language)
  const [translatedContent, setTranslatedContent] = useState(dynamicContent)

  useEffect(() => {
    const translate = async () => {
      if (language !== 'ru') {
        const translated = await translateDynamic(dynamicContent, 'ru')
        setTranslatedContent(translated)
      }
    }
    translate()
  }, [language, dynamicContent, translateDynamic])

  return (
    <div>
      <h1>{t('home_greeting')}</h1>
      <p>{translatedContent}</p>
    </div>
  )
}
```

## ⚙️ Настройка

### 1. Переменные окружения

**Backend:**
```bash
GIGACHAT_API_KEY=your_gigachat_api_key
```

**Frontend:**
```bash
VITE_API_URL=http://localhost:8001  # URL вашего API сервера
```

### 2. Rate Limits

API endpoint имеет rate limit: **30 запросов/минуту**

Для оптимизации используется кэширование переводов в памяти (максимум 1000 записей).

## 🔧 Оптимизация

### Кэширование

Переводы автоматически кэшируются в памяти. Очистить кэш:

```javascript
import { clearTranslationCache } from '../utils/translate'

clearTranslationCache()
```

### Пакетный перевод

Для перевода нескольких текстов используйте `translateTexts`:

```javascript
const texts = ['Текст 1', 'Текст 2', 'Текст 3']
const translated = await translateTexts(texts, 'en', 'ru')
// Переводит параллельно с ограничением 5 одновременных запросов
```

## 🌐 Поддерживаемые языки

- `ru` - Русский
- `en` - Английский
- `es` - Испанский
- `fr` - Французский
- `de` - Немецкий
- `it` - Итальянский
- `pt` - Португальский
- `zh` - Китайский
- `ja` - Японский
- `ko` - Корейский

## 📝 Примечания

1. **Производительность**: Перевод через AI занимает время (обычно 1-3 секунды). Используйте кэширование и показывайте loading состояния.

2. **Ошибки**: При ошибке перевода возвращается оригинальный текст, чтобы не ломать UI.

3. **Плейсхолдеры**: Система сохраняет плейсхолдеры вида `{variable}` без изменений.

4. **Форматирование**: Сохраняется форматирование оригинала (переносы строк, пунктуация).

## 🐛 Отладка

### Проверка работы API

```bash
curl -X POST http://localhost:8001/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Привет, мир!",
    "target_lang": "en",
    "source_lang": "ru"
  }'
```

### Логирование

Включите логирование в браузере:

```javascript
// В translate.js уже есть console.error для ошибок
// Проверьте консоль браузера для отладки
```

## 🔐 Безопасность

- API ключ GigaChat хранится только на backend
- Rate limiting защищает от злоупотреблений
- CORS настроен для фронтенда

## 📊 Мониторинг

Метрики для отслеживания:
- Количество запросов на перевод
- Время ответа API
- Размер кэша
- Процент ошибок

## 🚀 Следующие шаги

1. Добавить поддержку больше языков
2. Реализовать persistent кэш (localStorage/IndexedDB)
3. Добавить предзагрузку переводов для популярного контента
4. Оптимизировать batch перевод для больших объемов

---

**Создано:** 2025  
**Версия:** 1.0  
**Проект:** LoyalityBot





