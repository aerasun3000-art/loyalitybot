-- ============================================
-- Миграция: Добавление TON полей в partners
-- Дата: 2025-01-XX
-- ============================================

-- 1. Добавить поле для TON кошелька партнера
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS ton_wallet_address VARCHAR(48);

-- 2. Добавить поле для метода выплат
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'bank' 
    CHECK (payment_method IN ('bank', 'ton', 'both'));

-- 3. Добавить поле для включения/выключения TON выплат
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS ton_payments_enabled BOOLEAN DEFAULT false;

-- 4. Создать индексы
CREATE INDEX IF NOT EXISTS idx_partners_ton_enabled 
    ON partners(ton_payments_enabled) 
    WHERE ton_payments_enabled = true;

CREATE INDEX IF NOT EXISTS idx_partners_ton_wallet 
    ON partners(ton_wallet_address) 
    WHERE ton_wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partners_payment_method 
    ON partners(payment_method);

-- 5. Комментарии
COMMENT ON COLUMN partners.ton_wallet_address IS 'TON кошелек партнера для получения выплат (формат: EQ...)';
COMMENT ON COLUMN partners.payment_method IS 'Метод выплат: bank (банк), ton (TON), both (оба)';
COMMENT ON COLUMN partners.ton_payments_enabled IS 'Включены ли TON выплаты для этого партнера';
