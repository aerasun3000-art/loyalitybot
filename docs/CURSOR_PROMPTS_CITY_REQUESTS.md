# Cursor Prompt: City Requests Feature

## Контекст проекта

LoyalityBot — бот лояльности. Бэкенд — Cloudflare Workers (JS). Фронтенд — React/Vite (`frontend/`). БД — Supabase (REST API через `supabaseRequest(env, endpoint, options)`).

**Текущая проблема:** Список городов в форме регистрации партнёра (`frontend/src/pages/PartnerApply.jsx`) захардкожен в `frontend/src/utils/locations.js` через `getPartnerCitiesList()`. Пользователь не может предложить свой город.

## Задача

Реализовать полный цикл «предложить город»:

1. Пользователь выбирает «+ Предложить мой город» в дропдауне → вводит название → заявка сохраняется в `city_requests`
2. Supabase Database Webhook уведомляет админ-бот о новой заявке
3. Админ одобряет/отклоняет → город добавляется в `available_cities` (при одобрении) → партнёру приходит уведомление в любом случае
4. Форма PartnerApply загружает города динамически: `available_cities` из БД + статический список `PARTNER_CITIES` из `locations.js` (объединение, без дублей)

---

## Шаг 1: SQL-миграция

Создай файл `migrations/add_city_requests.sql`:

```sql
-- Таблица заявок на добавление нового города
CREATE TABLE city_requests (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  requester_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Таблица одобренных городов (динамический список)
CREATE TABLE available_cities (
  name TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Заполняем available_cities текущим статическим списком из locations.js
-- чтобы при переходе на динамику ничего не пропало
INSERT INTO available_cities (name) VALUES
  ('Online'),
  ('New York'),
  ('Los Angeles'),
  ('Bay Area'),
  ('Chicago'),
  ('Miami'),
  ('Boston'),
  ('Seattle'),
  ('Nha Trang'),
  ('Almaty'),
  ('Astana'),
  ('Bishkek'),
  ('Osh'),
  ('Dubai')
ON CONFLICT (name) DO NOTHING;

-- RLS: разрешить фронтенду читать available_cities без авторизации
ALTER TABLE available_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read available_cities" ON available_cities
  FOR SELECT USING (true);

-- RLS: разрешить фронтенду вставлять в city_requests (через anon key)
ALTER TABLE city_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert city_requests" ON city_requests
  FOR INSERT WITH CHECK (true);
```

---

## Шаг 2: Frontend — `frontend/src/services/supabase.js`

Добавь две функции в конец файла (не трогай существующий код):

```js
/**
 * Получить список доступных городов из таблицы available_cities
 */
export const getAvailableCities = async () => {
  const { data, error } = await supabase
    .from('available_cities')
    .select('name')
    .order('name', { ascending: true })
  if (error) {
    console.error('Error fetching available_cities:', error)
    return []
  }
  return data.map(row => row.name)
}

/**
 * Отправить заявку на добавление нового города
 */
export const submitCityRequest = async ({ chatId, cityName, requesterName }) => {
  const { data, error } = await supabase
    .from('city_requests')
    .insert([{
      chat_id: String(chatId),
      city_name: cityName.trim(),
      requester_name: requesterName || null,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}
```

---

## Шаг 3: Frontend — `frontend/src/pages/PartnerApply.jsx`

### 3.1 Импорты (добавь в существующий блок импортов)

```js
import { getAvailableCities, submitCityRequest } from '../services/supabase'
```

### 3.2 Состояние (добавь рядом с другими `useState`)

```js
const [cities, setCities] = useState([])         // заменяет const [cities] = useState(getPartnerCitiesList())
const [showCityInput, setShowCityInput] = useState(false)
const [customCity, setCustomCity] = useState('')
const [cityRequestSent, setCityRequestSent] = useState(false)
```

**Удали** строку:
```js
const [cities] = useState(getPartnerCitiesList())
```

### 3.3 useEffect для загрузки городов (добавь после существующих useEffect)

```js
useEffect(() => {
  const loadCities = async () => {
    const dbCities = await getAvailableCities()
    const staticCities = getPartnerCitiesList() // из locations.js — для districts
    // Объединяем: сначала из БД, дополняем статическими если не дублируются
    const dbNames = new Set(dbCities)
    const merged = [
      ...dbCities.map(name => {
        const staticMatch = staticCities.find(c => c.value === name)
        return staticMatch || { value: name, label: name }
      }),
      ...staticCities.filter(c => !dbNames.has(c.value)),
    ]
    setCities(merged)
  }
  loadCities()
}, [])
```

### 3.4 Обработчик отправки заявки на город

```js
const handleCityRequest = async () => {
  if (!customCity.trim()) return
  try {
    await submitCityRequest({
      chatId,
      cityName: customCity,
      requesterName: formData.name || user?.first_name || null,
    })
    setCityRequestSent(true)
    setShowCityInput(false)
    setCustomCity('')
  } catch (err) {
    console.error('City request error:', err)
  }
}
```

### 3.5 JSX — дропдаун города (замени блок `<select name="city">`)

Найди секцию `{/* Город (обязателен только для оффлайн) */}` и замени содержимое `<div className="mb-4">`:

```jsx
<label className="block font-semibold mb-2" style={{ color: 'var(--tg-theme-text-color)' }}>
  {t('partner_city')} {t('required_field')}
</label>
<select
  name="city"
  value={formData.city}
  onChange={handleCityChange}
  className="w-full px-4 py-3 rounded-xl focus:outline-none"
  style={inputStyle(errors.city)}
>
  <option value="">{t('partner_city_placeholder')}</option>
  {cities.map((city) => (
    <option key={city.value} value={city.value}>
      {city.label}
    </option>
  ))}
  <option value="__request__">
    {language === 'ru' ? '+ Предложить мой город' : '+ Suggest my city'}
  </option>
</select>

{/* Поле для ввода своего города */}
{showCityInput && (
  <div className="mt-3 flex gap-2">
    <input
      type="text"
      value={customCity}
      onChange={e => setCustomCity(e.target.value)}
      className="flex-1 px-4 py-3 rounded-xl focus:outline-none"
      style={inputStyle(false)}
      placeholder={language === 'ru' ? 'Название города' : 'City name'}
      maxLength={100}
    />
    <button
      type="button"
      onClick={handleCityRequest}
      className="px-4 py-3 rounded-xl font-semibold"
      style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color, #fff)' }}
    >
      {language === 'ru' ? 'Отправить' : 'Send'}
    </button>
  </div>
)}

{cityRequestSent && (
  <p className="text-sm mt-2" style={{ color: 'var(--tg-theme-button-color)' }}>
    {language === 'ru'
      ? '✅ Заявка на добавление города отправлена! Мы уведомим вас о решении.'
      : '✅ City request sent! We will notify you of our decision.'}
  </p>
)}

{errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
```

### 3.6 handleCityChange — обработка выбора `__request__`

В функции `handleCityChange` добавь ветку в начале:

```js
const handleCityChange = (e) => {
  const city = e.target.value
  if (city === '__request__') {
    setShowCityInput(true)
    setFormData(prev => ({ ...prev, city: '', district: '' }))
    return
  }
  setShowCityInput(false)
  setFormData(prev => ({ ...prev, city, district: '' }))
  if (errors.city) setErrors(prev => ({ ...prev, city: '' }))
}
```

---

## Шаг 4: Admin Webhook — новый хендлер `city_requests.js`

Создай файл `cloudflare/workers/admin-webhook/handlers/city_requests.js`:

```js
/**
 * City requests handler for admin bot
 */

import { supabaseRequest } from '../supabase.js';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerCallbackQuery,
  editMessageText,
} from '../telegram.js';
import { logError } from '../common.js';
import { sendPartnerNotification } from './partners.js';

/**
 * Notify admin about new city request
 */
export async function notifyAdminNewCityRequest(env, cityRequest) {
  const adminIds = (env.ADMIN_CHAT_ID || '').split(',').map(id => id.trim()).filter(Boolean);
  const text =
    `🌍 <b>Новая заявка на город</b>\n\n` +
    `<b>Город:</b> ${cityRequest.city_name}\n` +
    `<b>От партнёра:</b> ${cityRequest.requester_name || 'не указано'}\n` +
    `<b>Chat ID:</b> <code>${cityRequest.chat_id}</code>\n` +
    `<b>ID заявки:</b> ${cityRequest.id}`;

  const keyboard = [[
    { text: '✅ Одобрить', callback_data: `city_req_approve_${cityRequest.id}` },
    { text: '❌ Отклонить', callback_data: `city_req_reject_${cityRequest.id}` },
  ]];

  for (const adminId of adminIds) {
    try {
      await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, adminId, text, keyboard, 'HTML');
    } catch (err) {
      logError('notifyAdminNewCityRequest', err, { adminId });
    }
  }
}

/**
 * Handle city_req_approve / city_req_reject callback
 */
export async function handleCityRequestCallback(env, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = String(callbackQuery.message.chat.id);
  const messageId = callbackQuery.message.message_id;

  const approveMatch = data.match(/^city_req_approve_(\d+)$/);
  const rejectMatch = data.match(/^city_req_reject_(\d+)$/);
  const requestId = approveMatch?.[1] || rejectMatch?.[1];
  const isApprove = !!approveMatch;

  if (!requestId) return false;

  try {
    // Fetch the request
    const rows = await supabaseRequest(env, `city_requests?id=eq.${requestId}&select=*`);
    if (!rows || rows.length === 0) {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Заявка не найдена' });
      return true;
    }
    const req = rows[0];

    if (req.status !== 'pending') {
      await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
        text: `Уже обработана: ${req.status}`,
      });
      return true;
    }

    const newStatus = isApprove ? 'approved' : 'rejected';

    // Update status
    await supabaseRequest(env, `city_requests?id=eq.${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });

    // If approved — add to available_cities
    if (isApprove) {
      await supabaseRequest(env, 'available_cities', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ name: req.city_name }),
      });
    }

    // Notify partner
    const partnerMsg = isApprove
      ? `✅ Ваш запрос на добавление города <b>${req.city_name}</b> одобрен! Теперь вы можете выбрать его при регистрации.`
      : `❌ Ваш запрос на добавление города <b>${req.city_name}</b> отклонён администратором.`;
    await sendPartnerNotification(env, req.chat_id, partnerMsg);

    // Edit admin message
    const resultText =
      `${isApprove ? '✅ Одобрено' : '❌ Отклонено'}: город <b>${req.city_name}</b>\n` +
      `Партнёр уведомлён.`;
    await editMessageText(env.ADMIN_BOT_TOKEN, chatId, messageId, resultText, 'HTML');
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, {
      text: isApprove ? '✅ Город добавлен' : '❌ Заявка отклонена',
    });

  } catch (err) {
    logError('handleCityRequestCallback', err, { requestId });
    await answerCallbackQuery(env.ADMIN_BOT_TOKEN, callbackQuery.id, { text: 'Ошибка обработки' });
  }

  return true;
}

/**
 * Show pending city requests list to admin
 */
export async function showCityRequests(env, chatId) {
  try {
    const rows = await supabaseRequest(env, 'city_requests?status=eq.pending&select=*&order=created_at.asc');
    if (!rows || rows.length === 0) {
      await sendTelegramMessage(env.ADMIN_BOT_TOKEN, chatId, '🌍 Нет новых заявок на города.');
      return;
    }
    for (const req of rows) {
      const text =
        `🌍 <b>Заявка на город</b>\n\n` +
        `<b>Город:</b> ${req.city_name}\n` +
        `<b>От партнёра:</b> ${req.requester_name || 'не указано'}\n` +
        `<b>Chat ID:</b> <code>${req.chat_id}</code>`;
      const keyboard = [[
        { text: '✅ Одобрить', callback_data: `city_req_approve_${req.id}` },
        { text: '❌ Отклонить', callback_data: `city_req_reject_${req.id}` },
      ]];
      await sendTelegramMessageWithKeyboard(env.ADMIN_BOT_TOKEN, chatId, text, keyboard, 'HTML');
    }
  } catch (err) {
    logError('showCityRequests', err, { chatId });
  }
}
```

---

## Шаг 5: Admin Webhook — `index.js` (добавить /db-webhook маршрут)

В файле `cloudflare/workers/admin-webhook/index.js` добавь обработку POST на `/db-webhook` **перед** блоком `if (request.method !== 'POST')`:

```js
// Supabase Database Webhook — новые заявки на города
if (request.method === 'POST' && url.pathname === '/db-webhook') {
  const secret = url.searchParams.get('secret');
  if (!env.DB_WEBHOOK_SECRET || secret !== env.DB_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const payload = await request.json();
    // payload.type === 'INSERT', payload.table === 'city_requests'
    if (payload.table === 'city_requests' && payload.type === 'INSERT' && payload.record) {
      const { notifyAdminNewCityRequest } = await import('./handlers/city_requests.js');
      await notifyAdminNewCityRequest(env, payload.record);
    }
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[db-webhook] Error:', err);
    return new Response('Error', { status: 500 });
  }
}
```

Добавь импорт в начало файла (с другими импортами):
```js
// (импорт city_requests делается динамически внутри обработчика выше — не нужен статический)
```

---

## Шаг 6: Admin Webhook — `admin.js` (роутинг + меню)

### 6.1 Добавь импорт в начало файла (рядом с другими импортами хендлеров):

```js
import * as cityRequests from './handlers/city_requests.js';
```

### 6.2 В функции `showMainMenu` добавь кнопку в клавиатуру (рядом с кнопкой Партнеров):

```js
[
  { text: '🌍 Заявки на города', callback_data: 'admin_city_requests' },
],
```

### 6.3 В функции `routeUpdate` (или где обрабатываются `callback_query`) добавь:

**В блоке обработки `callback_data`** — добавь перед `default` или в конец цепочки `if/else if`:

```js
if (data === 'admin_city_requests') {
  await cityRequests.showCityRequests(env, chatId);
} else if (data.startsWith('city_req_approve_') || data.startsWith('city_req_reject_')) {
  await cityRequests.handleCityRequestCallback(env, callbackQuery);
}
```

---

## Шаг 7: Настройка Supabase Database Webhook

После деплоя воркера настрой в Supabase Dashboard:

- **Table:** `city_requests`
- **Events:** `INSERT`
- **URL:** `https://<your-admin-worker>.workers.dev/db-webhook?secret=<DB_WEBHOOK_SECRET>`
- **HTTP Method:** POST

Добавь переменную окружения `DB_WEBHOOK_SECRET` в Cloudflare Worker secrets (через `wrangler secret put DB_WEBHOOK_SECRET`).

---

## Важные ограничения

- **Не рефакторить** существующий код вне указанных мест
- **Не переименовывать** функции, компоненты, поля БД
- `supabaseRequest(env, endpoint, options)` — единственный способ запросов к Supabase в воркерах (не использовать supabase-js)
- `sendPartnerNotification(env, chatId, text)` — уже экспортируется из `handlers/partners.js`, использовать как есть
- `editMessageText` — проверь сигнатуру в `cloudflare/workers/admin-webhook/telegram.js` перед использованием
- Стили в PartnerApply — только через `inputStyle()` и `style={{ ... }}` с CSS-переменными Telegram (`var(--tg-theme-*)`)
