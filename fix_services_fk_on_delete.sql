-- ============================================
-- Исправление внешнего ключа fk_partner в таблице services
-- Добавление поведения ON DELETE SET NULL
-- ============================================
-- Этот скрипт устанавливает поведение ON DELETE SET NULL
-- для внешнего ключа partner_chat_id в таблице services
-- 
-- При удалении партнера из таблицы partners:
-- - Услуги останутся в системе
-- - partner_chat_id станет NULL
-- - Услуги будут показывать сообщение "Данный партнер пока не подключен к системе"

-- 1. Сначала проверяем, существует ли внешний ключ и какое у него имя
-- (в PostgreSQL имя может быть автоматически сгенерировано)

-- 2. Находим имя внешнего ключа (если он называется fk_partner или иначе)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Ищем имя ограничения внешнего ключа для partner_chat_id в таблице services
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'services'::regclass
      AND confrelid = 'partners'::regclass
      AND contype = 'f'
      AND array_length(conkey, 1) = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = 'services'::regclass AND attnum = conkey[1]) = 'partner_chat_id'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        -- Удаляем существующий внешний ключ
        EXECUTE format('ALTER TABLE services DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Удален внешний ключ: %', constraint_name;
    ELSE
        RAISE NOTICE 'Внешний ключ не найден, создаем новый';
    END IF;
END $$;

-- 3. Создаем новый внешний ключ с ON DELETE SET NULL
-- Сначала убеждаемся, что колонка partner_chat_id может быть NULL
ALTER TABLE services 
ALTER COLUMN partner_chat_id DROP NOT NULL;

-- Добавляем новый внешний ключ с ON DELETE SET NULL
ALTER TABLE services
ADD CONSTRAINT fk_services_partner_chat_id 
FOREIGN KEY (partner_chat_id) 
REFERENCES partners(chat_id) 
ON DELETE SET NULL;

-- 4. Добавляем комментарий для документации
COMMENT ON CONSTRAINT fk_services_partner_chat_id ON services IS 
'Внешний ключ на таблицу partners. При удалении партнера partner_chat_id становится NULL';

-- Проверка: показываем информацию о созданном ограничении
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'services'::regclass
  AND conname = 'fk_services_partner_chat_id';

