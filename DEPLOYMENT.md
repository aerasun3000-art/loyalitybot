# 🚀 Инструкции по деплою

**Актуальная информация о деплое проекта LoyalityBot**

---

## 📦 Фронтенд (Cloudflare Pages)

### Платформа
- **Cloudflare Pages**
- **Production URL:** https://loyalitybot-frontend.pages.dev
- **Account:** aerasun3000@gmail.com
- **Project Name:** loyalitybot-frontend

### Команда деплоя

```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name=loyalitybot-frontend --commit-message="описание изменений"
```

### Конфигурация
- **Файл конфигурации:** `cloudflare/pages/wrangler.toml`
- **Build output:** `frontend/dist/`

### Переменные окружения
Настроены через Cloudflare Dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_APP_VERSION`

**Dashboard:** https://dash.cloudflare.com/1e573db7d6be24be4e467cc02a9b8524/pages/view/loyalitybot-frontend/settings/configuration

---

## ⚙️ Бэкенд (Cloudflare Workers)

### Workers

1. **Admin Webhook** (`cloudflare/workers/admin-webhook/`)
   ```bash
   cd cloudflare/workers/admin-webhook
   wrangler deploy
   ```

2. **Client Webhook** (`cloudflare/workers/client-webhook/`)
   ```bash
   cd cloudflare/workers/client-webhook
   wrangler deploy
   ```

3. **Partner Webhook** (`cloudflare/workers/partner-webhook/`)
   ```bash
   cd cloudflare/workers/partner-webhook
   wrangler deploy
   ```

4. **API** (`cloudflare/workers/api/`)
   ```bash
   cd cloudflare/workers/api
   wrangler deploy
   ```

### Секреты
Все секреты настраиваются через:
```bash
wrangler secret put <KEY_NAME> --env=""
```

---

## ⚠️ УСТАРЕВШЕЕ (НЕ ИСПОЛЬЗУЕТСЯ)

- ❌ **Netlify** - больше не используется для фронтенда
- ❌ **Vercel** - больше не используется для фронтенда
- ❌ **Fly.io для фронтенда** - больше не используется

Устаревшие файлы и документация перемещены в `archive/old-deploy-docs/`

---

## 📝 Примечания

- Все деплои выполняются через Cloudflare
- Фронтенд и бэкенд находятся в одной экосистеме Cloudflare
- Для автоматических деплоев можно настроить Git интеграцию в Cloudflare Dashboard

---

**Последнее обновление:** 2026-01-19
