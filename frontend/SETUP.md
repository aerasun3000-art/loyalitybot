# 🚀 Инструкция по запуску Frontend

## 📋 Предварительные требования

1. **Node.js** версии 18+ и **npm**
   ```bash
   # Проверить версию
   node --version
   npm --version
   ```

2. **Supabase URL и ключи** (уже настроено в `.env`)

---

## 🛠️ Установка и запуск

### 1. Установка зависимостей

```bash
cd frontend
npm install
```

### 2. Настройка переменных окружения

Файл `.env` уже создан с рабочими ключами:
```env
VITE_SUPABASE_URL=https://gynpvfchojnyoirosysj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

> ⚠️ **Важно**: Файл `.env` добавлен в `.gitignore` и не попадёт в Git!

### 3. Запуск в режиме разработки

```bash
npm run dev
```

Приложение откроется на `http://localhost:3000`

### 4. Сборка для продакшена

```bash
npm run build
```

Результат будет в папке `dist/`

### 5. Предпросмотр production сборки

```bash
npm run preview
```

---

## 📱 Тестирование в Telegram

### Вариант 1: Через ngrok (быстрый тест)

1. Установите ngrok: https://ngrok.com/download
2. Запустите приложение:
   ```bash
   npm run dev
   ```
3. В другом терминале:
   ```bash
   ngrok http 3000
   ```
4. Получите HTTPS URL (например: `https://abc123.ngrok.io`)
5. Откройте в Telegram боте через кнопку с `web_app_url`

### Вариант 2: Deploy на Vercel (рекомендуется)

См. файл `DEPLOY.md`

---

## 🔧 Полезные команды

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка для production
npm run build

# Предпросмотр production сборки
npm run preview

# Проверка линтера
npm run lint
```

---

## 🐛 Решение проблем

### Проблема: "Cannot find module"
**Решение:** Удалите `node_modules` и установите заново
```bash
rm -rf node_modules package-lock.json
npm install
```

### Проблема: Приложение не открывается в Telegram
**Решение:** 
- Убедитесь, что используете HTTPS (в production)
- Проверьте, что URL правильно настроен в боте
- Откройте консоль браузера для ошибок

### Проблема: Ошибка подключения к Supabase
**Решение:**
- Проверьте `.env` файл
- Убедитесь, что ключи правильные
- Проверьте RLS (Row Level Security) политики в Supabase

---

## 📚 Дополнительно

- 🎨 **Дизайн**: Используется Telegram UI Kit
- 🌐 **i18n**: Поддержка русского и английского
- 🌙 **Темы**: Автоматическая поддержка light/dark
- 📱 **Адаптивность**: Работает на всех устройствах

---

**Готово!** 🎉 Приложение готово к работе!

