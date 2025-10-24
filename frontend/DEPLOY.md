# 🚀 Деплой на Vercel

Vercel - лучшая платформа для деплоя React приложений. Бесплатный план включает:
- ✅ Безлимитные деплои
- ✅ Автоматический HTTPS
- ✅ Global CDN
- ✅ Автоматические обновления из Git

---

## 📦 Способ 1: Через GitHub (Рекомендуется)

### Шаг 1: Загрузить код на GitHub

```bash
# В корне проекта loyalitybot
git add .
git commit -m "Add frontend"
git push origin main
```

### Шаг 2: Подключить Vercel

1. Перейдите на https://vercel.com
2. Войдите через GitHub
3. Нажмите **"New Project"**
4. Выберите ваш репозиторий `loyalitybot`
5. Настройте проект:

**Framework Preset:** Vite

**Root Directory:** `frontend` ⚠️ **ВАЖНО!**

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Environment Variables:**
```
VITE_SUPABASE_URL=https://gynpvfchojnyoirosysj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bnB2ZmNob2pueW9pcm9zeXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTExMzksImV4cCI6MjA3NjIyNzEzOX0.Lw-DG19z7ZNoiu1k0jLO8A7SmylhHPfA596qg0a88qk
VITE_APP_NAME=LoyalityBot
VITE_APP_VERSION=0.1.0
```

6. Нажмите **"Deploy"**

### Шаг 3: Получить URL

После деплоя Vercel выдаст URL, например:
```
https://loyalitybot-frontend.vercel.app
```

---

## 📦 Способ 2: Через Vercel CLI

```bash
# Установить Vercel CLI
npm i -g vercel

# Перейти в папку frontend
cd frontend

# Залогиниться
vercel login

# Деплой
vercel

# Production деплой
vercel --prod
```

---

## 🔗 Интеграция с Telegram ботом

После деплоя нужно обновить кнопки в ботах:

### В Client Bot (`client_handler.py`)

Найдите код с кнопкой "Открыть приложение":

```python
# Было:
web_app_url = "https://tma-bot-rewards.lovable.app"

# Стало:
web_app_url = "https://loyalitybot-frontend.vercel.app"
```

Добавьте кнопку с Web App:

```python
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

markup = InlineKeyboardMarkup()
webapp_button = InlineKeyboardButton(
    text="🚀 Открыть приложение",
    web_app=WebAppInfo(url="https://loyalitybot-frontend.vercel.app")
)
markup.add(webapp_button)

bot.send_message(
    message.chat.id,
    "Добро пожаловать в LoyalityBot!",
    reply_markup=markup
)
```

---

## 🔄 Автоматические обновления

После настройки каждый `git push` в ветку `main` будет автоматически:
1. Запускать сборку
2. Деплоить на Vercel
3. Обновлять production URL

---

## 🌍 Custom Domain (опционально)

Если хотите свой домен (например `app.loyalitybot.com`):

1. В Vercel Dashboard → Settings → Domains
2. Добавьте ваш домен
3. Настройте DNS записи (Vercel покажет инструкции)

---

## 📊 Мониторинг

Vercel Dashboard показывает:
- 📈 Аналитику посещений
- ⚡ Скорость загрузки
- 🐛 Логи ошибок
- 📊 Build логи

---

## 🔒 Безопасность

### Supabase RLS (Row Level Security)

Убедитесь, что в Supabase включены политики безопасности:

```sql
-- Пример политики: клиенты видят только свои данные
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = chat_id::text);
```

### Environment Variables

- ✅ Используйте Vercel Environment Variables
- ❌ НЕ коммитьте `.env` в Git
- ✅ Используйте `.env.example` для документации

---

## 🚨 Troubleshooting

### Ошибка: "Build failed"
- Проверьте Root Directory = `frontend`
- Убедитесь, что `package.json` в корне `frontend/`

### Ошибка: "Environment variables not working"
- В Vercel переменные должны начинаться с `VITE_`
- После изменения переменных нужен новый деплой

### Ошибка: "App doesn't work in Telegram"
- URL должен быть HTTPS (Vercel даёт автоматически)
- Проверьте, что Web App URL обновлён в боте
- Откройте Web Inspector в Telegram Desktop для дебага

---

**Готово!** 🎉 Ваше приложение доступно в интернете!

### Полезные ссылки:
- 📚 Vercel Docs: https://vercel.com/docs
- 🤖 Telegram Web Apps: https://core.telegram.org/bots/webapps
- 💾 Supabase Docs: https://supabase.com/docs

