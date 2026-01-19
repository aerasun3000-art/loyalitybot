-- ============================================
-- Миграция: Добавление USD полей в referral_rewards
-- Дата: 2025-01-XX
-- ============================================

-- 1. Добавить поле amount_usd для хранения комиссий в USD
ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(10,2);

-- 2. Добавить поле currency (валюта исходной транзакции)
ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- 3. Добавить поле status для отслеживания выплат
ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- 4. Добавить constraint для status
ALTER TABLE referral_rewards
DROP CONSTRAINT IF EXISTS referral_rewards_status_check;

ALTER TABLE referral_rewards
ADD CONSTRAINT referral_rewards_status_check 
    CHECK (status IN ('pending', 'accumulated', 'paid_ton', 'failed'));

-- 5. Добавить поля для TON интеграции
ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS ton_payment_id UUID,
ADD COLUMN IF NOT EXISTS ton_tx_hash VARCHAR(64);

-- 6. Обновить reward_type чтобы включить комиссии
-- (существующие типы: 'registration', 'transaction', 'achievement')
-- Добавить: 'commission_l1', 'commission_l2', 'commission_l3'
ALTER TABLE referral_rewards
DROP CONSTRAINT IF EXISTS referral_rewards_reward_type_check;

ALTER TABLE referral_rewards
ADD CONSTRAINT referral_rewards_reward_type_check 
    CHECK (reward_type IN ('registration', 'transaction', 'achievement', 
                          'commission_l1', 'commission_l2', 'commission_l3'));

-- 7. Создать индексы
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status 
    ON referral_rewards(status);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_usd 
    ON referral_rewards(amount_usd) 
    WHERE amount_usd IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_rewards_ton_hash 
    ON referral_rewards(ton_tx_hash) 
    WHERE ton_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_rewards_commission_type
    ON referral_rewards(reward_type)
    WHERE reward_type LIKE 'commission_%';

-- 8. Комментарии
COMMENT ON COLUMN referral_rewards.amount_usd IS 'Сумма комиссии в USD (для комиссий типа commission_l1/l2/l3)';
COMMENT ON COLUMN referral_rewards.currency IS 'Валюта исходной транзакции';
COMMENT ON COLUMN referral_rewards.status IS 'Статус выплаты комиссии: pending, accumulated, paid_ton, failed';
COMMENT ON COLUMN referral_rewards.ton_tx_hash IS 'Hash транзакции TON в блокчейне (если выплачено)';
