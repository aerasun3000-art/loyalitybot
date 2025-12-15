# 🔧 Исправление ошибки 404: DEPLOYMENT_NOT_FOUND

## ❌ Проблема

Ошибка:
```
404: NOT_FOUND
Code: DEPLOYMENT_NOT_FOUND
ID: hkg1::dqm7k-1765447226120-fd61096f5ab0
```

Эта ошибка возникает, когда:
- Пытаетесь задеплоить проект, который не существует на платформе
- Используете неправильную конфигурацию
- Проект был удален или не был создан

---

## ✅ Решение

### Вариант 1: Деплой через Netlify Dashboard (Рекомендуется)

1. **Откройте Netlify Dashboard:**
   - https://app.netlify.com
   - Войдите в аккаунт

2. **Создайте новый сайт:**
   - Нажмите **"Add new site"** → **"Import an existing project"**
   - Выберите **GitHub** (или другую платформу)
   - Выберите репозиторий `loyalitybot`

3. **Настройте Build settings:**
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist
   ```

4. **Добавьте Environment Variables:**
   - Site settings → Environment variables → Add variable
   ```
   VITE_SUPABASE_URL=ваш_url
   VITE_SUPABASE_ANON_KEY=ваш_ключ
   VITE_APP_NAME=LoyalityBot
   VITE_APP_VERSION=0.1.0
   ```

5. **Нажмите "Deploy site"**

---

### Вариант 2: Деплой через Netlify CLI

```bash
# 1. Установите Netlify CLI (если еще не установлен)
npm install -g netlify-cli

# 2. Перейдите в корень проекта
cd /Users/ghbi/Downloads/loyalitybot

# 3. Залогиньтесь
netlify login

# 4. Инициализируйте проект (первый раз)
netlify init

# Следуйте инструкциям:
# - Выберите "Create & configure a new site"
# - Выберите команду для деплоя: npm run build
# - Укажите publish directory: frontend/dist

# 5. Задеплойте
netlify deploy --prod
```

---

### Вариант 3: Проверка существующего проекта

Если проект уже существует, но вы получаете ошибку:

1. **Проверьте в Netlify Dashboard:**
   - Откройте https://app.netlify.com
   - Найдите ваш сайт
   - Проверьте статус деплоя

2. **Проверьте конфигурацию:**
   - Site settings → Build & deploy
   - Убедитесь, что:
     - Base directory: `frontend`
     - Build command: `npm run build`
     - Publish directory: `frontend/dist`

3. **Проверьте файл `netlify.toml`:**
   ```toml
   [build]
     base = "frontend"
     publish = "dist"
     command = "npm run build"
   ```

---

## 🔍 Диагностика

### Проверьте, что файл `netlify.toml` в корне проекта:

```bash
cd /Users/ghbi/Downloads/loyalitybot
cat netlify.toml
```

Должен содержать:
```toml
[build]
  base = "frontend"
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

### Проверьте структуру проекта:

```bash
ls -la frontend/
# Должны быть: package.json, vite.config.js, src/, index.html
```

---

## 🚀 Быстрый деплой

Если нужно быстро задеплоить:

```bash
cd /Users/ghbi/Downloads/loyalitybot

# Установите Netlify CLI (один раз)
npm install -g netlify-cli

# Залогиньтесь (один раз)
netlify login

# Деплой
netlify deploy --prod
```

---

## ⚠️ Важно

1. **Base directory должен быть `frontend`** - Netlify будет искать `package.json` в этой папке
2. **Publish directory должен быть `frontend/dist`** - это папка со скомпилированным кодом
3. **Build command должен быть `npm run build`** - команда для сборки проекта

---

## 📝 После успешного деплоя

1. Получите URL от Netlify (например: `https://loyalitybot.netlify.app`)
2. Обновите переменную окружения `FRONTEND_URL` в `.env`:
   ```bash
   FRONTEND_URL=https://loyalitybot.netlify.app
   ```
3. Обновите `BASE_DOMAIN` в `client_handler.py` (если нужно)

---

## 🆘 Если ничего не помогает

1. Удалите проект в Netlify Dashboard
2. Создайте новый проект заново
3. Следуйте инструкциям выше

Или используйте другую платформу:
- **Render**: https://render.com
- **Railway**: https://railway.app
- **Fly.io**: https://fly.io

---

**Версия:** 1.0  
**Последнее обновление:** Декабрь 2024
