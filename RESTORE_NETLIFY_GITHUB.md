# 🔄 Восстановление деплоя Netlify через GitHub

## ❌ Проблема

Ошибка `404: DEPLOYMENT_NOT_FOUND` означает, что:
- Проект был отвязан от GitHub в Netlify
- Настройки build изменились
- Проект был удален или переименован

---

## ✅ Решение: Проверка и восстановление настроек

### Шаг 1: Проверьте проект в Netlify Dashboard

1. Откройте https://app.netlify.com
2. Войдите в аккаунт
3. Найдите ваш сайт (обычно называется `loyalitybot` или похожее имя)

**Если сайт НЕ найден:**
- Перейдите к шагу 2 (создание нового)

**Если сайт найден:**
- Перейдите к шагу 3 (проверка настроек)

---

### Шаг 2: Создание/Переподключение проекта

#### Вариант A: Проект существует, но отвязан от GitHub

1. В Netlify Dashboard выберите ваш сайт
2. Перейдите в **Site settings** → **Build & deploy** → **Continuous Deployment**
3. Нажмите **"Link to Git provider"**
4. Выберите **GitHub**
5. Выберите репозиторий `loyalitybot`
6. Нажмите **"Save"**

#### Вариант B: Проект не существует

1. В Netlify Dashboard нажмите **"Add new site"** → **"Import an existing project"**
2. Выберите **GitHub**
3. Выберите репозиторий `loyalitybot`
4. Настройте:

   **Base directory:** `frontend`
   
   **Build command:** `npm run build`
   
   **Publish directory:** `dist` (относительно base, т.е. `frontend/dist`)

5. Добавьте Environment Variables:
   - **Site settings** → **Environment variables** → **Add variable**
   
   ```
   VITE_SUPABASE_URL=ваш_url
   VITE_SUPABASE_ANON_KEY=ваш_ключ
   VITE_APP_NAME=LoyalityBot
   VITE_APP_VERSION=0.1.0
   ```

6. Нажмите **"Deploy site"**

---

### Шаг 3: Проверка настроек Build

Если проект уже существует, проверьте настройки:

1. **Site settings** → **Build & deploy** → **Build settings**

   Должно быть:
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: dist
   ```

   ⚠️ **Важно:** `Publish directory` должен быть `dist` (не `frontend/dist`), так как base уже указывает на `frontend`

2. Проверьте, что файл `netlify.toml` в корне проекта:

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

3. Если настройки неверные, исправьте их и нажмите **"Save"**

---

### Шаг 4: Проверка подключения к GitHub

1. **Site settings** → **Build & deploy** → **Continuous Deployment**
2. Убедитесь, что:
   - ✅ **Repository** указан правильно: `ваш_username/loyalitybot`
   - ✅ **Branch to deploy:** `main` (или `master`)
   - ✅ **Build command:** `npm run build`
   - ✅ **Publish directory:** `dist`

3. Если что-то не так, нажмите **"Edit settings"** и исправьте

---

### Шаг 5: Триггер нового деплоя

После исправления настроек:

1. **Вариант A:** Сделайте новый коммит и push:
   ```bash
   git add .
   git commit -m "Fix Netlify deployment"
   git push origin main
   ```

2. **Вариант B:** Вручную запустите деплой:
   - В Netlify Dashboard → **Deploys** → **Trigger deploy** → **Deploy site**

---

## 🔍 Диагностика

### Проверьте логи деплоя

1. В Netlify Dashboard → **Deploys**
2. Выберите последний деплой
3. Нажмите на него, чтобы увидеть логи

**Типичные ошибки:**

- ❌ `Base directory "frontend" does not exist`
  - **Решение:** Убедитесь, что папка `frontend` существует в репозитории

- ❌ `Build command failed`
  - **Решение:** Проверьте, что `package.json` есть в папке `frontend`

- ❌ `Publish directory "dist" does not exist`
  - **Решение:** Проверьте, что build команда создает папку `dist`

---

## 📝 Проверка файла netlify.toml

Убедитесь, что файл `netlify.toml` находится в **корне проекта** (не в `frontend/`):

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

---

## 🚀 Быстрое восстановление

Если ничего не помогает, пересоздайте проект:

1. **В Netlify Dashboard:**
   - Удалите старый сайт (если есть)
   - Создайте новый через **"Add new site"** → **"Import an existing project"**

2. **Настройте:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Добавьте Environment Variables**

4. **Задеплойте**

---

## ✅ После успешного деплоя

1. Получите URL от Netlify (например: `https://loyalitybot.netlify.app`)
2. Обновите переменную `FRONTEND_URL` в `.env`:
   ```bash
   FRONTEND_URL=https://loyalitybot.netlify.app
   ```
3. Теперь каждый `git push` будет автоматически деплоить на Netlify! 🎉

---

## 🔗 Полезные ссылки

- Netlify Dashboard: https://app.netlify.com
- Netlify Docs: https://docs.netlify.com
- GitHub Integration: https://docs.netlify.com/integrations/github/

---

**Версия:** 1.0  
**Последнее обновление:** Декабрь 2024
