-- ============================================
-- Настройка раннего предложения для партнеров NY
-- Первые 20 партнеров: $29/месяц
-- После 20 партнеров: $99/месяц
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- 1. Добавляем поля для отслеживания раннего предложения
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS partner_number INTEGER;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'regular' 
  CHECK (subscription_tier IN ('early_bird', 'premium', 'regular'));

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 0;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS annual_fee NUMERIC DEFAULT 0;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN DEFAULT false;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS subscription_start_date DATE;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS subscription_end_date DATE;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS subscription_city TEXT DEFAULT 'New York';

-- 2. Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partners_number ON partners(partner_number);
CREATE INDEX IF NOT EXISTS idx_partners_subscription_tier ON partners(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_partners_city_subscription ON partners(subscription_city, subscription_tier);

-- 3. Функция для автоматического присвоения номера партнера (только для NY)
CREATE OR REPLACE FUNCTION assign_partner_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  city_name TEXT;
BEGIN
  -- Проверяем, что это партнер из NY
  city_name := NEW.city;
  
  IF city_name = 'New York' THEN
    -- Получаем следующий номер для NY партнеров
    SELECT COALESCE(MAX(partner_number), 0) + 1 INTO next_number
    FROM partners
    WHERE city = 'New York' AND partner_number IS NOT NULL;
    
    NEW.partner_number := next_number;
    
    -- Определяем, является ли это ранним предложением
    IF next_number <= 20 THEN
      NEW.is_early_bird := true;
      NEW.subscription_tier := 'early_bird';
      NEW.monthly_fee := 29.00;
      NEW.annual_fee := 29.00 * 12.0; -- $348/год
    ELSE
      NEW.is_early_bird := false;
      NEW.subscription_tier := 'premium';
      NEW.monthly_fee := 99.00;
      NEW.annual_fee := 99.00 * 12.0; -- $1,188/год
    END IF;
    
    -- Устанавливаем даты подписки (месячная подписка)
    NEW.subscription_start_date := CURRENT_DATE;
    NEW.subscription_end_date := CURRENT_DATE + INTERVAL '1 month';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Создаем триггер для автоматического присвоения номера при создании партнера
DROP TRIGGER IF EXISTS trigger_assign_partner_number ON partners;
CREATE TRIGGER trigger_assign_partner_number
  BEFORE INSERT ON partners
  FOR EACH ROW
  WHEN (NEW.city = 'New York')
  EXECUTE FUNCTION assign_partner_number();

-- 5. Обновляем существующих партнеров NY (если есть)
-- ВНИМАНИЕ: Выполните этот блок только если нужно обновить существующих партнеров
/*
DO $$
DECLARE
  partner_rec RECORD;
  next_num INTEGER := 1;
BEGIN
  -- Сортируем партнеров NY по дате регистрации
  FOR partner_rec IN 
    SELECT chat_id, city, partner_package_purchased_at
    FROM partners
    WHERE city = 'New York' AND partner_number IS NULL
    ORDER BY COALESCE(partner_package_purchased_at, created_at) ASC
  LOOP
    UPDATE partners
    SET 
      partner_number = next_num,
      is_early_bird = (next_num <= 20),
      subscription_tier = CASE WHEN next_num <= 20 THEN 'early_bird' ELSE 'premium' END,
      monthly_fee = CASE WHEN next_num <= 20 THEN 29.00 ELSE 99.00 END,
      annual_fee = CASE WHEN next_num <= 20 THEN 29.00 * 12.0 ELSE 99.00 * 12.0 END,
      subscription_city = 'New York',
      subscription_start_date = COALESCE(partner_package_purchased_at::DATE, CURRENT_DATE),
      subscription_end_date = COALESCE(partner_package_purchased_at::DATE, CURRENT_DATE) + INTERVAL '1 month'
    WHERE chat_id = partner_rec.chat_id;
    
    next_num := next_num + 1;
  END LOOP;
END $$;
*/

-- 6. Функция для получения информации о раннем предложении
CREATE OR REPLACE FUNCTION get_early_bird_status()
RETURNS TABLE (
  total_partners INTEGER,
  early_bird_count INTEGER,
  remaining_early_bird_slots INTEGER,
  current_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_partners,
    COUNT(*) FILTER (WHERE is_early_bird = true)::INTEGER as early_bird_count,
    GREATEST(0, 20 - COUNT(*) FILTER (WHERE is_early_bird = true))::INTEGER as remaining_early_bird_slots,
    CASE 
      WHEN COUNT(*) FILTER (WHERE is_early_bird = true) < 20 THEN 29.00
      ELSE 99.00
    END as current_price_monthly
  FROM partners
  WHERE city = 'New York' AND partner_number IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Просмотр статуса раннего предложения
SELECT * FROM get_early_bird_status();

-- 8. Просмотр всех партнеров NY с их номерами и тарифами
SELECT 
  partner_number,
  chat_id,
  name,
  company_name,
  district,
  business_type,
  is_early_bird,
  subscription_tier,
  annual_fee,
  monthly_fee,
  subscription_start_date,
  subscription_end_date,
  CASE 
    WHEN is_early_bird THEN '🎁 Early Bird ($29/месяц)'
    ELSE '💎 Premium ($99/месяц)'
  END as pricing_status
FROM partners
WHERE city = 'New York' AND partner_number IS NOT NULL
ORDER BY partner_number;

-- 9. Проверка: сколько осталось мест по раннему предложению
SELECT 
  20 - COUNT(*) FILTER (WHERE is_early_bird = true) as remaining_early_bird_slots,
  COUNT(*) FILTER (WHERE is_early_bird = true) as current_early_bird_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE is_early_bird = true) < 20 THEN '✅ Early Bird доступен: $29/месяц'
    ELSE '❌ Early Bird закончился: $99/месяц'
  END as status_message
FROM partners
WHERE city = 'New York' AND partner_number IS NOT NULL;

-- 10. Комментарии к полям
COMMENT ON COLUMN partners.partner_number IS 'Порядковый номер партнера (только для NY, первые 20 получают раннее предложение)';
COMMENT ON COLUMN partners.subscription_tier IS 'Уровень подписки: early_bird ($29/год), premium ($99/год), regular';
COMMENT ON COLUMN partners.is_early_bird IS 'Является ли партнер участником раннего предложения (первые 20)';
COMMENT ON COLUMN partners.monthly_fee IS 'Месячная стоимость подписки в долларах';
COMMENT ON COLUMN partners.annual_fee IS 'Годовая стоимость подписки (рассчитана из месячной: monthly_fee × 12)';
COMMENT ON COLUMN partners.subscription_city IS 'Город, для которого действует подписка (пока только New York)';

