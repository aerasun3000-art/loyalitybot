# 📊 SQL запросы для проверки базы данных

## Быстрая проверка (все в одном запросе):

```sql
-- Проверка структуры и данных таблицы services
SELECT 
  'STRUCTURE' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'services'
ORDER BY ordinal_position

UNION ALL

SELECT 
  'DATA' as check_type,
  title as column_name,
  COALESCE(icon, 'NULL') as data_type
FROM services
WHERE approval_status = 'Approved' 
  AND is_active = true
LIMIT 10;
```

---

## Детальная проверка:

### 1. Структура таблицы:
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'services'
ORDER BY ordinal_position;
```

### 2. Данные услуг:
```sql
SELECT 
  id,
  title,
  name,
  icon,
  approval_status,
  is_active,
  created_at
FROM services
WHERE approval_status = 'Approved' 
  AND is_active = true
ORDER BY created_at DESC
LIMIT 20;
```

### 3. Проверка на эмодзи:
```sql
SELECT 
  id,
  title,
  icon,
  CASE 
    WHEN icon IS NULL THEN 'NULL'
    WHEN icon ~ '[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]' THEN 'EMOJI'
    WHEN LENGTH(icon) > 20 THEN 'TOO_LONG'
    ELSE 'OK'
  END as icon_status
FROM services
WHERE approval_status = 'Approved' 
  AND is_active = true
ORDER BY icon_status DESC;
```

### 4. Статистика по иконкам:
```sql
SELECT 
  COUNT(*) as total_services,
  COUNT(icon) as services_with_icon,
  COUNT(*) - COUNT(icon) as services_without_icon,
  COUNT(CASE WHEN icon ~ '[^\x00-\x7F]' THEN 1 END) as services_with_emoji
FROM services
WHERE approval_status = 'Approved' 
  AND is_active = true;
```

### 5. Примеры названий услуг:
```sql
SELECT DISTINCT
  title,
  COUNT(*) as count
FROM services
WHERE approval_status = 'Approved' 
  AND is_active = true
GROUP BY title
ORDER BY count DESC
LIMIT 30;
```

---

## Как использовать в Supabase:

1. Откройте **Supabase Dashboard**
2. Перейдите в **SQL Editor**
3. Скопируйте запрос
4. Нажмите **Run**
5. Скопируйте результаты и отправьте мне

---

## Что нужно проверить в первую очередь:

✅ **Поле `icon` существует?**
✅ **Что в нем хранится?** (эмодзи, строки, NULL)
✅ **Какие названия услуг?** (для проверки функции `getServiceIcon`)

