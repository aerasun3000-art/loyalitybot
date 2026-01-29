-- ============================================
-- Миграция: Добавление preferred_currency в таблицу users
-- Дата: 2026-01-20
-- Описание: Позволяет клиентам выбирать валюту для отображения цен
-- ============================================

-- Добавляем поле preferred_currency
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'USD';

-- Добавляем constraint для разрешённых валют (с проверкой существования)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_preferred_currency'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT valid_preferred_currency CHECK (
            preferred_currency IN ('USD', 'VND', 'RUB', 'KZT')
        );
    END IF;
END $$;

-- Индекс для быстрого поиска по валюте (если понадобится аналитика)
CREATE INDEX IF NOT EXISTS idx_users_preferred_currency 
ON users(preferred_currency);

-- Комментарии
COMMENT ON COLUMN users.preferred_currency IS 'Предпочитаемая валюта клиента для отображения цен (USD, VND, RUB, KZT)';

-- ============================================
-- Обновление таблицы exchange_rates для новых валют
-- ============================================

-- Добавляем VND если нет
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from)
SELECT 'USD', 'VND', 25000, 'manual', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM currency_exchange_rates 
    WHERE from_currency = 'USD' AND to_currency = 'VND'
);

-- Добавляем RUB если нет
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from)
SELECT 'USD', 'RUB', 100, 'manual', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM currency_exchange_rates 
    WHERE from_currency = 'USD' AND to_currency = 'RUB'
);

-- Добавляем KZT если нет
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from)
SELECT 'USD', 'KZT', 520, 'manual', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM currency_exchange_rates 
    WHERE from_currency = 'USD' AND to_currency = 'KZT'
);

-- ============================================
-- Проверка результата
-- ============================================
-- После выполнения миграции проверьте:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'preferred_currency';
--
-- SELECT * FROM currency_exchange_rates WHERE from_currency = 'USD';
