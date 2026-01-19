-- ============================================
-- Миграция: Создание таблицы курсов валют
-- Дата: 2025-12-XX
-- ============================================

CREATE TABLE IF NOT EXISTS currency_exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL DEFAULT 'USD',
    rate NUMERIC(18, 8) NOT NULL,
    source TEXT DEFAULT 'manual',
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(from_currency, to_currency, effective_from),
    
    CONSTRAINT valid_currencies CHECK (
        from_currency IN ('USD', 'VND', 'RUB', 'KZT', 'KGS', 'AED') AND
        to_currency IN ('USD', 'VND', 'RUB', 'KZT', 'KGS', 'AED')
    )
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_currency_rates_lookup 
ON currency_exchange_rates(from_currency, to_currency, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_currency_rates_effective 
ON currency_exchange_rates(effective_from, effective_until);

-- Комментарии
COMMENT ON TABLE currency_exchange_rates IS 'Курсы обмена валют для конвертации транзакций';
COMMENT ON COLUMN currency_exchange_rates.rate IS 'Курс: 1 from_currency = rate to_currency';
COMMENT ON COLUMN currency_exchange_rates.source IS 'Источник курса: manual, api, etc.';
