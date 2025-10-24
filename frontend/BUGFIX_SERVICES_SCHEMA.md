# 🐛 Исправлено: Неправильные названия колонок таблицы services

## Проблема:

**Иконки услуг не отображались** из-за несоответствия названий колонок в коде и базе данных.

### Ожидалось в коде:
- `name` → ❌ Неверно
- `cost` → ❌ Неверно  
- `status` → ❌ Неверно

### Реальная структура таблицы `services`:
- ✅ `title`
- ✅ `description`
- ✅ `price_points`
- ✅ `approval_status` (Pending/Approved/Rejected)
- ✅ `is_active` (boolean)
- ✅ `partner_chat_id`
- ✅ `created_at`

---

## ✅ Исправления:

### 1. frontend/src/services/supabase.js

**Функция `getApprovedServices`:**

```javascript
// БЫЛО:
.eq('status', 'Approved')

// СТАЛО:
.eq('approval_status', 'Approved')
.eq('is_active', true)
```

### 2. frontend/src/pages/Home.jsx

**Отображение названий услуг:**

```javascript
// БЫЛО:
const serviceIcon = isService ? getServiceIcon(item.name) : item.icon
const serviceName = isService ? item.name : ...

// СТАЛО:
const serviceIcon = isService ? getServiceIcon(item.title || item.name) : item.icon
const serviceName = isService ? (item.title || item.name) : ...
```

### 3. frontend/src/pages/Services.jsx

**Все вхождения `service.name`:**

```javascript
// БЫЛО:
{service.name}
{selectedService.name}

// СТАЛО:
{service.title}
{selectedService.title}
```

---

## 🎯 Что теперь работает:

### Если в базе ЕСТЬ одобренные услуги:
✅ Услуги загружаются с правильными данными  
✅ Иконки подбираются по названию `title`  
✅ Отображается корректное имя услуги

### Если в базе НЕТ одобренных услуг:
✅ Показываются дефолтные иконки из `defaultServiceIcons`  
✅ 8 категорий: Маникюр 💅, Прически 💇‍♀️, Массаж 💆‍♀️, и т.д.

---

## 📊 Текущее состояние базы:

```json
{
  "id": "0c26ad37-f0ea-4e50-9046-f192d92b60fa",
  "partner_chat_id": "406631153",
  "title": "Коуч сессия",
  "description": "1 часовая сессия с психологом в онлайне",
  "price_points": 80,
  "is_active": true,
  "approval_status": "Pending"
}
```

**Статус:** `Pending` → Нужно одобрить через админ-бота!

---

## 🚀 Следующие шаги:

### 1. Обновить на Vercel

Код исправлен и собран → **нужен редеплой**

```bash
# В Vercel Dashboard:
1. Deployments → Последний деплой
2. ⋯ (три точки) → Redeploy
```

### 2. Одобрить услугу через админ-бота

```bash
# Запустить админ-бота:
python3 admin_bot.py

# В Telegram:
/start → "Модерация Услуг" → Одобрить "Коуч сессия"
```

### 3. Протестировать

1. Открыть клиентского бота
2. Нажать "Открыть приложение"
3. Секция "Услуги" → должна показать:
   - 🧠 Коуч сессия (если одобрено)
   - ИЛИ дефолтные иконки (если нет одобренных)

---

## ✅ Файлы обновлены:

- ✅ `frontend/src/services/supabase.js`
- ✅ `frontend/src/pages/Home.jsx`
- ✅ `frontend/src/pages/Services.jsx`
- ✅ Production build успешен (`npm run build`)

---

## 🎨 Результат:

**Без одобренных услуг:**
```
Маникюр 💅  Прически 💇‍♀️  Массаж 💆‍♀️  Косметолог 🧴
Брови ✨    Ресницы 👁️   Лазер 💫    Визажист 💄
```

**С одобренной услугой:**
```
Коуч сессия 🧠   [остальные из базы...]
```

---

**Время исправления:** ~10 минут  
**Статус:** ✅ Готово к деплою

