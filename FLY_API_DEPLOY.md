# 🚀 Деплой бэкенд API (secure_api.py) на Fly.io

## 📋 Пошаговая инструкция

### Шаг 1: Установите flyctl

```bash
# macOS
brew install flyctl

# Или через curl
curl -L https://fly.io/install.sh | sh
```

### Шаг 2: Войдите в Fly.io

```bash
flyctl auth login
```

Откроется браузер для авторизации через GitHub/Google.

### Шаг 3: Создайте новое приложение для API

```bash
cd /Users/ghbi/Downloads/loyalitybot

# Создайте новое приложение специально для API
flyctl launch --name loyalitybot-api --region ams --no-deploy
```

Fly.io спросит:
- **Region**: выберите ближайший (например, `ams` для Амстердама, `sin` для Сингапура)
- **Postgres**: No (у вас уже есть Supabase)
- **Redis**: No (не нужно)

**Важно:** Используйте `--no-deploy`, чтобы сначала настроить переменные окружения.

После создания приложения скопируйте конфигурацию:
```bash
cp fly.api.toml fly.toml
```

### Шаг 4: Обновите fly.toml для API

Если Fly.io создал новый `fly.toml`, обновите его:

```toml
app = "loyalitybot-api"
primary_region = "ams"  # или ваш регион

[build]

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[[processes]]
  name = "app"
  command = "uvicorn secure_api:app --host 0.0.0.0 --port 8080"

[[vm]]
  memory = '512mb'  # Можно уменьшить для API
  cpu_kind = 'shared'
  cpus = 1
```

### Шаг 5: Настройте переменные окружения (Secrets)

**ВАЖНО:** Добавьте все необходимые переменные:

```bash
# Supabase
flyctl secrets set SUPABASE_URL="ваш_supabase_url" --app loyalitybot-api
flyctl secrets set SUPABASE_KEY="ваш_supabase_key" --app loyalitybot-api

# OpenAI (ОБЯЗАТЕЛЬНО для переводов!)
flyctl secrets set OPENAI_API_KEY="sk-proj-ваш_ключ" --app loyalitybot-api
flyctl secrets set OPENAI_MODEL="gpt-3.5-turbo" --app loyalitybot-api
flyctl secrets set OPENAI_MAX_TOKENS="500" --app loyalitybot-api

# Sentry (опционально)
flyctl secrets set SENTRY_DSN="ваш_sentry_dsn" --app loyalitybot-api
flyctl secrets set SENTRY_ENVIRONMENT="production" --app loyalitybot-api

# Другие (опционально)
flyctl secrets set APP_VERSION="1.0.0" --app loyalitybot-api
flyctl secrets set LOG_LEVEL="INFO" --app loyalitybot-api
```

**Где взять значения:**
- `SUPABASE_URL` и `SUPABASE_KEY` - из вашего `.env` файла
- `OPENAI_API_KEY` - из вашего `.env` файла (тот, что вы создали ранее)
- `OPENAI_MODEL` - можно оставить `gpt-3.5-turbo` или изменить

### Шаг 6: Задеплойте

```bash
flyctl deploy --app loyalitybot-api
```

Деплой займёт 2-5 минут.

### Шаг 7: Проверьте статус

```bash
flyctl status --app loyalitybot-api
```

Вы увидите URL вашего API, например: `https://loyalitybot-api.fly.dev`

### Шаг 8: Проверьте работу API

```bash
# Health check
curl https://loyalitybot-api.fly.dev/health

# Должен вернуть: {"status":"ok"}
```

Откройте в браузере:
- **Swagger UI**: `https://loyalitybot-api.fly.dev/docs`
- **Health**: `https://loyalitybot-api.fly.dev/health`

### Шаг 9: Протестируйте перевод

```bash
curl -X POST https://loyalitybot-api.fly.dev/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет, мир!", "target_lang": "en", "source_lang": "ru"}'
```

Должен вернуть:
```json
{
  "success": true,
  "translated_text": "Hello, world!",
  "original_text": "Привет, мир!",
  "source_lang": "ru",
  "target_lang": "en"
}
```

### Шаг 10: Обновите Netlify

После успешного деплоя:

1. Откройте Netlify: https://app.netlify.com
2. Выберите ваш сайт (frontend)
3. **Site configuration** → **Environment variables**
4. Добавьте:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://loyalitybot-api.fly.dev` (ваш URL из flyctl status)
   - **Scopes**: Production, Deploy previews, Branch deploys
5. **Trigger deploy** → **Deploy site**

---

## 🔧 Полезные команды

### Просмотр логов

```bash
flyctl logs --app loyalitybot-api
```

### Просмотр переменных окружения

```bash
flyctl secrets list --app loyalitybot-api
```

### Обновление переменной

```bash
flyctl secrets set OPENAI_API_KEY="новый_ключ" --app loyalitybot-api
```

### Перезапуск приложения

```bash
flyctl apps restart loyalitybot-api
```

### Просмотр статуса

```bash
flyctl status --app loyalitybot-api
```

---

## 🚨 Решение проблем

### Ошибка: "App not found"

**Решение:** Убедитесь, что вы используете правильное имя приложения:
```bash
flyctl apps list  # Посмотрите список приложений
```

### Ошибка: "Translation failed" или "OpenAI API key not found"

**Решение:** Проверьте, что `OPENAI_API_KEY` установлен:
```bash
flyctl secrets list --app loyalitybot-api | grep OPENAI
```

Если нет - установите:
```bash
flyctl secrets set OPENAI_API_KEY="ваш_ключ" --app loyalitybot-api
flyctl apps restart loyalitybot-api
```

### Ошибка: "CORS policy"

**Решение:** Проверьте настройки CORS в `secure_api.py`. Должен быть разрешен ваш Netlify домен.

### Ошибка: "502 Bad Gateway"

**Решение:** Проверьте логи:
```bash
flyctl logs --app loyalitybot-api
```

Возможные причины:
- Не установлены переменные окружения
- Ошибка в коде
- Неправильная команда запуска

---

## 💰 Стоимость

**Бесплатный план Fly.io:**
- 3 shared-cpu-1x VM
- 3GB persistent volumes
- 160GB outbound data transfer

**Для API этого более чем достаточно!**

---

## ✅ Чеклист

- [ ] flyctl установлен
- [ ] Авторизован в Fly.io
- [ ] Создано приложение `loyalitybot-api`
- [ ] `fly.toml` настроен для API
- [ ] Установлены все secrets (особенно `OPENAI_API_KEY`)
- [ ] Деплой завершён успешно
- [ ] Health check работает
- [ ] API переводов работает
- [ ] `VITE_API_URL` установлен в Netlify
- [ ] Фронтенд пересобран в Netlify

---

**После выполнения всех шагов переводы будут работать!** 🎉

