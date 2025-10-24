# 🚀 Инструкция по деплою на Vercel

## ✅ Код готов к деплою!

Git репозиторий инициализирован и закоммичен.

---

## 📦 Способ 1: Через веб-интерфейс (Рекомендуется)

### 1. Загрузить на GitHub

```bash
# 1. Создайте репозиторий на GitHub: https://github.com/new
# Назовите: loyalitybot (или любое другое имя)

# 2. Скопируйте URL репозитория и выполните:
cd /Users/alekseysanzheev/Desktop/loyalitybot
git remote add origin https://github.com/ВАШ_USERNAME/loyalitybot.git
git branch -M main
git push -u origin main
```

### 2. Подключить Vercel

1. Откройте https://vercel.com
2. **Sign Up** или **Log In** (через GitHub проще всего)
3. Нажмите кнопку **"New Project"**
4. Выберите свой репозиторий `loyalitybot`

### 3. Настройки проекта

**Framework Preset:** Vite

**Root Directory:** `frontend` ⚠️ **ОБЯЗАТЕЛЬНО!**

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 4. Environment Variables

Добавьте эти переменные окружения:

```
VITE_SUPABASE_URL=https://gynpvfchojnyoirosysj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bnB2ZmNob2pueW9pcm9zeXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTExMzksImV4cCI6MjA3NjIyNzEzOX0.Lw-DG19z7ZNoiu1k0jLO8A7SmylhHPfA596qg0a88qk
VITE_APP_NAME=LoyalityBot
VITE_APP_VERSION=0.1.0
```

### 5. Deploy!

Нажмите **"Deploy"** и дождитесь завершения (2-3 минуты).

### 6. Получите URL

После деплоя вы получите URL типа:
```
https://loyalitybot.vercel.app
```

Или Vercel сгенерирует автоматический:
```
https://loyalitybot-abc123.vercel.app
```

---

## 💻 Способ 2: Через Vercel CLI

### 1. Установить Vercel CLI

```bash
npm i -g vercel
```

### 2. Залогиниться

```bash
vercel login
```

Выберите Email или GitHub.

### 3. Deploy

```bash
cd /Users/alekseysanzheev/Desktop/loyalitybot/frontend
vercel

# Ответьте на вопросы:
# - Set up and deploy? Y
# - Which scope? (выберите свой аккаунт)
# - Link to existing project? N
# - Project name? loyalitybot-frontend
# - In which directory is your code? ./
# - Want to override settings? Y
# - Build Command? npm run build
# - Output Directory? dist
# - Development Command? npm run dev
```

### 4. Production Deploy

```bash
vercel --prod
```

### 5. Добавить Environment Variables

```bash
# Через CLI:
vercel env add VITE_SUPABASE_URL production
# Введите значение: https://gynpvfchojnyoirosysj.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Введите значение: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Или добавьте через Dashboard: https://vercel.com/aleksey/settings/environment-variables
```

---

## 🤖 После деплоя: Обновить бота

Когда получите URL от Vercel (например `https://loyalitybot.vercel.app`), обновите бота:

### В `client_handler.py`:

Найдите строку с `BASE_DOMAIN` (строка 35):

```python
# Было:
BASE_DOMAIN = "https://tma-bot-rewards.lovable.app"

# Стало:
BASE_DOMAIN = "https://ваш-url.vercel.app"
```

Или добавьте Web App кнопку в команду `/start`:

```python
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

markup = InlineKeyboardMarkup()
webapp_btn = InlineKeyboardButton(
    "🚀 Открыть приложение",
    web_app=WebAppInfo(url="https://ваш-url.vercel.app")
)
markup.add(webapp_btn)

client_bot.send_message(chat_id, "Добро пожаловать!", reply_markup=markup)
```

Перезапустите бота:
```bash
python3 client_handler.py
```

---

## ✅ Готово!

Теперь можно тестировать в Telegram:
1. Откройте бота
2. Нажмите кнопку "Открыть приложение"
3. Приложение откроется в Telegram!

---

## 🔄 Автоматические обновления

После настройки каждый `git push` в `main` будет автоматически деплоить изменения на Vercel.

---

## 📊 Мониторинг

Vercel Dashboard покажет:
- Статус деплоя
- Логи сборки
- Аналитику посещений
- Ошибки (если будут)

---

## 🆘 Проблемы?

### "Build failed"
- Убедитесь, что Root Directory = `frontend`
- Проверьте Environment Variables

### "App doesn't open in Telegram"
- URL должен быть HTTPS
- Проверьте, что Web App URL обновлён в боте
- Используйте Web Inspector в Telegram Desktop для дебага

---

**Успешного деплоя!** 🎉

