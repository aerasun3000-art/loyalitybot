-- ============================================
-- Миграция: Добавление поля currency в transactions
-- Дата: 2025-12-XX
-- ============================================

-- 1. Добавить поле currency
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- 2. Создать индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_transactions_currency 
ON transactions(currency);

-- 3. Добавить комментарий
COMMENT ON COLUMN transactions.currency IS 'Валюта транзакции (USD, VND, RUB, KZT, KGS, AED)';

-- 4. Проверка: посмотреть структуру таблицы
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'transactions' AND column_name = 'currency';
