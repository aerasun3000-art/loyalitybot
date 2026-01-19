-- ============================================
-- Миграция: Создание таблицы курсов TON/USD
-- Дата: 2025-01-XX
-- ============================================

CREATE TABLE IF NOT EXISTS ton_exchange_rates (
    id SERIAL PRIMARY KEY,
    rate NUMERIC(12,6) NOT NULL,  -- Курс: 1 TON = X USD
    source TEXT NOT NULL,  -- Источник (binance, coingecko, manual)
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_ton_rates_lookup 
    ON ton_exchange_rates(effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_ton_rates_effective 
    ON ton_exchange_rates(effective_from, effective_until);

-- Комментарии
COMMENT ON TABLE ton_exchange_rates IS 'Курсы обмена TON/USD для конвертации выплат';
COMMENT ON COLUMN ton_exchange_rates.rate IS 'Курс: 1 TON = rate USD';
COMMENT ON COLUMN ton_exchange_rates.source IS 'Источник курса: binance, coingecko, manual';
COMMENT ON COLUMN ton_exchange_rates.effective_from IS 'С какой даты действует курс';
COMMENT ON COLUMN ton_exchange_rates.effective_until IS 'До какой даты действует курс (NULL = актуальный)';
