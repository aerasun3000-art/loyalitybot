# Промпты для Cursor — фиксы партнёрского бота

> **Модель:** Claude Opus 4.5 (рекомендация)
> **Режим:** Agent mode
> **Выполнять:** последовательно, каждый промпт — отдельная задача

---

## Промпт 1: Фикс маппинга категорий при создании услуги (shortcut path)

**Контекст:** В `partner.js` при создании услуги, если у партнёра уже есть `business_type`, срабатывает shortcut (строка 2623) — шаг выбора категории пропускается. Проблема: `business_type` используется как есть (например `manicure`), без маппинга в каноническое имя (`nail_care`). Функция `mapOldCategoryToNew()` определена ниже (строка 2667), но в shortcut-ветке не вызывается. Это приводит к несовпадению категорий в БД.

**Файл:** `cloudflare/workers/partner-webhook/partner.js`

**Задача:**

1. В shortcut-ветке (строка 2623-2654) добавь маппинг `business_type` через `mapOldCategoryToNew()` перед сохранением.

2. Функция `mapOldCategoryToNew` определена дважды:
   - Строка 2667 (внутри блока `awaiting_service_category`)
   - Строка 3288 (внутри `handleServiceCategorySelection`)

   **Вынеси** её как одну top-level функцию в начало файла (после импортов, до экспортов) и используй во всех трёх местах.

3. Конкретное исправление shortcut-ветки:

```javascript
// БЫЛО (строка 2628):
category: partner.business_type.trim(),

// СТАЛО:
category: mapOldCategoryToNew(partner.business_type.trim()),
```

4. Также проверь `handleServiceCategorySelection` (строка 3321): там `finalCategory = primaryCategory.business_type` — тоже без маппинга. Добавь:
```javascript
finalCategory = mapOldCategoryToNew(primaryCategory.business_type);
```

**Не трогай:** никакой другой код кроме указанных мест. Не добавляй комментарии, не рефакторь.

**Проверка:** после изменений `mapOldCategoryToNew` должна быть одна функция, вызываемая из трёх мест.

---

## Промпт 2: Оптимизация N+1 запросов в getPartnerNetwork

**Контекст:** В `supabase.js` функция `getPartnerNetwork()` (строка 732) делает N+1 запросов к Supabase: для каждого партнёра уровня 1 — отдельный запрос на уровень 2, для каждого уровня 2 — отдельный на уровень 3. При 10 партнёрах уровня 1 и 5 на каждый — это 10+50=60 запросов вместо 3.

**Файл:** `cloudflare/workers/partner-webhook/supabase.js`

**Задача:**

Перепиши `getPartnerNetwork()` (строки 732-777) используя batch-запросы через `in` оператор Supabase:

```javascript
export async function getPartnerNetwork(env, partnerChatId) {
  try {
    // Level 1: direct referrals
    const level1 = await supabaseRequest(
      env,
      `partners?referred_by_chat_id=eq.${partnerChatId}&select=chat_id,name,company_name,is_revenue_share_active,personal_income_monthly`
    ) || [];

    if (level1.length === 0) {
      return { level1: [], level2: [], level3: [], totalCount: 0 };
    }

    // Level 2: batch query by all level1 chat_ids
    const l1Ids = level1.map(p => p.chat_id).join(',');
    const level2Raw = await supabaseRequest(
      env,
      `partners?referred_by_chat_id=in.(${l1Ids})&select=chat_id,name,company_name,is_revenue_share_active,referred_by_chat_id`
    ) || [];

    // Build referrer name map for level 2
    const l1Map = Object.fromEntries(level1.map(p => [p.chat_id, p.company_name || p.name || 'партнёр']));
    const level2 = level2Raw.map(p => ({
      ...p,
      referrer_name: l1Map[p.referred_by_chat_id] || 'партнёр'
    }));

    // Level 3: batch query by all level2 chat_ids
    let level3 = [];
    if (level2.length > 0) {
      const l2Ids = level2.map(p => p.chat_id).join(',');
      const level3Raw = await supabaseRequest(
        env,
        `partners?referred_by_chat_id=in.(${l2Ids})&select=chat_id,name,company_name,is_revenue_share_active,referred_by_chat_id`
      ) || [];

      const l2Map = Object.fromEntries(level2.map(p => [p.chat_id, p.company_name || p.name || 'партнёр']));
      level3 = level3Raw.map(p => ({
        ...p,
        referrer_name: l2Map[p.referred_by_chat_id] || 'партнёр'
      }));
    }

    return {
      level1,
      level2,
      level3,
      totalCount: level1.length + level2.length + level3.length
    };
  } catch (error) {
    console.error('[getPartnerNetwork] Error:', error);
    return { level1: [], level2: [], level3: [], totalCount: 0 };
  }
}
```

**Результат:** максимум 3 запроса вместо N+1. Сигнатура функции и возвращаемая структура не меняются — вызывающий код (`partner.js` строки 411-436) трогать не нужно.

**Не трогай:** никакие другие функции в supabase.js.

---

## Промпт 3: Фикс клиентского бота — проверка webhook и базовые проблемы

**Контекст:** Клиентский бот (`client-webhook/`) вложен в `partner-webhook/` и деплоится отдельно. Нужно проверить что всё корректно подключено и нет очевидных багов.

**Файлы:**
- `cloudflare/workers/partner-webhook/client-webhook/client.js` (263 строки)
- `cloudflare/workers/partner-webhook/client-webhook/supabase.js`
- `cloudflare/workers/partner-webhook/client-webhook/telegram.js`
- `cloudflare/workers/partner-webhook/client-webhook/index.js`

**Задача:**

1. Проверь `index.js` — убедись что роутинг корректный (POST → routeUpdate, GET → 405).

2. В `client.js` проверь:
   - `handleStart`: реферальные ссылки (формат `partner_123` и `ref_ABC123`) — парсятся корректно?
   - Welcome bonus начисляется через `createTransaction`?
   - При повторном /start не создаётся дублирующий пользователь?

3. В `supabase.js` клиентского бота проверь:
   - `getUserByChatId` — корректный запрос к таблице `users`?
   - `upsertUser` — используется `Prefer: resolution=merge-duplicates`?
   - `createTransaction` — правильные поля (user_chat_id, amount, type, description)?

4. В `telegram.js` клиентского бота проверь:
   - Нет ли той же проблемы с `response.json()` vs `response.text()` которая была в админ-боте (потребление stream дважды)?

5. Если найдены баги — исправь. Если всё корректно — ничего не меняй.

**Не трогай:** partner-webhook файлы. Только client-webhook.

---

## Промпт 4: Дедупликация mapOldCategoryToNew и вынос общих утилит

**Контекст:** После промпта 1 функция `mapOldCategoryToNew` вынесена в top-level partner.js. Но аналогичный маппинг может использоваться и в других местах (admin-webhook services.js, при отображении категорий). Нужно убедиться в консистентности.

**Файлы:**
- `cloudflare/workers/partner-webhook/partner.js` — основной маппинг
- `cloudflare/workers/admin-webhook/handlers/services.js` — модерация услуг

**Задача:**

1. Найди все места где есть маппинг старых кодов категорий (manicure→nail_care и т.д.) во всех файлах `cloudflare/workers/`.

2. Если маппинг дублируется в admin-webhook — вынеси в общий файл `cloudflare/utils/categories.js`:
```javascript
export const CATEGORY_MAPPING = {
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
  'psychology': 'mindfulness_coaching'
};

export function mapOldCategoryToNew(oldCode) {
  return CATEGORY_MAPPING[oldCode] || oldCode;
}
```

3. **ВАЖНО:** Cloudflare Workers не поддерживают импорт из папок выше воркера. Если воркеры не могут шарить файлы — оставь отдельные копии в каждом воркере, но убедись что маппинг одинаковый.

4. Если маппинг только в partner-webhook — не создавай новых файлов, просто убедись что всё консистентно.

**Не трогай:** ничего кроме файлов с маппингом категорий.
