# Cursor Prompts: Зеркало для РФ + Custom Domains

**Контекст:** Cloudflare `.workers.dev` и `.pages.dev` заблокированы у многих пользователей в России.
**Цель:** Бесперебойная работа Mini App для RU-пользователей без смены архитектуры.
**Стек:** Cloudflare Workers (API/боты) + Cloudflare Pages (фронтенд) + отдельный RU-хостинг для статики.

---

## Блок 1: Custom Domains на Cloudflare (2–3 дня)

> **Что даёт:** Убирает `.workers.dev` и `.pages.dev` в URL-ах — пользователи обращаются к вашему домену.
> **Требование:** У вас должен быть домен, DNS которого управляется через Cloudflare.

---

### Промпт 1.1 — Health-check с CORS для кастомного домена

```
Файл: cloudflare/workers/api/index.js

В функции fetch, до основной обработки запросов, добавить CORS-заголовки для поддержки
кастомного домена. Заголовок Access-Control-Allow-Origin должен браться из env.ALLOWED_ORIGIN
(с fallback '*'). Это нужно применить к ответу /health и ко всем остальным маршрутам.

Конкретно:
1. Найти место, где формируется ответ /health (строка ~821):
   return jsonResponse({ status: 'ok' });
   Добавить к нему заголовок Access-Control-Allow-Origin: env.ALLOWED_ORIGIN || '*'

2. Найти функцию jsonResponse (или аналогичную вспомогательную), добавить в неё параметр
   allowedOrigin и прокидывать его как заголовок Access-Control-Allow-Origin.
   Если функция jsonResponse не принимает дополнительные заголовки — добавить этот параметр.

3. В env-секцию wrangler.toml для api добавить строку комментария:
   # ALLOWED_ORIGIN - кастомный домен фронтенда, напр. https://app.yourdomain.com

Не менять логику маршрутизации, не трогать другие заголовки.
```

---

### Промпт 1.2 — Routes в wrangler.toml для всех воркеров

```
Файлы:
  cloudflare/workers/api/wrangler.toml
  cloudflare/workers/client-webhook/wrangler.toml
  cloudflare/workers/partner-webhook/wrangler.toml
  cloudflare/workers/admin-webhook/wrangler.toml

В каждый wrangler.toml добавить секцию routes с комментарием-заглушкой, которую пользователь
заменит своим доменом. Формат для каждого файла разный:

1. cloudflare/workers/api/wrangler.toml — добавить после строки compatibility_date:
   # Раскомментировать и заменить домен после настройки DNS в Cloudflare:
   # routes = [
   #   { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
   # ]

2. cloudflare/workers/client-webhook/wrangler.toml — то же самое:
   # routes = [
   #   { pattern = "client-bot.yourdomain.com/*", zone_name = "yourdomain.com" }
   # ]

3. cloudflare/workers/partner-webhook/wrangler.toml:
   # routes = [
   #   { pattern = "partner-bot.yourdomain.com/*", zone_name = "yourdomain.com" }
   # ]

4. cloudflare/workers/admin-webhook/wrangler.toml:
   # routes = [
   #   { pattern = "admin-bot.yourdomain.com/*", zone_name = "yourdomain.com" }
   # ]

Добавить только комментарии — не раскомментировать, не менять другие поля.
```

---

### Промпт 1.3 — Документ настройки custom domains

```
Создать файл docs/CUSTOM_DOMAINS_SETUP.md

Содержимое должно быть пошаговой инструкцией на русском языке:

## Шаг 1: Добавить домен в Cloudflare
- Перенести DNS домена yourdomain.com на Cloudflare nameservers (если ещё не сделано)

## Шаг 2: Добавить DNS-записи для воркеров
Для каждого воркера добавить CNAME-запись в DNS Cloudflare:
| Имя записи          | Тип  | Значение                          |
|---------------------|------|-----------------------------------|
| api                 | CNAME| loyalitybot-api.workers.dev       |
| client-bot          | CNAME| loyalitybot-client.workers.dev    |
| partner-bot         | CNAME| loyalitybot-partner.workers.dev   |
| admin-bot           | CNAME| loyalitybot-admin.workers.dev     |

Proxy (оранжевое облако) должен быть включён для всех записей.

## Шаг 3: Раскомментировать routes в wrangler.toml
Заменить yourdomain.com на ваш домен в каждом wrangler.toml,
раскомментировать секцию routes.

## Шаг 4: Деплой воркеров
wrangler deploy из каждой папки воркера.

## Шаг 5: Обновить VITE_API_URL
В Cloudflare Pages → Settings → Environment variables:
VITE_API_URL = https://api.yourdomain.com

## Шаг 6: Обновить wrangler secret ALLOWED_ORIGIN
wrangler secret put ALLOWED_ORIGIN --name loyalitybot-api
Ввести: https://app.yourdomain.com

## Шаг 7: Переподключить Telegram вебхуки
Для каждого бота открыть:
https://client-bot.yourdomain.com/setup-webhook?key=<WEBHOOK_SECRET_TOKEN>
https://partner-bot.yourdomain.com/setup-webhook?key=<WEBHOOK_SECRET_TOKEN>
https://admin-bot.yourdomain.com/setup-webhook?key=<WEBHOOK_SECRET_TOKEN>

## Шаг 8: Обновить Cloudflare Pages кастомный домен
Pages → loyalitybot-frontend → Custom domains → Add domain → app.yourdomain.com
```

---

## Блок 2: Зеркало фронтенда для РФ (1–1.5 недели)

> **Что даёт:** Статика React-приложения отдаётся с российского CDN, минуя Cloudflare.
> **Принцип:** Фронтенд пробует основной API (CF), при таймауте переключается на RU-зеркало.
> **Хостинг для статики:** Selectel Object Storage / Timeweb CDN / VK Cloud / любой S3-совместимый.

---

### Промпт 2.1 — Утилита определения рабочего API URL

```
Файл: frontend/src/utils/apiResolver.js — создать новый файл.

Логика: при запуске приложения определяем, какой API URL отвечает быстрее.
Используем два URL: PRIMARY (Cloudflare) и FALLBACK (российское зеркало).

Алгоритм:
1. Читаем PRIMARY_URL = import.meta.env.VITE_API_URL (обязательно)
2. Читаем FALLBACK_URL = import.meta.env.VITE_API_URL_FALLBACK (опционально)
3. Если FALLBACK_URL не задан — всегда возвращаем PRIMARY_URL (без проверок).
4. Если FALLBACK_URL задан:
   a. Делаем fetch(`${PRIMARY_URL}/health`, { signal: AbortSignal.timeout(3000) })
   b. Если ответ получен за 3 сек — сохраняем PRIMARY_URL в module-level переменную resolvedUrl
   c. Если таймаут/ошибка — делаем fetch(`${FALLBACK_URL}/health`, { signal: AbortSignal.timeout(3000) })
   d. Если FALLBACK ответил — сохраняем FALLBACK_URL в resolvedUrl
   e. Если оба не ответили — возвращаем PRIMARY_URL (pessimistic fallback)
5. Экспортировать:
   - async function resolveApiUrl(): Promise<string> — выполняет проверку один раз, кэширует результат
   - function getResolvedApiUrl(): string — синхронно возвращает кэшированный результат ('' если ещё не resolved)

Не добавлять лишних зависимостей, не использовать axios или другие библиотеки.
Только нативный fetch с AbortSignal.timeout.
```

---

### Промпт 2.2 — Подключить apiResolver в точке входа

```
Файл: frontend/src/main.jsx

Импортировать resolveApiUrl из ./utils/apiResolver.
Обернуть рендер приложения так:

import { resolveApiUrl } from './utils/apiResolver'

resolveApiUrl().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})

Это гарантирует, что к моменту рендера компонентов resolvedUrl уже известен.
Не менять ничего кроме обёртки вокруг createRoot().render().
```

---

### Промпт 2.3 — Использовать getResolvedApiUrl в getApiBaseUrl

```
Файл: frontend/src/services/supabase.js

Найти функцию getApiBaseUrl (строки ~2035–2049).

Импортировать { getResolvedApiUrl } from '../utils/apiResolver' в начало файла.

Изменить функцию getApiBaseUrl:
- Приоритет 1: getResolvedApiUrl() — если вернул непустую строку, использовать его
- Приоритет 2: import.meta.env.VITE_API_URL — как раньше
- Приоритет 3: localhost для разработки
- Fallback: пустая строка с предупреждением

Не менять логику вокруг функции, не трогать другие функции в файле.
```

---

### Промпт 2.4 — Скрипт сборки для RU CDN

```
Создать файл scripts/build-for-ru-cdn.sh

Скрипт должен:
1. Принимать переменные окружения:
   - VITE_API_URL (основной CF API, обязательно)
   - VITE_API_URL_FALLBACK (RU зеркало API, обязательно для RU-сборки)
   - VITE_SUPABASE_URL (обязательно)
   - VITE_SUPABASE_ANON_KEY (обязательно)
   - CDN_BUCKET (S3 bucket name или путь для загрузки, опционально)

2. Проверять наличие VITE_API_URL_FALLBACK — если не задан, выводить ошибку и выходить.

3. Выполнять:
   cd frontend
   npm run build

4. После сборки выводить сообщение:
   ✅ Сборка готова: frontend/dist/
   📦 Загрузите содержимое папки dist/ на ваш CDN/хостинг.
   🌐 Основной API: $VITE_API_URL
   🇷🇺 Резервный API (RU): $VITE_API_URL_FALLBACK

5. Если задан CDN_BUCKET — добавить шаг загрузки через aws s3 sync:
   aws s3 sync frontend/dist/ s3://$CDN_BUCKET --delete --acl public-read

Сделать файл исполняемым (chmod +x в комментарии).
Не хардкодить URL-ы в скрипте.
```

---

### Промпт 2.5 — RU API Worker-прокси (опционально, если нет VPS)

```
Создать файл cloudflare/workers/ru-proxy/index.js

Этот воркер будет деплоиться на ДРУГОЙ аккаунт Cloudflare (или другой CDN с Workers),
физически расположенный в РФ / без блокировок (например Timeweb Cloud Functions).

Логика воркера:
- Принимает любой запрос
- Добавляет заголовок X-Forwarded-From: ru-proxy
- Проксирует его на TARGET_API_URL из env (= основной loyalitybot-api.workers.dev)
- Копирует ответ как есть

Код должен быть минималистичным: один fetch с передачей метода, заголовков и body.
Обрабатывать CORS: если запрос OPTIONS — возвращать 204 с нужными заголовками.

Создать также cloudflare/workers/ru-proxy/wrangler.toml:
name = "loyalitybot-ru-proxy"
main = "index.js"
compatibility_date = "2024-01-01"
# TARGET_API_URL - задать через wrangler secret put TARGET_API_URL

Комментарий в файле: "Деплоить на отдельный аккаунт/регион без блокировок Cloudflare"
```

---

### Промпт 2.6 — Добавить VITE_API_URL_FALLBACK в .env.example

```
Файл: frontend/.env.example

Найти строку:
# API URL (required for "В браузере" auth and translate)
VITE_API_URL=https://loyalitybot-api.YOUR_SUBDOMAIN.workers.dev

Добавить после неё:

# RU Mirror API (optional, used as fallback if primary API is unavailable)
# Deploy ru-proxy worker or use a VPS in Russia
# VITE_API_URL_FALLBACK=https://ru-api.yourdomain.ru

Не менять ничего другого в файле.
```

---

## Блок 3: Инструкция деплоя на RU CDN

### Промпт 3.1 — Документ по RU CDN

```
Создать файл docs/RU_CDN_SETUP.md

Содержимое — пошаговая инструкция на русском языке:

## Зачем

Cloudflare Pages (.pages.dev) может быть заблокирован в России.
Решение: хранить статику (HTML/JS/CSS) на российском CDN,
а запросы к API проксировать через российский воркер.

## Архитектура

[Пользователь в РФ]
    ↓
[Российский CDN: статика React-приложения]
    ↓ (JS делает fetch)
[ru-api.yourdomain.ru → ru-proxy Worker]
    ↓
[loyalitybot-api.workers.dev → Supabase]

## Шаг 1: Выбрать CDN для статики

Варианты:
- Selectel Object Storage + CDN (рекомендуется)
- VK Cloud Object Storage
- Timeweb S3-совместимое хранилище
- Любой S3-совместимый хостинг с публичным доступом

## Шаг 2: Собрать приложение для RU

export VITE_API_URL=https://api.yourdomain.com
export VITE_API_URL_FALLBACK=https://ru-api.yourdomain.ru
export VITE_SUPABASE_URL=your_supabase_url
export VITE_SUPABASE_ANON_KEY=your_anon_key
bash scripts/build-for-ru-cdn.sh

## Шаг 3: Загрузить dist/ на CDN

Вариант A (AWS CLI / Selectel S3):
aws s3 sync frontend/dist/ s3://your-bucket/ \\
  --endpoint-url https://s3.selcdn.ru \\
  --acl public-read

Вариант B (вручную): загрузить содержимое frontend/dist/ через веб-интерфейс хостинга.

Настроить индексный файл: index.html
Настроить страницу ошибки 404: index.html (для React Router)

## Шаг 4: Деплой ru-proxy воркера

cd cloudflare/workers/ru-proxy
wrangler secret put TARGET_API_URL
# Ввести: https://loyalitybot-api.workers.dev
wrangler deploy

Настроить кастомный домен для ru-proxy: ru-api.yourdomain.ru

## Шаг 5: Проверка

curl https://ru-api.yourdomain.ru/health
# Должен вернуть: {"status":"ok"}

Открыть https://your-cdn-url.selcdn.ru → должно открыться приложение.

## Шаг 6: Обновить Telegram Mini App URL

BotFather → /mybots → выбрать бота → Bot Settings → Menu Button
Изменить URL на: https://your-cdn-url.selcdn.ru
(или кастомный домен CDN)
```

---

## Порядок выполнения

| # | Промпт | Файлы | Время |
|---|--------|-------|-------|
| 1.1 | CORS для custom domain | `api/index.js` | 10 мин |
| 1.2 | Routes в wrangler.toml | 4 × `wrangler.toml` | 10 мин |
| 1.3 | Инструкция custom domains | `docs/` | 5 мин |
| 2.1 | apiResolver утилита | `utils/apiResolver.js` | 15 мин |
| 2.2 | Подключить в main.jsx | `main.jsx` | 5 мин |
| 2.3 | Использовать в supabase.js | `services/supabase.js` | 5 мин |
| 2.4 | Build-скрипт для CDN | `scripts/` | 10 мин |
| 2.5 | ru-proxy воркер | `workers/ru-proxy/` | 15 мин |
| 2.6 | .env.example | `frontend/.env.example` | 2 мин |
| 3.1 | Инструкция RU CDN | `docs/` | 5 мин |

**Итого:** ~80 минут работы в Cursor + время настройки CDN аккаунта.

---

## Что делать после Cursor

1. Настроить DNS домена в Cloudflare (промпт 1.2)
2. Завести аккаунт в Selectel/Timeweb/VK Cloud (для статики)
3. Деплоить воркеры: `wrangler deploy` из каждой папки
4. Собрать и загрузить фронтенд: `bash scripts/build-for-ru-cdn.sh`
5. Обновить URL Mini App в BotFather
