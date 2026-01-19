-- ============================================
-- Миграция: Добавление USD полей в partner_revenue_share
-- Дата: 2025-01-XX
-- ============================================

-- 1. Добавить поле amount_usd если его еще нет
ALTER TABLE partner_revenue_share
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(10,2);

-- 2. Добавить поля для TON интеграции
ALTER TABLE partner_revenue_share
ADD COLUMN IF NOT EXISTS ton_payment_id UUID REFERENCES ton_payments(id),
ADD COLUMN IF NOT EXISTS ton_tx_hash VARCHAR(64);

-- 3. Обновить статусы (добавить paid_ton, если нужно)
ALTER TABLE partner_revenue_share
DROP CONSTRAINT IF EXISTS partner_revenue_share_status_check;

ALTER TABLE partner_revenue_share
ADD CONSTRAINT partner_revenue_share_status_check 
    CHECK (status IN ('pending', 'approved', 'paid', 'paid_ton', 'failed'));

-- 4. Создать индексы
CREATE INDEX IF NOT EXISTS idx_revenue_share_status 
    ON partner_revenue_share(status);

CREATE INDEX IF NOT EXISTS idx_revenue_share_ton_hash 
    ON partner_revenue_share(ton_tx_hash) 
    WHERE ton_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_share_amount_usd 
    ON partner_revenue_share(amount_usd) 
    WHERE amount_usd IS NOT NULL;

-- 5. Комментарии
COMMENT ON COLUMN partner_revenue_share.amount_usd IS 'Сумма Revenue Share в USD (конвертирована из оригинальной валюты)';
COMMENT ON COLUMN partner_revenue_share.ton_tx_hash IS 'Hash транзакции TON в блокчейне';
COMMENT ON COLUMN partner_revenue_share.ton_payment_id IS 'Ссылка на запись в ton_payments';
