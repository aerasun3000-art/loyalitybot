# Инструкция по выполнению SQL миграций

## 📋 Порядок выполнения миграций

Система состоит из двух основных миграций:

1. **MLM Реферальная система** (`supabase_mlm_referral_system.sql`)
2. **Промоутеры + UGC + Лидерборд** (`supabase_promoters_ugc_leaderboard.sql`)

---

## 🚀 Вариант 1: Через Supabase Dashboard (Рекомендуется)

### Шаг 1: Выполните MLM миграцию

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor** (левый сайдбар)
4. Откройте файл `supabase_mlm_referral_system.sql`
5. Скопируйте весь содержимое файла
6. Вставьте в SQL Editor
7. Нажмите **RUN** (или `Ctrl+Enter`)

### Шаг 2: Выполните миграцию промоутеров

1. В том же SQL Editor
2. Откройте файл `supabase_promoters_ugc_leaderboard.sql`
3. Скопируйте весь содержимое файла
4. Вставьте в SQL Editor
5. Нажмите **RUN** (или `Ctrl+Enter`)

---

## 🖥️ Вариант 2: Через psql (командная строка)

```bash
# Установите переменные окружения
export SUPABASE_DB_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres"

# Выполните MLM миграцию
psql $SUPABASE_DB_URL -f supabase_mlm_referral_system.sql

# Выполните миграцию промоутеров
psql $SUPABASE_DB_URL -f supabase_promoters_ugc_leaderboard.sql
```

---

## ✅ Проверка выполнения

После выполнения обеих миграций проверьте, что созданы следующие таблицы:

### Таблицы MLM системы:
- ✅ `referral_tree`
- ✅ `referral_rewards`

### Таблицы промоутеров и UGC:
- ✅ `promoters`
- ✅ `ugc_content`
- ✅ `promo_materials`
- ✅ `material_downloads`

### Таблицы лидерборда:
- ✅ `leaderboard_periods`
- ✅ `leaderboard_rankings`
- ✅ `leaderboard_metrics`
- ✅ `prize_distributions`

### Проверка через SQL:

```sql
-- Проверка таблиц MLM
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('referral_tree', 'referral_rewards');

-- Проверка таблиц промоутеров
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('promoters', 'ugc_content', 'promo_materials', 'material_downloads');

-- Проверка таблиц лидерборда
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('leaderboard_periods', 'leaderboard_rankings', 'leaderboard_metrics', 'prize_distributions');
```

### Проверка функций:

```sql
-- Проверка функций
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'generate_promo_code',
    'recalculate_leaderboard_ranks',
    'update_promoter_on_ugc_approval',
    'update_promoter_on_prize_win',
    'create_monthly_leaderboard_period',
    'activate_upcoming_periods'
);
```

---

## ⚠️ Важные замечания

1. **Порядок выполнения важен**: Сначала MLM, потом промоутеры
2. **Резервная копия**: Рекомендуется сделать backup БД перед миграцией
3. **RLS политики**: После миграции убедитесь, что RLS включён и работает корректно
4. **Индексы**: Все индексы создаются автоматически

---

## 🔧 Обновление таблицы users

Обе миграции добавляют новые колонки в таблицу `users`:

### Из MLM миграции:
- `referral_code`
- `referred_by_chat_id`
- `total_referrals`
- `active_referrals`
- `total_referral_earnings`
- `referral_level`

### Из миграции промоутеров:
- `is_promoter`
- `promoter_since`
- `total_leaderboard_points`
- `leaderboard_wins`
- `current_leaderboard_period_id`

Если колонки уже существуют, миграция их не пересоздаст (используется `IF NOT EXISTS`).

---

## 📝 Первоначальная настройка

После выполнения миграций:

1. **Создайте первый период лидерборда** (через админ-бот):
   - `/start` → "🏆 Лидерборд" → "➕ Создать период"

2. **Добавьте промо-материалы** (через SQL или админ-интерфейс):
   ```sql
   INSERT INTO promo_materials (material_type, title, description, file_url, platform, is_active)
   VALUES 
   ('logo', 'Логотип компании', 'Основной логотип', 'https://example.com/logo.png', 'all', true),
   ('banner', 'Баннер для Instagram', 'Баннер 1080x1080', 'https://example.com/banner.png', 'instagram', true);
   ```

3. **Настройте призы для периода** (через админ-бот или SQL):
   ```sql
   UPDATE leaderboard_periods
   SET prizes_config = jsonb_build_object(
       '1', jsonb_build_object('type', 'physical', 'name', 'MacBook Pro', 'alternative_points', 100000),
       '2', jsonb_build_object('type', 'physical', 'name', 'iPhone 15 Pro', 'alternative_points', 80000),
       '3', jsonb_build_object('type', 'physical', 'name', 'AirPods Pro', 'alternative_points', 30000)
   )
   WHERE id = [PERIOD_ID];
   ```

---

## 🐛 Устранение проблем

### Ошибка: "relation already exists"
**Решение**: Это нормально, миграция использует `CREATE TABLE IF NOT EXISTS`

### Ошибка: "permission denied"
**Решение**: Убедитесь, что используете роль с правами на создание таблиц

### Ошибка: "column already exists"
**Решение**: Это нормально, миграция использует `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

---

## 📚 Дополнительная информация

- Все триггеры создаются автоматически
- RLS политики включены по умолчанию
- Индексы оптимизированы для частых запросов
- Функции используют безопасный подход с проверками

Если возникнут вопросы, проверьте логи выполнения в Supabase Dashboard → Logs → Postgres Logs

