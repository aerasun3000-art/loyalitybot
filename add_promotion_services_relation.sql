-- ============================================
-- Связь акций с услугами (Many-to-Many)
-- Вариант 3: Гибридный подход - акция может быть привязана к одной или нескольким услугам
-- ============================================
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- 1. Добавляем поле promotion_type в таблицу promotions
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS promotion_type TEXT DEFAULT 'discount' 
CHECK (promotion_type IN ('discount', 'points_redemption', 'cashback'));

COMMENT ON COLUMN promotions.promotion_type IS 'Тип акции: discount (скидка), points_redemption (обмен баллов), cashback (кэшбэк)';

-- 2. Создаем связующую таблицу promotion_services
CREATE TABLE IF NOT EXISTS promotion_services (
    id SERIAL PRIMARY KEY,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(promotion_id, service_id)
);

-- 3. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_promotion_services_promotion 
ON promotion_services(promotion_id);

CREATE INDEX IF NOT EXISTS idx_promotion_services_service 
ON promotion_services(service_id);

-- 4. Добавляем комментарии
COMMENT ON TABLE promotion_services IS 'Связь акций с услугами (Many-to-Many). Одна акция может быть привязана к нескольким услугам.';
COMMENT ON COLUMN promotion_services.promotion_id IS 'UUID акции (ссылка на promotions.id)';
COMMENT ON COLUMN promotion_services.service_id IS 'UUID услуги';

-- 5. Создаем функцию для получения услуг по акции
CREATE OR REPLACE FUNCTION get_services_for_promotion(promo_id UUID)
RETURNS TABLE (
    service_id UUID,
    service_title TEXT,
    service_description TEXT,
    service_price_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.description,
        s.price_points
    FROM services s
    INNER JOIN promotion_services ps ON s.id = ps.service_id
    WHERE ps.promotion_id = promo_id
    AND s.approval_status = 'Approved'
    AND s.is_active = true
    ORDER BY s.title;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_services_for_promotion IS 'Возвращает список услуг, привязанных к акции';

-- 6. Создаем функцию для получения акций по услуге
CREATE OR REPLACE FUNCTION get_promotions_for_service(service_uuid UUID)
RETURNS TABLE (
    promotion_id UUID,
    promotion_title TEXT,
    promotion_description TEXT,
    promotion_type TEXT,
    service_price NUMERIC,
    max_points_payment NUMERIC,
    points_to_dollar_rate NUMERIC,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.promotion_type,
        p.service_price,
        p.max_points_payment,
        p.points_to_dollar_rate,
        p.start_date,
        p.end_date,
        p.is_active
    FROM promotions p
    INNER JOIN promotion_services ps ON p.id = ps.promotion_id
    WHERE ps.service_id = service_uuid
    AND p.is_active = true
    AND p.start_date <= CURRENT_DATE
    AND p.end_date >= CURRENT_DATE
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_promotions_for_service IS 'Возвращает список активных акций для услуги';

-- 7. Создаем представление для удобного просмотра связей
CREATE OR REPLACE VIEW promotion_services_view AS
SELECT 
    ps.id,
    ps.promotion_id,
    p.title AS promotion_title,
    p.promotion_type,
    p.is_active AS promotion_active,
    ps.service_id,
    s.title AS service_title,
    s.price_points AS service_price_points,
    s.approval_status AS service_status,
    ps.created_at
FROM promotion_services ps
INNER JOIN promotions p ON ps.promotion_id = p.id
INNER JOIN services s ON ps.service_id = s.id;

COMMENT ON VIEW promotion_services_view IS 'Представление для просмотра связей акций и услуг';

-- ============================================
-- ✅ Готово!
-- ============================================
-- Теперь можно:
-- 1. Привязывать несколько услуг к одной акции
-- 2. Искать акции для конкретной услуги
-- 3. Искать услуги для конкретной акции
-- ============================================
