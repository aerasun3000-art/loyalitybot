-- ============================================
-- Вставка начальных курсов валют
-- Курсы на декабрь 2025 (примерные)
-- ============================================

-- Прямые курсы (в направлении к USD)
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from) VALUES
-- VND → USD (1 VND = 0.0000408 USD, т.е. 24,500 VND = 1 USD)
('VND', 'USD', 0.0000408, 'manual', NOW()),

-- RUB → USD (1 RUB = 0.011 USD, т.е. ~91 RUB = 1 USD)
('RUB', 'USD', 0.011, 'manual', NOW()),

-- KZT → USD (1 KZT = 0.0021 USD, т.е. ~476 KZT = 1 USD)
('KZT', 'USD', 0.0021, 'manual', NOW()),

-- KGS → USD (1 KGS = 0.011 USD, т.е. ~91 KGS = 1 USD)
('KGS', 'USD', 0.011, 'manual', NOW()),

-- AED → USD (1 AED = 0.272 USD, т.е. ~3.67 AED = 1 USD)
('AED', 'USD', 0.272, 'manual', NOW())

ON CONFLICT (from_currency, to_currency, effective_from) DO NOTHING;

-- Обратные курсы (USD → другие валюты)
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from) VALUES
-- USD → VND (1 USD = 24,500 VND)
('USD', 'VND', 24500, 'manual', NOW()),

-- USD → RUB (1 USD = ~91 RUB)
('USD', 'RUB', 91, 'manual', NOW()),

-- USD → KZT (1 USD = ~476 KZT)
('USD', 'KZT', 476, 'manual', NOW()),

-- USD → KGS (1 USD = ~91 KGS)
('USD', 'KGS', 91, 'manual', NOW()),

-- USD → AED (1 USD = ~3.67 AED)
('USD', 'AED', 3.67, 'manual', NOW())
ON CONFLICT DO NOTHING;
