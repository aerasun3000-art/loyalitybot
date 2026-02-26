# Cursor Prompt: Видимость акций для клиентов и партнёров

## Контекст задачи

В LoyalityBot уже реализована логика скрытия услуг конкурентов:
- Клиент, приглашённый партнёром, не видит услуги конкурентов того же `business_type`
- Реализовано в `frontend/src/utils/categoryHelpers.js` через `isCompetitor()` / `filterCompetitors()`
- Применяется в `Services.jsx` через `getReferralPartnerInfo()`

**Эта же логика не применена к акциям (promotions).** Нужно подключить её к странице акций.

Дополнительно — партнёр при создании акции должен иметь возможность скрыть её от партнёров-конкурентов (другая задача, описана ниже).

---

## Текущая архитектура

### Таблицы БД

**`promotions`** — ключевые поля:
- `id` UUID PK
- `partner_chat_id` TEXT → FK на `partners(chat_id)`
- `approval_status` TEXT ('Approved' / 'Pending' / 'Rejected')
- `is_active` BOOLEAN
- `min_tier` TEXT, `tier_visibility` TEXT ('all' / 'tier_only')
- `end_date` DATE

**`partners`** — ключевые поля:
- `chat_id` TEXT PK
- `business_type` TEXT — категория партнёра (используется в `isCompetitor()`)
- `city` TEXT
- `category_group` TEXT

**`users`** — ключевые поля:
- `chat_id` TEXT PK
- `referral_source` TEXT — формат `"partner_123"` → chat_id партнёра, пригласившего клиента

### Ключевые файлы

- `frontend/src/utils/categoryHelpers.js` — `isCompetitor()` (строки 21–39), `filterCompetitors()` (строки 44–47)
- `frontend/src/services/supabase.js` — `getReferralPartnerInfo(clientChatId)` (строки 630–670), `getActivePromotions(userTier)` (строки 181–212)
- `frontend/src/pages/Services.jsx` — пример применения логики: строки 142–146 (загрузка referralPartnerInfo), строки 483–488 (фильтрация конкурентов)
- `frontend/src/pages/Promotions.jsx` — `loadPromotions()` (строки 139–166) — **здесь логика отсутствует**
- `cloudflare/workers/partner-webhook/partner.js` — создание акции: `handlePromotionAdd()` (~строка 1602), финальная сборка `promoData` (~строка 2744)
- `cloudflare/workers/partner-webhook/supabase.js` — `addPromotion(env, promoData)` (~строка 590)
- `cloudflare/workers/admin-webhook/handlers/promotions.js` — модерация акций

---

## Задача

### Часть 1 — Скрытие акций конкурентов от клиентов (приоритет)

Повторить логику `Services.jsx` для страницы акций. Ничего нового изобретать не нужно — переиспользовать существующий код.

#### Шаг 1 — Обновить запрос акций в `frontend/src/services/supabase.js`

В функции `getActivePromotions()` добавить join с таблицей `partners`, чтобы получить `business_type` партнёра-владельца акции (нужен для `isCompetitor()`). Существующую tier-логику (строки 196–199) не трогать.

```js
// Изменить только select, добавив join:
query.select(`
  *,
  partner:partners!partner_chat_id (
    chat_id,
    business_type,
    city,
    company_name
  )
`)
```

#### Шаг 2 — Обновить `frontend/src/pages/Promotions.jsx`

По аналогии с `Services.jsx` (строки 142–146 и 483–488):

**В инициализации** — добавить загрузку `referralPartnerInfo` и флага `isPartnerUser` параллельно с загрузкой акций:

```js
import { getReferralPartnerInfo, isApprovedPartner } from '../services/supabase'
import { filterCompetitors } from '../utils/categoryHelpers'

// В loadPromotions():
const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
const chatId = tgUser?.id ? String(tgUser.id) : null

// Загружаем параллельно — по аналогии с Services.jsx строки 142–146
const [referralPartnerInfo, isPartnerUser] = await Promise.all([
  getReferralPartnerInfo(chatId),
  chatId ? isApprovedPartner(chatId) : Promise.resolve(false)
])

// Загружаем акции (существующий вызов)
const data = await getActivePromotions(tier)

// Фильтруем конкурентов — по аналогии с Services.jsx строки 483–488
// Передаём каждую акцию в том же формате, что ожидает isCompetitor()
const filtered = filterCompetitors(
  data,
  referralPartnerInfo,
  !!isPartnerUser,
  isPartnerUser ? chatId : null
)
```

`filterCompetitors()` уже умеет работать с объектами у которых есть `partner_chat_id` и `partner.business_type` — именно такой формат возвращает join из шага 1.

---

### Часть 2 — Скрытие акций от партнёров-конкурентов (visibility_mode)

#### Шаг 1 — SQL-миграция `migrations/add_visibility_mode_to_promotions.sql`

```sql
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS visibility_mode TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility_mode IN ('public', 'hide_competitors'));

CREATE INDEX IF NOT EXISTS idx_promotions_visibility_mode
  ON promotions (visibility_mode);

COMMENT ON COLUMN promotions.visibility_mode IS
  'public — видна всем; hide_competitors — скрыта от партнёров той же категории';
```

#### Шаг 2 — Дополнительная фильтрация в `Promotions.jsx` для партнёров

После `filterCompetitors()` добавить фильтр `visibility_mode` для партнёров:

```js
// Дополнительно: если текущий пользователь — партнёр,
// скрывать акции конкурентов с visibility_mode='hide_competitors'
let result = filtered
if (isPartnerUser && referralPartnerInfo) {
  result = filtered.filter(promo => {
    const isOwn = promo.partner_chat_id === chatId
    if (isOwn) return true

    const isCompetitorPartner =
      promo.partner?.business_type === referralPartnerInfo.businessType

    if (isCompetitorPartner && promo.visibility_mode === 'hide_competitors') return false
    return true
  })
}
```

#### Шаг 3 — Шаг выбора visibility_mode в боте партнёра

Файл: `cloudflare/workers/partner-webhook/partner.js`

Добавить состояние `awaiting_promo_visibility` после шага `tier_visibility` (~строка 2784):

```js
await sendMessage(env, chatId,
  '👁 Кому показывать эту акцию?\n\n' +
  '🌐 <b>Всем</b> — видна всем пользователям\n' +
  '🙈 <b>Скрыть от конкурентов</b> — скрыта от партнёров той же категории',
  {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Всем', callback_data: 'promo_visibility_public' }],
        [{ text: '🙈 Скрыть от конкурентов', callback_data: 'promo_visibility_hide' }],
      ]
    }
  }
)
await setBotState(env, chatId, { state: 'awaiting_promo_visibility', data: botState.data })
```

Обработка callback'ов:

```js
case 'promo_visibility_public':
  botState.data.visibility_mode = 'public'
  break
case 'promo_visibility_hide':
  botState.data.visibility_mode = 'hide_competitors'
  break
```

В финальный объект `promoData` (~строка 2744) добавить поле:

```js
visibility_mode: botState.data.visibility_mode ?? 'public',
```

#### Шаг 4 — `cloudflare/workers/partner-webhook/supabase.js`, функция `addPromotion()` (~строка 590)

В тело INSERT добавить поле (остальное не трогать):

```js
visibility_mode: promoData.visibility_mode ?? 'public',
```

#### Шаг 5 — Отображение в админ-панели `cloudflare/workers/admin-webhook/handlers/promotions.js`

В карточку модерации добавить строку:

```js
const visibilityLabel = {
  'public': '🌐 Всем',
  'hide_competitors': '🙈 Скрыто от конкурентов',
}[promo.visibility_mode] ?? '🌐 Всем'

// В текст карточки:
`👁 Видимость: ${visibilityLabel}\n`
```

---

## Что НЕ трогать

- Tier-логику в `getActivePromotions` (строки 196–199 supabase.js)
- `categoryHelpers.js` — использовать как есть, не менять
- `getReferralPartnerInfo()` — использовать как есть
- `approval_status` и модерационный флоу
- `supabase_manager.py` — к боту не относится
- Любые файлы вне указанного скоупа

---

## Порядок реализации

1. `frontend/src/services/supabase.js` — добавить join в `getActivePromotions()`
2. `frontend/src/pages/Promotions.jsx` — добавить `getReferralPartnerInfo`, `filterCompetitors`, фильтр `visibility_mode`
3. `migrations/add_visibility_mode_to_promotions.sql` — создать и применить
4. `cloudflare/workers/partner-webhook/partner.js` — шаг `awaiting_promo_visibility`
5. `cloudflare/workers/partner-webhook/supabase.js` — добавить `visibility_mode` в INSERT
6. `cloudflare/workers/admin-webhook/handlers/promotions.js` — лейбл в карточке

---

## Критерии готовности

- [ ] Клиент, приглашённый партнёром, не видит акции конкурентов (тот же `business_type`) — аналогично логике услуг
- [ ] Клиент без реферала видит все акции без изменений
- [ ] Партнёр не видит акции конкурентов с `visibility_mode='hide_competitors'`
- [ ] Партнёр видит свои акции всегда
- [ ] При создании акции партнёр выбирает режим видимости
- [ ] Миграция применена, дефолт `'public'`, существующие записи не затронуты
- [ ] Администратор видит режим видимости в карточке модерации
