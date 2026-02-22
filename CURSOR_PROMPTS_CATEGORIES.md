# Промпт для Cursor: Синхронизация категорий услуг бот ↔ фронтенд

> **Модель:** Claude Opus 4.5
> **Режим:** Agent mode
> **Контекст:** Партнёрский бот (Cloudflare Workers) при создании услуги показывает только 5 групп категорий (beauty, food, retail, influencer, b2b), а фронтенд поддерживает 12 групп и ~70 подкатегорий. Нужно синхронизировать.

---

## Задача

Синхронизировать категории услуг в партнёрском боте (`partner.js`) с каноническим справочником фронтенда (`frontend/src/utils/serviceIcons.js`).

## Файлы

**Источник истины (НЕ МЕНЯТЬ):**
- `frontend/src/utils/serviceIcons.js` — канонический справочник: `serviceCategories` (все подкатегории), `categoryGroups` (12 групп)
- `frontend/src/pages/PartnerApply.jsx` — форма регистрации партнёра, строки 423-434: 11 значений `category_group`

**Файлы для изменения:**
- `cloudflare/workers/partner-webhook/partner.js` — функция `getCategoriesByGroup()` (строка ~2783) и `CATEGORY_MAPPING` (строка ~53)

## Текущее состояние

### Фронтенд (PartnerApply.jsx) — 11 значений category_group:
```
beauty, food, education, retail, sports_fitness, entertainment, healthcare, services, self_discovery, influencer, b2b
```

### Фронтенд (serviceIcons.js categoryGroups) — 12 групп:
```
beauty_wellness, self_discovery, food_beverage, education, retail, sports_fitness, entertainment, healthcare, services, travel_tourism, automotive_pets, b2b
```

### Бот (partner.js getCategoriesByGroup) — ТОЛЬКО 5 групп:
```
beauty, food, retail, influencer, b2b
```

**Отсутствуют в боте:** education, sports_fitness, entertainment, healthcare, services, self_discovery, travel_tourism, automotive_pets

## Что нужно сделать

### 1. Обновить `getCategoriesByGroup()` в `partner.js` (строка ~2783)

Заменить текущую функцию на полную версию, синхронизированную с фронтендом. Каждая группа — массив `[emoji, code, name_ru]`:

```javascript
const getCategoriesByGroup = (group) => {
  const categoriesMap = {
    beauty: [
      ['💅', 'nail_care', 'Ногтевой сервис'],
      ['👁️', 'brow_design', 'Коррекция бровей'],
      ['💇‍♀️', 'hair_salon', 'Парикмахерские услуги'],
      ['⚡', 'hair_removal', 'Депиляция'],
      ['✨', 'facial_aesthetics', 'Косметология'],
      ['👀', 'lash_services', 'Наращивание ресниц'],
      ['💆‍♀️', 'massage_therapy', 'Массаж'],
      ['💄', 'makeup_pmu', 'Визаж и перманент'],
      ['🌸', 'body_wellness', 'Телесная терапия'],
      ['🍎', 'nutrition_coaching', 'Нутрициология'],
      ['🧠', 'mindfulness_coaching', 'Ментальное здоровье'],
      ['👗', 'image_consulting', 'Стиль']
    ],
    self_discovery: [
      ['🔮', 'astrology', 'Астрология'],
      ['🔢', 'numerology', 'Нумерология'],
      ['🧠', 'psychology_coaching', 'Психология и коучинг'],
      ['🧘‍♀️', 'meditation_spirituality', 'Медитации и духовные практики']
    ],
    food: [
      ['🍽️', 'restaurant', 'Рестораны'],
      ['☕', 'cafe', 'Кафе и кофейни'],
      ['🚚', 'food_delivery', 'Доставка еды'],
      ['🥖', 'bakery', 'Пекарни'],
      ['🍸', 'bar', 'Бары и пабы']
    ],
    education: [
      ['📚', 'education', 'Образование'],
      ['🌍', 'language_school', 'Языковая школа'],
      ['📝', 'training', 'Тренинги и курсы'],
      ['💻', 'online_education', 'Онлайн-образование']
    ],
    retail: [
      ['🛍️', 'retail', 'Магазины'],
      ['👔', 'fashion', 'Мода и одежда'],
      ['💄', 'cosmetics_shop', 'Косметика'],
      ['📱', 'electronics', 'Электроника'],
      ['🎁', 'gift_shop', 'Подарки']
    ],
    sports_fitness: [
      ['🏃‍♀️', 'fitness', 'Фитнес'],
      ['🧘‍♀️', 'yoga', 'Йога'],
      ['⚽', 'sports', 'Спорт'],
      ['🏊', 'swimming', 'Плавание']
    ],
    entertainment: [
      ['🎉', 'entertainment', 'Развлечения'],
      ['🎬', 'cinema', 'Кино'],
      ['🎭', 'events', 'Мероприятия'],
      ['🎮', 'gaming', 'Игры'],
      ['🎵', 'music', 'Музыка']
    ],
    healthcare: [
      ['🏥', 'healthcare', 'Здравоохранение'],
      ['🦷', 'dental', 'Стоматология'],
      ['🐾', 'veterinary', 'Ветеринария'],
      ['💊', 'pharmacy', 'Аптека']
    ],
    services: [
      ['🧹', 'cleaning', 'Уборка и клининг'],
      ['🔧', 'repair', 'Ремонт'],
      ['📷', 'photography', 'Фотография'],
      ['⚖️', 'legal', 'Юридические услуги'],
      ['📊', 'accounting', 'Бухгалтерия']
    ],
    travel: [
      ['✈️', 'travel', 'Путешествия'],
      ['🏨', 'hotel', 'Отели'],
      ['🗺️', 'tours', 'Туры']
    ],
    automotive: [
      ['🔧', 'car_service', 'Автосервис'],
      ['🚗', 'car_rental', 'Аренда авто'],
      ['🐶', 'pet_services', 'Услуги для животных']
    ],
    influencer: [
      ['💄', 'beauty_influencer', 'Бьюти-блогер'],
      ['🍔', 'food_influencer', 'Фуд-блогер'],
      ['📸', 'lifestyle_influencer', 'Лайфстайл'],
      ['👗', 'fashion_influencer', 'Фэшн-блогер'],
      ['✈️', 'travel_influencer', 'Тревел-блогер']
    ],
    b2b: [
      ['💼', 'consulting', 'Консалтинг'],
      ['📣', 'marketing_agency', 'Маркетинг и реклама'],
      ['💻', 'it_services', 'IT-услуги'],
      ['👥', 'hr_services', 'HR и рекрутинг'],
      ['🚛', 'logistics', 'Логистика'],
      ['🏢', 'coworking', 'Коворкинг'],
      ['🎓', 'business_training', 'Бизнес-обучение'],
      ['🎪', 'event_management', 'Организация мероприятий'],
      ['⚖️', 'legal', 'Юридические услуги'],
      ['📊', 'accounting', 'Бухгалтерия']
    ]
  };
  return categoriesMap[group] || categoriesMap.beauty;
};
```

### 2. Обновить `CATEGORY_MAPPING` в `partner.js` (строка ~53)

Текущий маппинг покрывает только legacy beauty-коды. Добавить **все** legacy-алиасы из `serviceIcons.js` (строки 172-307):

```javascript
const CATEGORY_MAPPING = {
  // Legacy beauty → canonical
  'manicure': 'nail_care',
  'hairstyle': 'hair_salon',
  'massage': 'massage_therapy',
  'cosmetologist': 'facial_aesthetics',
  'eyebrows': 'brow_design',
  'eyelashes': 'lash_services',
  'laser': 'hair_removal',
  'makeup': 'makeup_pmu',
  'skincare': 'facial_aesthetics',
  'nutrition': 'nutrition_coaching',
  'psychology': 'mindfulness_coaching',
  // Legacy other
  'delivery': 'food_delivery',
  'spa': 'body_wellness',
};
```

### 3. Обновить `handleServiceCategorySelection` (строка ~3410)

Сейчас callback_data имеет формат `service_category_${key}`. Убедись, что **все новые коды** из добавленных групп (astrology, numerology, psychology_coaching, meditation_spirituality, language_school, training, online_education, fitness, yoga, sports, swimming, cinema, events, gaming, music, dental, veterinary, pharmacy, cleaning, repair, photography, travel, hotel, tours, car_service, car_rental, pet_services, consulting, marketing_agency, it_services, hr_services, logistics, coworking, business_training, event_management) **обрабатываются** в handleServiceCategorySelection.

Проверь строку ~3405 в partner.js:
```javascript
if (callbackData.startsWith('service_category_')) {
  const category = callbackData.replace('service_category_', '');
  return await handleServiceCategorySelection(env, chatId, category, callbackQuery);
}
```

Это должно работать для любого кода, но проверь что `handleServiceCategorySelection` не фильтрует по жёсткому списку.

### 4. Проверь что `categoryGroup` fallback корректный

Строка ~2780:
```javascript
const categoryGroup = partner?.category_group || 'beauty';
```

Если партнёр зарегистрировался с `category_group = 'education'`, бот должен показать категории education, а не beauty. Эта строка уже корректна **при условии** что getCategoriesByGroup обновлена (шаг 1).

## Чего НЕ делать

- **НЕ менять** `frontend/src/utils/serviceIcons.js` — это источник истины
- **НЕ менять** `frontend/src/pages/PartnerApply.jsx` — форма регистрации уже полная
- **НЕ менять** структуру callback_data — формат `service_category_${code}` остаётся
- **НЕ добавлять** новые файлы — всё меняется в существующем `partner.js`
- **НЕ рефакторить** код вне указанных мест

## Проверка

После изменений:
1. `getCategoriesByGroup('beauty')` → 12 категорий
2. `getCategoriesByGroup('education')` → 4 категории
3. `getCategoriesByGroup('healthcare')` → 4 категории
4. `getCategoriesByGroup('b2b')` → 10 категорий
5. `getCategoriesByGroup('self_discovery')` → 4 категории
6. `getCategoriesByGroup('sports_fitness')` → 4 категории
7. `getCategoriesByGroup('неизвестная_группа')` → fallback на beauty (12 категорий)
8. `mapOldCategoryToNew('manicure')` → `'nail_care'`
9. `mapOldCategoryToNew('delivery')` → `'food_delivery'`
10. `mapOldCategoryToNew('consulting')` → `'consulting'` (без изменений, уже каноническое)
