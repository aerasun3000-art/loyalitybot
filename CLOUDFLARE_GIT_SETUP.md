# Подключение Git для автоматических билдов Cloudflare Pages

**Проект:** `loyalitybot-frontend`  
**Git репозиторий:** https://github.com/aerasun3000-art/loyalitybot.git  
**Production ветка:** `main`

---

## 📋 Инструкция через Dashboard (рекомендуется)

### Шаг 1: Откройте Dashboard

Перейдите по ссылке:
```
https://dash.cloudflare.com/1e573db7d6be24be4e467cc02a9b8524/pages/view/loyalitybot-frontend/settings/configuration
```

Или:
1. Откройте https://dash.cloudflare.com
2. Выберите аккаунт `aerasun3000@gmail.com`
3. Перейдите в **Pages** → **loyalitybot-frontend**
4. Перейдите в **Settings** → **Configuration**

### Шаг 2: Подключите GitHub репозиторий

1. В разделе **"Builds & deployments"** найдите секцию **"Connect to Git"**
2. Нажмите **"Connect to Git"**
3. Выберите **GitHub** как провайдер
4. Авторизуйтесь через GitHub (если еще не авторизованы)
5. Выберите репозиторий: `aerasun3000-art/loyalitybot`

### Шаг 3: Настройте Build settings

После подключения Git, настройте следующие параметры:

#### Production environment:

| Параметр | Значение |
|----------|----------|
| **Production branch** | `main` |
| **Root directory** | `frontend` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Node.js version** | `18` |

#### Preview environments (опционально):

- **Enable preview deployments**: ✅ Включено
- Те же параметры, что и для Production

### Шаг 4: Настройте переменные окружения

В разделе **"Environment variables"** добавьте:

#### Production environment:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://gynpvfchojnyoirosysj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bnB2ZmNob2pueW9pcm9zeXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTExMzksImV4cCI6MjA3NjIyNzEzOX0.Lw-DG19z7ZNoiu1k0jLO8A7SmylhHPfA596qg0a88qk` |
| `VITE_API_URL` | `https://loyalitybot-api.aerasun3000.workers.dev` |
| `VITE_APP_NAME` | `LoyalityBot` |
| `VITE_APP_VERSION` | `0.1.0` |

#### Preview environment (опционально):

Те же переменные (можно использовать другие значения для тестирования).

### Шаг 5: Сохраните настройки

1. Нажмите **"Save"** для сохранения настроек
2. Cloudflare автоматически запустит первый билд из `main` ветки
3. Дождитесь завершения билда (обычно 1-2 минуты)

---

## ✅ После подключения Git

### Автоматические билды:

- ✅ **Push в `main`** → автоматический деплой в Production
- ✅ **Pull Request** → автоматический preview deployment
- ✅ **Push в другие ветки** → preview deployment (если включено)

### Preview deployments:

Каждый Pull Request и ветка автоматически получают уникальный URL:
```
https://<branch-name>-<hash>.loyalitybot-frontend.pages.dev
```

### Production URL:

```
https://loyalitybot-frontend.pages.dev
```

---

## 🔄 Рабочий процесс

### Обычный деплой:

```bash
# 1. Внесите изменения в код
cd frontend
# ... редактируйте файлы ...

# 2. Закоммитьте и запушите
cd ..
git add .
git commit -m "Update frontend"
git push origin main

# 3. Cloudflare автоматически задеплоит!
```

### Создание Pull Request:

```bash
# 1. Создайте новую ветку
git checkout -b feature/new-feature

# 2. Внесите изменения
cd frontend
# ... редактируйте файлы ...

# 3. Закоммитьте и запушите
cd ..
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 4. Создайте Pull Request на GitHub
# 5. Cloudflare автоматически создаст preview deployment
```

---

## 🔍 Проверка статуса деплоя

### Через Dashboard:

1. Откройте https://dash.cloudflare.com/1e573db7d6be24be4e467cc02a9b8524/pages/view/loyalitybot-frontend
2. Перейдите во вкладку **"Deployments"**
3. Увидите список всех деплоев и их статус:
   - ✅ **Success** - деплой успешен
   - ⏳ **Building** - деплой в процессе
   - ❌ **Failed** - деплой не удался (проверьте логи)

### Через CLI:

```bash
cd /Users/ghbi/Downloads/loyalitybot/frontend
wrangler pages deployment list --project-name=loyalitybot-frontend
```

### Через GitHub:

1. Откройте https://github.com/aerasun3000-art/loyalitybot
2. Перейдите в **Actions** (если настроены)
3. Или проверьте статус в **Pull Requests**

---

## 📊 Мониторинг

### Build logs:

1. Откройте Dashboard → **Pages** → **loyalitybot-frontend**
2. Перейдите в **Deployments**
3. Выберите деплой
4. Нажмите **"View build logs"** или **"View deployment"**

### Build status:

- **Building**: Сборка в процессе
- **Success**: Сборка успешна, фронтенд доступен
- **Failed**: Ошибка сборки (проверьте логи)

---

## ⚠️ Устранение проблем

### Билд не запускается:

1. Проверьте, что репозиторий подключен в Dashboard
2. Проверьте, что Production branch установлен как `main`
3. Проверьте, что Root directory установлен как `frontend`

### Билд падает с ошибкой:

1. Проверьте логи билда в Dashboard
2. Проверьте, что все переменные окружения настроены
3. Проверьте, что `package.json` и `package-lock.json` в репозитории актуальны
4. Проверьте, что Node.js версия установлена как `18`

### Переменные окружения не работают:

1. Убедитесь, что переменные настроены для правильного environment (Production/Preview)
2. Убедитесь, что переменные начинаются с `VITE_` (для Vite)
3. Передеплойте после изменения переменных

---

## 🎯 Альтернатива: Через CLI (если поддерживается)

Если `wrangler pages project connect` поддерживается:

```bash
cd /Users/ghbi/Downloads/loyalitybot
wrangler pages project connect loyalitybot-frontend \
  --repo=https://github.com/aerasun3000-art/loyalitybot.git \
  --production-branch=main \
  --compatibility-date=2024-01-01
```

Но рекомендуется использовать Dashboard для настройки build settings.

---

**Дата создания:** 2026-01-18  
**Последнее обновление:** 2026-01-18
