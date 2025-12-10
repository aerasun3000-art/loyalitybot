-- ============================================
-- Добавление полей для частичной оплаты баллами в акциях
-- ============================================
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- Добавляем поле для стоимости услуги в долларах
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS service_price NUMERIC;

-- Добавляем поле для максимальной суммы оплаты баллами
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS max_points_payment NUMERIC;

-- Добавляем поле для курса обмена баллов (по умолчанию 1 балл = 1 доллар)
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS points_to_dollar_rate NUMERIC DEFAULT 1.0;

-- Добавляем комментарии
COMMENT ON COLUMN promotions.service_price IS 'Стоимость услуги в долларах (например, 100)';
COMMENT ON COLUMN promotions.max_points_payment IS 'Максимальная сумма, которую можно оплатить баллами в долларах (например, 50)';
COMMENT ON COLUMN promotions.points_to_dollar_rate IS 'Курс обмена: сколько долларов стоит 1 балл (по умолчанию 1.0)';

-- Создаем индекс для быстрого поиска акций с возможностью оплаты баллами
CREATE INDEX IF NOT EXISTS idx_promotions_points_payment 
ON promotions(max_points_payment) 
WHERE max_points_payment IS NOT NULL AND max_points_payment > 0;

-- Добавляем проверку: max_points_payment не может быть больше service_price
ALTER TABLE promotions
ADD CONSTRAINT check_max_points_not_exceed_price 
CHECK (max_points_payment IS NULL OR service_price IS NULL OR max_points_payment <= service_price);

