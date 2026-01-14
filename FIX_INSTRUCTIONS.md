# 🔧 Инструкция: Как исправить связь мастеров с Алексеем

## Проблема
Показывает 0 приглашенных, хотя Алексей пригласил 3 мастеров.

## Причина
Не установлены связи в базе данных:
- В таблице `partners` у мастеров нет `referred_by_chat_id = '406631153'`
- В таблице `partner_network` нет записей о связи

## Решение (пошагово)

### Шаг 1: Найти chat_id 3 мастеров

Откройте SQL Editor в Supabase и выполните:

```sql
SELECT 
    chat_id,
    name,
    company_name,
    business_type,
    partner_type,
    referred_by_chat_id,
    created_at
FROM partners 
ORDER BY created_at DESC 
LIMIT 10;
```

**Запишите chat_id 3 мастеров**, которых пригласил Алексей.

### Шаг 2: Исправить связи

Откройте файл `fix_alexey_masters_connections.sql`.

**ВАЖНО:** Замените в запросах:
- `'CHAT_ID_МАСТЕРА_1'` → реальный chat_id первого мастера
- `'CHAT_ID_МАСТЕРА_2'` → реальный chat_id второго мастера  
- `'CHAT_ID_МАСТЕРА_3'` → реальный chat_id третьего мастера

Затем выполните следующие запросы по очереди:

#### 2.1. Установить referred_by_chat_id

```sql
UPDATE partners
SET referred_by_chat_id = '406631153'
WHERE chat_id IN (
    'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_1',
    'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_2',
    'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_3'
);
```

#### 2.2. Создать записи в partner_network (ВАЖНО для Revenue Share!)

```sql
INSERT INTO partner_network (referrer_chat_id, referred_chat_id, level, is_active)
VALUES 
    ('406631153', 'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_1', 1, true),
    ('406631153', 'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_2', 1, true),
    ('406631153', 'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_3', 1, true)
ON CONFLICT (referrer_chat_id, referred_chat_id) 
DO UPDATE SET 
    level = 1,
    is_active = true;
```

#### 2.3. (Опционально) Установить тег 'master'

```sql
UPDATE partners
SET 
    partner_type = 'master',
    partner_level = 3
WHERE chat_id IN (
    'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_1',
    'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_2',
    'РЕАЛЬНЫЙ_CHAT_ID_МАСТЕРА_3'
);
```

### Шаг 3: Проверить результат

Выполните проверочный запрос:

```sql
SELECT 
    COUNT(*) as total_masters_linked,
    COUNT(CASE WHEN pn.id IS NOT NULL THEN 1 END) as in_network
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
    AND pn.level = 1
)
WHERE p.referred_by_chat_id = '406631153';
```

**Ожидаемый результат:** `total_masters_linked = 3` и `in_network = 3`

## Важные моменты

1. **chat_id должен быть строкой** - используйте кавычки: `'406631153'`
2. **Оба UPDATE нужны** - и в `partners`, и в `partner_network`
3. **partner_network критично важен** - без него Revenue Share не будет работать
4. **Можно выполнять повторно** - `ON CONFLICT` предотвратит дубликаты

## Если не знаете chat_id мастеров

Если не можете найти мастеров по дате создания, попробуйте найти по другим признакам:

```sql
-- По имени
SELECT chat_id, name, company_name 
FROM partners 
WHERE name ILIKE '%ИМЯ%';

-- По названию компании
SELECT chat_id, name, company_name 
FROM partners 
WHERE company_name ILIKE '%НАЗВАНИЕ%';

-- Все партнеры без referred_by_chat_id (возможно, это ваши мастера)
SELECT chat_id, name, company_name, created_at
FROM partners 
WHERE referred_by_chat_id IS NULL
ORDER BY created_at DESC;
```

