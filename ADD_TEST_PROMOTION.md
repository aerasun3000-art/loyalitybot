# 🎁 Как добавить тестовую акцию

## 📋 СПОСОБ 1: Через Партнёрский бот

### Шаг 1: Запустите партнёрский бот

```bash
cd /Users/alekseysanzheev/Desktop/loyalitybot
python3 bot.py
```

### Шаг 2: В Telegram

1. Откройте партнёрский бот
2. Выберите "🎁 Мои акции"
3. Нажмите "➕ Добавить акцию"
4. Заполните:
   - **Название:** Скидка 20% на все услуги
   - **Описание:** Получите скидку 20% при первом посещении!
   - **Баллы:** 100 (сколько баллов нужно для получения)
   - **Дата окончания:** Выберите дату в будущем

### Шаг 3: Одобрите через админский бот

```bash
# В другом терминале
cd /Users/alekseysanzheev/Desktop/loyalitybot
python3 admin_bot.py
```

1. Админский бот должен прислать уведомление
2. Одобрите акцию

### Шаг 4: Проверьте приложение

1. Откройте приложение
2. Cmd+Shift+R (жёсткое обновление)
3. Карусель акций должна появиться!

---

## 📋 СПОСОБ 2: Напрямую через Supabase

### Шаг 1: Откройте Supabase

https://gynpvfchojnyoirosysj.supabase.co

### Шаг 2: Table Editor → promotions

Нажмите **"Insert row"** (или **"+ New row"**)

### Шаг 3: Заполните поля

```
title: "🎉 Скидка 20% на первое посещение"
description: "Получите скидку 20% на любую услугу при первом визите. Накопите баллы и обменивайте на услуги!"
required_points: 100
start_date: 2025-10-24 (сегодня)
end_date: 2025-12-31 (в будущем)
is_active: true
partner_chat_id: <ID вашего партнёра>
created_at: now()
```

**Важно:** `partner_chat_id` должен существовать в таблице `partners`

### Шаг 4: Сохраните

Нажмите **"Save"**

### Шаг 5: Проверьте приложение

1. https://loyalitybot.vercel.app/
2. Cmd+Shift+R
3. Карусель акций появится!

---

## 📋 СПОСОБ 3: Добавить несколько тестовых акций сразу

### SQL запрос в Supabase:

1. Откройте **SQL Editor** в Supabase
2. Вставьте этот SQL:

```sql
-- Получите ID партнёра
-- SELECT chat_id FROM partners LIMIT 1;

-- Замените YOUR_PARTNER_CHAT_ID на реальный ID
INSERT INTO promotions (title, description, required_points, start_date, end_date, is_active, partner_chat_id)
VALUES
  (
    '🎉 Скидка 20% на первое посещение',
    'Получите скидку 20% на любую услугу при первом визите!',
    100,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '60 days',
    true,
    YOUR_PARTNER_CHAT_ID
  ),
  (
    '💎 VIP статус на месяц',
    'Станьте VIP клиентом и получайте двойные баллы!',
    500,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days',
    true,
    YOUR_PARTNER_CHAT_ID
  ),
  (
    '🎁 Бесплатная консультация',
    'Получите бесплатную 30-минутную консультацию от специалиста',
    0,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    true,
    YOUR_PARTNER_CHAT_ID
  );
```

3. Нажмите **"Run"**
4. Проверьте приложение!

---

## 🔍 ПРОВЕРКА: Работает ли запрос?

### В Supabase SQL Editor:

```sql
-- Проверьте активные акции
SELECT 
  id,
  title,
  required_points,
  start_date,
  end_date,
  is_active
FROM promotions
WHERE is_active = true
  AND start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE
ORDER BY created_at DESC;
```

Должны увидеть список активных акций.

---

## ⚠️ ВАЖНО:

### Если используете SQL:

1. **Получите ID партнёра:**
```sql
SELECT chat_id, name FROM partners LIMIT 1;
```

2. **Замените** `YOUR_PARTNER_CHAT_ID` на реальный chat_id

3. **Или создайте тестового партнёра:**
```sql
INSERT INTO partners (chat_id, name, company_name, phone, is_active)
VALUES (123456789, 'Тестовый Партнёр', 'Тестовая Компания', '+79991234567', true);
```

---

## ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:

После добавления акций в приложении появятся:

1. **Карусель топовых акций** (вверху главной)
2. **Секция "Акции партнёров"** (внизу главной)
3. **Страница "Акции"** будет заполнена

Все с красивыми градиентными изображениями! 🎨

---

## 💡 СОВЕТ:

Для теста достаточно **1-2 акции**.

Самый быстрый способ:
- **СПОСОБ 2** (напрямую через Supabase UI)
- Займёт 2 минуты
- Не нужно запускать боты

---

**Хотите, чтобы я помог добавить тестовые акции?** 😊

