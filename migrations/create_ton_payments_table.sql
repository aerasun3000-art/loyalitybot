-- ============================================
-- Миграция: Создание таблицы для TON выплат
-- Дата: 2025-01-XX
-- ============================================

CREATE TABLE IF NOT EXISTS ton_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Связь с партнером
    partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    
    -- Связь с источником комиссии
    revenue_share_id INTEGER REFERENCES partner_revenue_share(id) ON DELETE SET NULL,
    referral_reward_id INTEGER REFERENCES referral_rewards(id) ON DELETE SET NULL,
    
    -- Тип выплаты
    payment_type VARCHAR(20) NOT NULL 
        CHECK (payment_type IN ('revenue_share', 'referral_commission', 'manual')),
    
    -- Суммы
    amount_usd NUMERIC(10,2) NOT NULL,  -- Сумма в USD перед конвертацией
    amount_nano BIGINT NOT NULL,  -- Сумма в нанотонах (1 TON = 1e9 nanoTON)
    ton_amount NUMERIC(18,9) NOT NULL,  -- Сумма в TON (для удобства)
    exchange_rate NUMERIC(12,6) NOT NULL,  -- Курс TON/USD на момент выплаты
    
    -- Блокчейн данные
    ton_tx_hash VARCHAR(64) UNIQUE,  -- Hash транзакции
    ton_tx_lt BIGINT,  -- Logical time транзакции
    ton_block_seqno INTEGER,  -- Номер блока
    from_address VARCHAR(48),  -- Адрес отправителя (кошелек платформы)
    to_address VARCHAR(48) NOT NULL,  -- Адрес получателя (кошелек партнера)
    
    -- Статусы
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'sending', 'sent', 'confirmed', 'failed')),
    
    -- Метаданные
    comment TEXT,  -- Комментарий к транзакции
    error_message TEXT,  -- Сообщение об ошибке (если failed)
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,  -- Когда транзакция отправлена
    confirmed_at TIMESTAMP,  -- Когда транзакция подтверждена в блокчейне
    
    -- Повторы
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,
    max_retries INTEGER DEFAULT 3
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_ton_payments_partner 
    ON ton_payments(partner_chat_id);

CREATE INDEX IF NOT EXISTS idx_ton_payments_status 
    ON ton_payments(status);

CREATE INDEX IF NOT EXISTS idx_ton_payments_hash 
    ON ton_payments(ton_tx_hash);

CREATE INDEX IF NOT EXISTS idx_ton_payments_type 
    ON ton_payments(payment_type);

CREATE INDEX IF NOT EXISTS idx_ton_payments_created 
    ON ton_payments(created_at);

CREATE INDEX IF NOT EXISTS idx_ton_payments_revenue_share 
    ON ton_payments(revenue_share_id) 
    WHERE revenue_share_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ton_payments_referral_reward 
    ON ton_payments(referral_reward_id) 
    WHERE referral_reward_id IS NOT NULL;

-- Комментарии
COMMENT ON TABLE ton_payments IS 'Таблица для хранения всех TON выплат комиссий партнерам';
COMMENT ON COLUMN ton_payments.amount_usd IS 'Сумма в USD перед конвертацией в TON';
COMMENT ON COLUMN ton_payments.amount_nano IS 'Сумма в нанотонах (1 TON = 1,000,000,000 nanoTON)';
COMMENT ON COLUMN ton_payments.ton_amount IS 'Сумма в TON (для удобства чтения)';
COMMENT ON COLUMN ton_payments.exchange_rate IS 'Курс TON/USD на момент выплаты';
COMMENT ON COLUMN ton_payments.ton_tx_hash IS 'Hash транзакции в блокчейне TON';
